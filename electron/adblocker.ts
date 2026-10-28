import { ipcMain, Session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ElectronBlocker, Request } from '@ghostery/adblocker-electron';
import { isBlockedPopup, matchesBlockedDomain, normalizeFilterDomain, normalizeSiteException } from './adblocker-logic';
import { AdBlockerStats, BlockedRequest } from './types';

type IBackgroundCallback = Parameters<ElectronBlocker['onInjectCosmeticFilters']>[2];

const ENGINE_CACHE_FILENAME = 'ghostery-adblocker-engine.bin';
const ENGINE_METADATA_FILENAME = 'ghostery-adblocker-metadata.json';
const FILTER_CACHE_FILENAME = 'adblock-filter-cache.json';
const SITE_EXCEPTIONS_FILENAME = 'adblock-site-exceptions.json';
const FILTER_REFRESH_INTERVAL = 24 * 60 * 60 * 1000;
const MAX_FILTER_LIST_BYTES = 8 * 1024 * 1024;
const MAX_ENGINE_CACHE_BYTES = 100 * 1024 * 1024;
const MIN_FILTER_DOMAINS = 1000;
const MAX_FILTER_DOMAINS = 250000;
const MAX_RECENT_BLOCKS = 60;

const DEFAULT_BLOCKED_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adnxs.com',
  'advertising.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'adroll.com',
  'scorecardresearch.com',
  'quantserve.com',
  'popads.net',
  'adservice.google.com',
  'adservice.google.com.tr',
  'analytics.google.com',
  'google-analytics.com',
  'hotjar.com',
  'clarity.ms',
  'connect.facebook.net',
  'adcolony.com',
  'applovin.com',
  'unityads.unity3d.com',
  'vungle.com',
  'chartbeat.net',
  'mc.yandex.ru',
  'yieldmo.com',
  'amazon-adsystem.com',
];

const TRACKER_PATTERN = /analytics|tracking|tracker|telemetry|pixel|metrics|beacon|fingerprint|hotjar|clarity|scorecard|quantserve|metrika|mixpanel|segment|amplitude/i;

export class AdBlockerService {
  private blockedCount = 0;
  private trackersCount = 0;
  private blockedPopupsCount = 0;
  private httpsUpgradedCount = 0;
  private isShieldActive = true;
  private blockedDomains = new Set(DEFAULT_BLOCKED_DOMAINS);
  private siteExceptions = new Set<string>();
  private recentBlocked: BlockedRequest[] = [];
  private filterRuleCount = 0;
  private engine: ElectronBlocker | undefined;
  private engineModule: typeof import('@ghostery/adblocker-electron') | undefined;
  private browserSession: Session | undefined;
  private onBlockedMainFrame: ((webContentsId: number) => void) | undefined;
  private filterListUpdatedAt: number | null = null;
  private filterListStatus: AdBlockerStats['filterListStatus'] = 'bundled';
  private filterListError: string | undefined;
  private userDataPath: string | undefined;
  private filterRefresh: Promise<AdBlockerStats> | undefined;
  private filterRefreshTimer: NodeJS.Timeout | undefined;
  private initialized = false;

  public async initialize(
    session: Session,
    userDataPath: string,
    onBlockedMainFrame?: (webContentsId: number) => void,
  ): Promise<void> {
    this.userDataPath = userDataPath;
    if (this.initialized) return;
    this.initialized = true;
    this.browserSession = session;
    this.onBlockedMainFrame = onBlockedMainFrame;
    this.loadSiteExceptions();
    this.loadFilterCache();

    this.registerRequestHandler();
    this.registerHeadersHandler();

    try {
      const previousSecurityWarningsSetting = process.env.ELECTRON_DISABLE_SECURITY_WARNINGS;
      try {
        this.engineModule = await import('@ghostery/adblocker-electron');
      } finally {
        if (previousSecurityWarningsSetting === undefined) {
          delete process.env.ELECTRON_DISABLE_SECURITY_WARNINGS;
        } else {
          process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = previousSecurityWarningsSetting;
        }
      }
      this.loadEngineCache();
      if (this.engine) this.activateEngine(this.engine);
    } catch (error) {
      this.filterListStatus = 'error';
      this.filterListError = 'Açık kaynaklı reklam filtresi başlatılamadı; yerleşik temel kurallar kullanılmaya devam ediyor.';
      console.error('Could not initialize the Ghostery ad blocker:', error);
    }

    const elapsed = this.filterListUpdatedAt ? Date.now() - this.filterListUpdatedAt : FILTER_REFRESH_INTERVAL;
    const nextRefresh = Math.max(0, FILTER_REFRESH_INTERVAL - elapsed);
    if (this.engineModule) this.scheduleFilterRefresh(nextRefresh);
  }

  private registerRequestHandler(): void {
    this.browserSession?.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (!this.isShieldActive) {
        callback({ cancel: false });
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(details.url);
      } catch {
        callback({ cancel: false });
        return;
      }

      let siteHost = '';
      let sourceUrl = '';
      try {
        sourceUrl = details.referrer || details.webContents?.getURL() || '';
        siteHost = sourceUrl ? new URL(sourceUrl).hostname.toLowerCase() : '';
      } catch {
        siteHost = '';
      }

      const isSiteExcepted = details.resourceType !== 'mainFrame' && this.siteExceptions.has(siteHost);
      if (!isSiteExcepted) {
        const matchedDomain = matchesBlockedDomain(parsed.hostname, this.blockedDomains);
        const matchedPath = !matchedDomain && this.matchesBlockedPath(parsed);
        if (matchedDomain || matchedPath) {
          const domain = matchedDomain ?? `${parsed.hostname}${matchedPath}`;
          this.recordBlocked(`https://${domain}`, sourceUrl, details.resourceType);
          if (details.resourceType === 'mainFrame' && typeof details.webContentsId === 'number') {
            this.onBlockedMainFrame?.(details.webContentsId);
          }
          callback({ cancel: true });
          return;
        }

        const engine = this.engine;
        const engineModule = this.engineModule;
        if (engine && engineModule) {
          if (details.resourceType === 'mainFrame') {
            const result = engine.match(engineModule.fromElectronDetails(details));
            if (result.match || result.redirect) {
              if (typeof details.webContentsId === 'number') {
                this.onBlockedMainFrame?.(details.webContentsId);
              }
              callback(result.redirect ? { redirectURL: result.redirect.dataUrl } : { cancel: true });
              return;
            }
          } else {
            let engineResponse: Electron.CallbackResponse = {};
            engine.onBeforeRequest(details, response => { engineResponse = response; });
            if (engineResponse.cancel || engineResponse.redirectURL) {
              callback(engineResponse);
              return;
            }
          }
        }
      }

      if (
        details.resourceType === 'mainFrame' &&
        details.url.startsWith('http://') &&
        !details.url.startsWith('http://localhost') &&
        !details.url.startsWith('http://127.0.0.1')
      ) {
        this.httpsUpgradedCount++;
        callback({ redirectURL: details.url.replace(/^http:\/\//i, 'https://') });
        return;
      }

      callback({ cancel: false });
    });
  }

  private registerHeadersHandler(): void {
    this.browserSession?.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
      if (!this.isShieldActive || !this.engine) {
        callback({});
        return;
      }
      try {
        const source = details.resourceType === 'mainFrame'
          ? details.url
          : details.referrer || details.webContents?.getURL() || '';
        if (source && this.siteExceptions.has(new URL(source).hostname.toLowerCase())) {
          callback({});
          return;
        }
      } catch {
        // Continue with the engine for malformed or opaque origins.
      }
      this.engine.onHeadersReceived(details, callback);
    });
  }

  public getStats(): AdBlockerStats {
    return {
      adsBlocked: this.blockedCount,
      trackersBlocked: this.trackersCount,
      blockedPopups: this.blockedPopupsCount,
      httpsUpgraded: this.httpsUpgradedCount,
      isShieldActive: this.isShieldActive,
      filterListDomains: this.filterRuleCount || this.blockedDomains.size,
      filterListUpdatedAt: this.filterListUpdatedAt,
      filterListStatus: this.filterListStatus,
      ...(this.filterListError ? { filterListError: this.filterListError } : {}),
      allowedSites: [...this.siteExceptions].sort(),
      recentBlocked: [...this.recentBlocked],
    };
  }

  public setShieldActive(active: boolean): void {
    this.isShieldActive = active;
  }

  public shouldBlockPopup(sourceUrl: string, targetUrl: string): boolean {
    if (!this.isShieldActive) {
      return false;
    }

    if (isBlockedPopup(sourceUrl, targetUrl, this.blockedDomains, this.siteExceptions)) {
      this.recordBlocked(targetUrl, sourceUrl, 'popup');
      this.blockedPopupsCount++;
      return true;
    }

    try {
      if (this.siteExceptions.has(new URL(sourceUrl).hostname.toLowerCase())) return false;
    } catch {
      return false;
    }

    if (!this.engineModule || !this.engine) return false;
    const request = this.engineModule.Request.fromRawDetails({
      url: targetUrl,
      sourceUrl,
      type: 'mainFrame',
      _originalRequestDetails: { referrer: sourceUrl },
    });
    const result = this.engine.match(request);
    if (!result.match && !result.redirect) return false;
    this.blockedPopupsCount++;
    return true;
  }

  public setSiteAllowed(site: string, allowed: boolean): AdBlockerStats {
    const hostname = normalizeSiteException(site);
    if (!hostname || typeof allowed !== 'boolean') {
      throw new Error('Geçerli bir alan adı ve kalkan tercihi gerekli.');
    }

    const wasAllowed = this.siteExceptions.has(hostname);
    if (allowed && !wasAllowed && this.siteExceptions.size >= 1000) {
      throw new Error('En fazla 1000 site koruma istisnası kaydedilebilir.');
    }
    if (allowed) this.siteExceptions.add(hostname);
    else this.siteExceptions.delete(hostname);

    try {
      this.writeJsonAtomically(SITE_EXCEPTIONS_FILENAME, [...this.siteExceptions].sort());
    } catch (error) {
      if (wasAllowed) this.siteExceptions.add(hostname);
      else this.siteExceptions.delete(hostname);
      throw error;
    }
    return this.getStats();
  }

  public refreshFilterList(): Promise<AdBlockerStats> {
    if (!this.engineModule) {
      return Promise.reject(new Error('The open-source filter engine is not available.'));
    }
    if (this.filterRefresh) return this.filterRefresh;
    this.filterListStatus = 'updating';
    this.filterListError = undefined;
    this.filterRefresh = this.downloadFilterList()
      .then(stats => {
        this.scheduleFilterRefresh(FILTER_REFRESH_INTERVAL);
        return stats;
      })
      .catch(error => {
        this.scheduleFilterRefresh(60 * 60 * 1000);
        throw error;
      })
      .finally(() => {
        this.filterRefresh = undefined;
      });
    return this.filterRefresh;
  }

  private async downloadFilterList(): Promise<AdBlockerStats> {
    try {
      const engine = await this.engineModule!.ElectronBlocker.fromPrebuiltAdsAndTracking(
        this.fetchFilterList.bind(this),
      );
      const updatedAt = Date.now();
      this.writeBinaryAtomically(ENGINE_CACHE_FILENAME, engine.serialize());
      this.writeJsonAtomically(ENGINE_METADATA_FILENAME, { updatedAt });
      this.activateEngine(engine);
      this.filterListUpdatedAt = updatedAt;
      this.filterRuleCount = this.countFilterRules(engine);
      this.filterListStatus = 'ready';
      this.filterListError = undefined;
      return this.getStats();
    } catch (error) {
      this.filterListStatus = 'error';
      this.filterListError = 'Filtre listesi güncellenemedi; kayıtlı kurallar kullanılmaya devam ediyor.';
      throw error;
    }
  }

  private fetchFilterList(url: string): Promise<{ text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer>; json: () => Promise<unknown> }> {
    try {
      if (new URL(url).protocol !== 'https:') {
        return Promise.reject(new Error('Filter list URLs must use HTTPS.'));
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return fetch(url, {
      redirect: 'error',
      headers: { 'User-Agent': 'ZNY-Browser-Filter-Update' },
      signal: AbortSignal.timeout(20000),
    }).then(response => {
      if (!response.ok) throw new Error(`Filter list request failed with HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_FILTER_LIST_BYTES) throw new Error('Filter list exceeds the size limit');
      let body: Promise<ArrayBuffer> | undefined;
      const readBody = () => {
        if (!body) {
          body = response.arrayBuffer().then(buffer => {
            if (buffer.byteLength > MAX_FILTER_LIST_BYTES) {
              throw new Error('Filter list exceeds the size limit');
            }
            return buffer;
          });
        }
        return body;
      };
      return {
        text: async () => new TextDecoder().decode(await readBody()),
        arrayBuffer: readBody,
        json: async () => JSON.parse(new TextDecoder().decode(await readBody())) as unknown,
      };
    });
  }

  private loadEngineCache(): void {
    if (!this.engineModule) return;
    const enginePath = this.getDataPath(ENGINE_CACHE_FILENAME);
    try {
      const fileSize = fs.statSync(enginePath).size;
      if (fileSize === 0 || fileSize > MAX_ENGINE_CACHE_BYTES) {
        throw new Error('Cached filter engine has an invalid size.');
      }
      this.engine = this.engineModule.ElectronBlocker.deserialize(fs.readFileSync(enginePath));
      this.filterRuleCount = this.countFilterRules(this.engine);
      try {
        const metadata = JSON.parse(fs.readFileSync(this.getDataPath(ENGINE_METADATA_FILENAME), 'utf8')) as { updatedAt?: unknown };
        if (typeof metadata.updatedAt === 'number' && metadata.updatedAt <= Date.now() + 5 * 60 * 1000) {
          this.filterListUpdatedAt = metadata.updatedAt;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('Could not load Ghostery filter metadata:', error);
        }
      }
      this.filterListStatus = 'ready';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Could not load the cached Ghostery filter engine:', error);
      }
    }
  }

  private activateEngine(engine: ElectronBlocker): void {
    if (!this.browserSession || !this.engineModule) {
      throw new Error('Ad blocker session has not been initialized.');
    }
    if (this.engine && this.engine !== engine) {
      this.engine.disableBlockingInSession(this.browserSession);
    }
    engine.enableBlockingInSession(this.browserSession);
    this.engine = engine;
    engine.on('request-blocked', (request) => {
      this.recordBlocked(request.url, this.getRequestReferrer(request), request.type);
    });
    engine.on('request-redirected', (request) => {
      this.recordBlocked(request.url, this.getRequestReferrer(request), request.type);
    });
    ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters');
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (event, url: string, msg?: IBackgroundCallback) => {
      try {
        if (
          !this.isShieldActive ||
          this.siteExceptions.has(new URL(url).hostname.toLowerCase())
        ) return;
      } catch {
        return;
      }
      return this.engine?.onInjectCosmeticFilters(event, url, msg);
    });
    ipcMain.removeHandler('@ghostery/adblocker/is-mutation-observer-enabled');
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', event => {
      return this.isShieldActive && (this.engine?.onIsMutationObserverEnabled(event) ?? false);
    });
    this.registerRequestHandler();
    this.registerHeadersHandler();
  }

  private recordBlocked(url: string, sourceUrl: string, resourceType: string): void {
    let domain = url;
    let site = 'Bilinmeyen site';
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      // Keep the original value for path-based fallback rules.
    }
    try {
      if (sourceUrl) site = new URL(sourceUrl).hostname.toLowerCase();
    } catch {
      // Keep the unknown-site label for invalid or opaque origins.
    }

    const category = TRACKER_PATTERN.test(domain) ? 'tracker' : 'ad';
    if (category === 'tracker') this.trackersCount++;
    else this.blockedCount++;
    this.recentBlocked.unshift({
      domain,
      site,
      resourceType,
      timestamp: Date.now(),
      category,
    });
    this.recentBlocked = this.recentBlocked.slice(0, MAX_RECENT_BLOCKS);
  }

  private getRequestReferrer(request: Request): string {
    const referrer = request._originalRequestDetails?.referrer;
    return typeof referrer === 'string' ? referrer : '';
  }

  private countFilterRules(engine: ElectronBlocker): number {
    return engine.filters.getFilters().length +
      engine.exceptions.getFilters().length +
      engine.importants.getFilters().length +
      engine.redirects.getFilters().length +
      engine.removeparams.getFilters().length +
      engine.csp.getFilters().length +
      engine.hideExceptions.getFilters().length +
      engine.cosmetics.getFilters().length;
  }

  private loadFilterCache(): void {
    const cachePath = this.getDataPath(FILTER_CACHE_FILENAME);
    try {
      if (fs.statSync(cachePath).size > MAX_FILTER_LIST_BYTES * 2) {
        throw new Error('Cached filter list exceeds the size limit');
      }
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as { updatedAt?: unknown; domains?: unknown };
      if (!Array.isArray(cache.domains) || typeof cache.updatedAt !== 'number') {
        throw new Error('Cached filter list has an invalid format');
      }
      const domains = cache.domains
        .filter((domain): domain is string => typeof domain === 'string')
        .map(normalizeFilterDomain)
        .filter((domain): domain is string => domain !== null);
      if (domains.length < MIN_FILTER_DOMAINS || domains.length > MAX_FILTER_DOMAINS) {
        throw new Error('Cached filter list has an unexpected number of domains');
      }
      this.blockedDomains = new Set([...DEFAULT_BLOCKED_DOMAINS, ...domains]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Could not load the cached ad and tracker filter list:', error);
      }
    }
  }

  private loadSiteExceptions(): void {
    try {
      const filePath = this.getDataPath(SITE_EXCEPTIONS_FILENAME);
      if (fs.statSync(filePath).size > 256 * 1024) throw new Error('Site exception list exceeds the size limit');
      const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      if (!Array.isArray(persisted)) throw new Error('Site exception list has an invalid format');
      this.siteExceptions = new Set(persisted
        .filter((site): site is string => typeof site === 'string')
        .map(normalizeSiteException)
        .filter((site): site is string => site !== null)
        .slice(0, 1000));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Could not load ad blocker site exceptions:', error);
      }
    }
  }

  private writeJsonAtomically(filename: string, value: unknown): void {
    const filePath = this.getDataPath(filename);
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  private writeBinaryAtomically(filename: string, contents: Uint8Array): void {
    if (contents.byteLength === 0 || contents.byteLength > MAX_ENGINE_CACHE_BYTES) {
      throw new Error('Downloaded filter engine has an invalid size.');
    }
    const filePath = this.getDataPath(filename);
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, contents);
    fs.renameSync(temporaryPath, filePath);
  }

  private getDataPath(filename: string): string {
    if (!this.userDataPath) throw new Error('Ad blocker storage has not been initialized.');
    return path.join(this.userDataPath, filename);
  }

  private scheduleFilterRefresh(delay: number): void {
    if (this.filterRefreshTimer) clearTimeout(this.filterRefreshTimer);
    this.filterRefreshTimer = setTimeout(() => {
      this.filterRefreshTimer = undefined;
      void this.refreshFilterList().catch(error => {
        console.error('Could not refresh the ad and tracker filter list:', error);
      });
    }, delay);
    this.filterRefreshTimer.unref();
  }

  private matchesBlockedPath(url: URL): string | null {
    if (
      (url.hostname === 'facebook.net' || url.hostname.endsWith('.facebook.net')) &&
      (url.pathname + url.search).includes('/en_US/fbevents.js')
    ) {
      return '/en_US/fbevents.js';
    }
    return null;
  }
}

export const adBlocker = new AdBlockerService();
