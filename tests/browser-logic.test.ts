import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeUrlOrSearch,
  selectTabForSpace,
  shouldTabHibernate,
  hibernateIdleTabs,
  deduplicateBookmarks,
  parseChromeBookmarkTree,
  shouldFetchSearchSuggestions,
  shouldPerformTranslation,
  mergeChromeBookmarkProfiles,
  getNavigationErrorMessage,
  isNavigationAborted,
} from '../src/utils/browser-logic.ts';
import { Tab } from '../src/types/index.ts';
import { isAllowedWebviewSource, isSafeWebUrl, isTrustedAppFrameUrl } from '../electron/security-policy.ts';
import { getBrowserShortcut } from '../electron/shortcut-logic.ts';
import { ChromeImporter } from '../electron/chrome-importer.ts';
import { getChromeProfiles } from '../electron/chrome-profiles.ts';
import { getPermissionLabel, getSecurePermissionOrigin, isSitePermission } from '../electron/site-permissions.ts';
import {
  isBlockedPopup,
  matchesBlockedDomain,
  normalizeFilterDomain,
  normalizeSiteException,
  parseHostsFilterList,
} from '../electron/adblocker-logic.ts';

describe('ZNY Browser Pure Logic Tests', () => {
  describe('Browser keyboard shortcuts', () => {
    const shortcut = (key: string, modifiers: Partial<{ control: boolean; meta: boolean; alt: boolean; shift: boolean }> = {}) =>
      getBrowserShortcut({
        key,
        control: modifiers.control ?? true,
        meta: modifiers.meta ?? false,
        alt: modifiers.alt ?? false,
        shift: modifiers.shift ?? false,
      });

    it('supports tab creation, closing, restoration, and indexed navigation', () => {
      assert.equal(shortcut('t'), 'new-tab');
      assert.equal(shortcut('w'), 'close-tab');
      assert.equal(shortcut('t', { shift: true }), 'reopen-closed-tab');
      assert.equal(shortcut('4'), 'select-tab-4');
      assert.equal(shortcut('9'), 'select-last-tab');
      assert.equal(shortcut('d'), 'bookmark-page');
      assert.equal(shortcut('d', { shift: true }), 'bookmark-all-tabs');
      assert.equal(shortcut('Tab'), 'next-tab');
      assert.equal(shortcut('Tab', { shift: true }), 'previous-tab');
      assert.equal(shortcut('=', { shift: true }), 'zoom-in');
    });

    it('maps browser actions without intercepting unrelated page shortcuts', () => {
      assert.equal(shortcut('r', { shift: true }), 'hard-reload');
      assert.equal(shortcut('0'), 'zoom-reset');
      assert.equal(shortcut('c'), null);
      assert.equal(shortcut('ArrowLeft', { alt: true, control: false }), 'navigate-back');
      assert.equal(getBrowserShortcut({ key: 'F11', control: false, meta: false, alt: false, shift: false }), 'toggle-fullscreen');
    });
  });

  describe('Chrome bookmark importer', () => {
    it('discovers bookmark files in custom-named profiles and imports a selected profile folder', () => {
      const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'zny-chrome-import-'));
      try {
        const profilePath = path.join(userDataPath, 'Work Profile');
        fs.mkdirSync(profilePath);
        fs.writeFileSync(path.join(profilePath, 'Bookmarks'), JSON.stringify({
          roots: {
            bookmark_bar: {
              type: 'folder',
              name: 'Bookmarks bar',
              children: [{ type: 'url', name: 'Work', url: 'https://example.com' }],
            },
          },
        }));

        assert.deepEqual(ChromeImporter.findBookmarksFiles(userDataPath), [path.join(profilePath, 'Bookmarks')]);

        const result = ChromeImporter.importBookmarks(profilePath);
        assert.equal(result.status, 'success');
        assert.equal(result.profileCount, 1);
        assert.equal(result.bookmarks[0].title, 'Work');
      } finally {
        fs.rmSync(userDataPath, { recursive: true, force: true });
      }
    });

    describe('Site permission validation', () => {
      it('limits site prompts to supported permissions on secure origins', () => {
        assert.equal(getSecurePermissionOrigin('https://example.com/path?q=1'), 'https://example.com');
        assert.equal(getSecurePermissionOrigin('http://example.com'), null);
        assert.equal(getSecurePermissionOrigin('file:///private'), null);
        assert.equal(getSecurePermissionOrigin('not a url'), null);
        assert.equal(isSitePermission('geolocation'), true);
        assert.equal(isSitePermission('media'), true);
        assert.equal(isSitePermission('display-capture'), false);
        assert.equal(getPermissionLabel('media', ['audio', 'video']), 'kamera ve mikrofon');
        assert.equal(getPermissionLabel('media', ['video']), 'kamera');
      });
    });

    it('discovers named profiles and imports only the selected profile bookmarks', () => {
      const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'zny-chrome-profiles-'));
      try {
        const defaultPath = path.join(userDataPath, 'Default');
        const workPath = path.join(userDataPath, 'Profile 1');
        fs.mkdirSync(defaultPath);
        fs.mkdirSync(workPath);
        fs.writeFileSync(path.join(userDataPath, 'Local State'), JSON.stringify({
          profile: { info_cache: { Default: { name: 'Kişisel' }, 'Profile 1': { name: 'Emir' } } },
        }));
        const makeBookmarks = (title: string) => JSON.stringify({
          roots: {
            bookmark_bar: {
              type: 'folder',
              name: 'Bookmarks bar',
              children: [{ type: 'url', name: title, url: `https://${title.toLowerCase()}.example` }],
            },
          },
        });
        fs.writeFileSync(path.join(defaultPath, 'Bookmarks'), makeBookmarks('Personal'));
        fs.writeFileSync(path.join(workPath, 'Bookmarks'), makeBookmarks('Work'));
        fs.writeFileSync(path.join(workPath, 'History'), '');

        assert.deepEqual(
          getChromeProfiles(userDataPath).map(({ id, name, hasBookmarks, hasHistory }) => ({ id, name, hasBookmarks, hasHistory })),
          [
            { id: 'Default', name: 'Kişisel', hasBookmarks: true, hasHistory: false },
            { id: 'Profile 1', name: 'Emir', hasBookmarks: true, hasHistory: true },
          ],
        );
        assert.equal(ChromeImporter.importBookmarksForProfile(workPath).bookmarks[0].title, 'Work');
      } finally {
        fs.rmSync(userDataPath, { recursive: true, force: true });
      }
    });
  });

  describe('Electron Security Policy', () => {
    it('allows only HTTP and HTTPS webview URLs', () => {
      assert.equal(isSafeWebUrl('https://example.com'), true);
      assert.equal(isSafeWebUrl('http://example.com'), true);
      assert.equal(isSafeWebUrl('file:///C:/secret.txt'), false);
      assert.equal(isSafeWebUrl('javascript:alert(1)'), false);
      assert.equal(isSafeWebUrl('data:text/html,hello'), false);
      assert.equal(isAllowedWebviewSource('about:blank'), true);
      assert.equal(isAllowedWebviewSource('file:///C:/secret.txt'), false);
    });

    describe('Ad and tracker filter list', () => {
      it('parses valid hosts-file entries and ignores comments, local entries, and invalid domains', () => {
        assert.deepEqual(
          parseHostsFilterList([
            '0.0.0.0 ads.example.test tracker.example.test # block',
            '127.0.0.1 localhost.localdomain',
            '127.0.0.1 pixel.example.test',
            '::1 ipv6.example.test',
            '0.0.0.0 -invalid.example.test',
          ].join('\n')),
          ['ads.example.test', 'tracker.example.test', 'pixel.example.test'],
        );
      });

      it('matches exact domains and their subdomains without matching lookalikes', () => {
        const blocked = new Set(['doubleclick.net']);
        assert.equal(matchesBlockedDomain('doubleclick.net', blocked), 'doubleclick.net');
        assert.equal(matchesBlockedDomain('ads.doubleclick.net', blocked), 'doubleclick.net');
        assert.equal(matchesBlockedDomain('notdoubleclick.net', blocked), null);
      });

      it('blocks popups to filtered ad domains but respects site exceptions and safe destinations', () => {
        const blocked = new Set(['ads.example.test', 'track.example.test']);
        const exceptions = new Set(['publisher.example']);
        assert.equal(isBlockedPopup('https://news.example/page', 'https://ads.example.test/offer', blocked, exceptions), true);
        assert.equal(isBlockedPopup('https://news.example/page', 'https://sub.ads.example.test/offer', blocked, exceptions), true);
        assert.equal(isBlockedPopup('https://news.example/page', 'https://shop.example.test/', blocked, exceptions), false);
        assert.equal(isBlockedPopup('https://news.example/page', 'javascript:alert(1)', blocked, exceptions), false);
        assert.equal(isBlockedPopup('https://publisher.example/page', 'https://ads.example.test/', blocked, exceptions), false);
      });

      it('normalizes allowlist domains and rejects URLs, IP addresses, and malformed values', () => {
        assert.equal(normalizeFilterDomain(' Ads.Example.Test. '), 'ads.example.test');
        assert.equal(normalizeSiteException('example.test'), 'example.test');
        assert.equal(normalizeSiteException('https://example.test'), null);
        assert.equal(normalizeSiteException('127.0.0.1'), null);
        assert.equal(normalizeSiteException('bad domain'), null);
      });
    });

    it('trusts only the configured app document in production', () => {
      assert.equal(
        isTrustedAppFrameUrl('file:///app/dist/index.html', undefined, 'file:///app/dist/index.html'),
        true,
      );
      assert.equal(
        isTrustedAppFrameUrl('file:///app/other.html', undefined, 'file:///app/dist/index.html'),
        false,
      );
    });

    it('trusts only the configured Vite origin and path in development', () => {
      assert.equal(
        isTrustedAppFrameUrl('http://localhost:5173/', 'http://localhost:5173/', 'file:///app/index.html'),
        true,
      );
      assert.equal(
        isTrustedAppFrameUrl('http://localhost:5173/attacker', 'http://localhost:5173/', 'file:///app/index.html'),
        false,
      );
      assert.equal(
        isTrustedAppFrameUrl('http://evil.example/', 'http://localhost:5173/', 'file:///app/index.html'),
        false,
      );
    });
  });


  describe('normalizeUrlOrSearch', () => {
    it('should return empty string for empty or whitespace-only inputs', () => {
      assert.strictEqual(normalizeUrlOrSearch(''), '');
      assert.strictEqual(normalizeUrlOrSearch('   '), '');
    });

    it('should preserve existing http and https protocols', () => {
      assert.strictEqual(normalizeUrlOrSearch('https://github.com'), 'https://github.com');
      assert.strictEqual(normalizeUrlOrSearch('http://insecure.site.org/index.html'), 'http://insecure.site.org/index.html');
      assert.strictEqual(normalizeUrlOrSearch('  https://google.com/test  '), 'https://google.com/test');
    });

    it('should preserve about:blank but block unsafe protocols (javascript, file, data, custom) by converting to search', () => {
      assert.strictEqual(normalizeUrlOrSearch('about:blank'), 'about:blank');
      assert.strictEqual(
        normalizeUrlOrSearch('javascript:alert(1)'),
        'https://www.google.com/search?q=javascript%3Aalert(1)'
      );
      assert.strictEqual(
        normalizeUrlOrSearch('file:///c:/path/to/file.html'),
        'https://www.google.com/search?q=file%3A%2F%2F%2Fc%3A%2Fpath%2Fto%2Ffile.html'
      );
      assert.strictEqual(
        normalizeUrlOrSearch('data:text/html,<b>hi</b>'),
        'https://www.google.com/search?q=data%3Atext%2Fhtml%2C%3Cb%3Ehi%3C%2Fb%3E'
      );
    });

    it('should prepend https:// for domains with known TLDs or dots without spaces', () => {
      assert.strictEqual(normalizeUrlOrSearch('github.com'), 'https://github.com');
      assert.strictEqual(normalizeUrlOrSearch('sub.domain.org/path/item'), 'https://sub.domain.org/path/item');
      assert.strictEqual(normalizeUrlOrSearch('docs.rs'), 'https://docs.rs');
    });

    it('should handle localhost and IP addresses with ports', () => {
      assert.strictEqual(normalizeUrlOrSearch('localhost:3000'), 'http://localhost:3000');
      assert.strictEqual(normalizeUrlOrSearch('localhost'), 'http://localhost');
      assert.strictEqual(normalizeUrlOrSearch('127.0.0.1:8080'), 'http://127.0.0.1:8080');
      assert.strictEqual(normalizeUrlOrSearch('192.168.1.1'), 'http://192.168.1.1');
    });

    it('should convert multi-word queries into Google search URLs', () => {
      assert.strictEqual(
        normalizeUrlOrSearch('typescript tutorial'),
        'https://www.google.com/search?q=typescript%20tutorial'
      );
      assert.strictEqual(
        normalizeUrlOrSearch('react 19 state management'),
        'https://www.google.com/search?q=react%2019%20state%20management'
      );
    });

    it('should convert single words without dot or port into Google search URLs', () => {
      assert.strictEqual(
        normalizeUrlOrSearch('apple'),
        'https://www.google.com/search?q=apple'
      );
      assert.strictEqual(
        normalizeUrlOrSearch('electron'),
        'https://www.google.com/search?q=electron'
      );
    });

    it('should treat trailing dots or invalid domains as searches', () => {
      assert.strictEqual(
        normalizeUrlOrSearch('word.'),
        'https://www.google.com/search?q=word.'
      );
      assert.strictEqual(
        normalizeUrlOrSearch('.hidden'),
        'https://www.google.com/search?q=.hidden'
      );
    });
  });

  describe('Navigation error handling', () => {
    it('ignores expected navigation cancellations', () => {
      assert.equal(isNavigationAborted(-3), true);
      assert.equal(isNavigationAborted(undefined, 'net::ERR_ABORTED'), true);
      assert.equal(isNavigationAborted(-105, 'net::ERR_NAME_NOT_RESOLVED'), false);
    });

    it('maps common network failures to actionable Turkish messages', () => {
      assert.match(getNavigationErrorMessage(-106), /İnternet bağlantınız kesilmiş/);
      assert.match(getNavigationErrorMessage(-105), /site adresi bulunamadı/);
      assert.match(getNavigationErrorMessage(-102), /bağlantıyı reddetti/);
      assert.match(getNavigationErrorMessage(-7), /Site yanıt vermedi/);
      assert.match(getNavigationErrorMessage(-202), /Güvenli bağlantı kurulamadı/);
    });

    it('does not expose raw Chromium error text for unknown failures', () => {
      const message = getNavigationErrorMessage(-999, 'net::ERR_UNEXPECTED');
      assert.match(message, /Sayfa yüklenemedi/);
      assert.equal(message.includes('ERR_UNEXPECTED'), false);
    });
  });

  describe('selectTabForSpace', () => {
    const tabs: Tab[] = [
      {
        id: 'tab-1',
        url: 'https://github.com',
        title: 'GitHub',
        spaceId: 'work',
        isActive: false,
        isPinned: false,
        isHibernated: false,
        isLoading: false,
        lastAccessed: 100,
      },
      {
        id: 'tab-2',
        url: 'https://gitlab.com',
        title: 'GitLab',
        spaceId: 'work',
        isActive: true,
        isPinned: false,
        isHibernated: false,
        isLoading: false,
        lastAccessed: 200,
      },
      {
        id: 'tab-3',
        url: 'https://youtube.com',
        title: 'YouTube',
        spaceId: 'personal',
        isActive: false,
        isPinned: false,
        isHibernated: false,
        isLoading: false,
        lastAccessed: 150,
      },
    ];

    it('should select active tab in target space if present', () => {
      const selected = selectTabForSpace(tabs, 'work');
      assert.strictEqual(selected?.id, 'tab-2');
    });

    it('should select the first tab in space if no active tab in that space', () => {
      const selected = selectTabForSpace(tabs, 'personal');
      assert.strictEqual(selected?.id, 'tab-3');
    });

    it('should return null if the target space has no tabs', () => {
      const selected = selectTabForSpace(tabs, 'empty-space');
      assert.strictEqual(selected, null);
    });

    it('should return null for empty tab list', () => {
      const selected = selectTabForSpace([], 'work');
      assert.strictEqual(selected, null);
    });
  });

  describe('shouldTabHibernate', () => {
    const NOW = 1000000;
    const THRESHOLD = 60000; // 60 seconds

    const baseTab: Tab = {
      id: 'tab-test',
      url: 'https://example.com',
      title: 'Example',
      spaceId: 'default',
      isActive: false,
      isPinned: false,
      isHibernated: false,
      isLoading: false,
      lastAccessed: NOW - 70000, // 70s ago (> 60s)
    };

    it('should return true for idle inactive unpinned tab past threshold', () => {
      assert.strictEqual(
        shouldTabHibernate(baseTab, 'other-tab', false, null, THRESHOLD, NOW),
        true
      );
    });

    it('should never hibernate the active tab', () => {
      assert.strictEqual(
        shouldTabHibernate({ ...baseTab, isActive: true }, 'tab-test', false, null, THRESHOLD, NOW),
        false
      );
      // Even if tab.isActive was false in model but passed as activeTabId
      assert.strictEqual(
        shouldTabHibernate(baseTab, 'tab-test', false, null, THRESHOLD, NOW),
        false
      );
    });

    it('should never hibernate a pinned tab', () => {
      assert.strictEqual(
        shouldTabHibernate({ ...baseTab, isPinned: true }, 'other-tab', false, null, THRESHOLD, NOW),
        false
      );
    });

    it('should never hibernate a split screen tab', () => {
      assert.strictEqual(
        shouldTabHibernate(baseTab, 'other-tab', true, 'tab-test', THRESHOLD, NOW),
        false
      );
    });

    it('should not hibernate tabs that were accessed recently within threshold', () => {
      const recentTab: Tab = {
        ...baseTab,
        lastAccessed: NOW - 30000, // 30s ago (< 60s)
      };
      assert.strictEqual(
        shouldTabHibernate(recentTab, 'other-tab', false, null, THRESHOLD, NOW),
        false
      );
    });

    it('should not hibernate already hibernated tabs', () => {
      assert.strictEqual(
        shouldTabHibernate({ ...baseTab, isHibernated: true }, 'other-tab', false, null, THRESHOLD, NOW),
        false
      );
    });

    it('should not hibernate tabs without lastAccessed timestamp', () => {
      assert.strictEqual(
        shouldTabHibernate({ ...baseTab, lastAccessed: undefined }, 'other-tab', false, null, THRESHOLD, NOW),
        false
      );
    });
  });

  describe('hibernateIdleTabs', () => {
    const now = 1000000;
    const staleTab: Tab = {
      id: 'stale',
      spaceId: 'default',
      title: 'Stale',
      url: 'https://example.com',
      isPinned: false,
      isHibernated: false,
      lastAccessed: now - 70000,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
    };

    it('preserves the original tabs array when no tab needs hibernation', () => {
      const tabs = [{ ...staleTab, lastAccessed: now }];
      assert.strictEqual(hibernateIdleTabs(tabs, 'active', false, null, 60000, now), tabs);
    });

    it('only creates a new array and tab object for tabs entering hibernation', () => {
      const tabs = [staleTab, { ...staleTab, id: 'recent', lastAccessed: now }];
      const result = hibernateIdleTabs(tabs, 'active', false, null, 60000, now);
      assert.notStrictEqual(result, tabs);
      assert.equal(result[0].isHibernated, true);
      assert.equal(result[1], tabs[1]);
    });
  });

  describe('deduplicateBookmarks', () => {
    it('should remove duplicate bookmarks having identical URLs', () => {
      const items = [
        { id: '1', title: 'Google', url: 'https://google.com' },
        { id: '2', title: 'Google Search', url: 'https://google.com/' },
        { id: '3', title: 'GitHub', url: 'https://github.com' },
      ];
      const result = deduplicateBookmarks(items);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, 'Google');
      assert.strictEqual(result[1].title, 'GitHub');
    });

    it('should return empty list when input is empty', () => {
      assert.deepStrictEqual(deduplicateBookmarks([]), []);
    });

    it('should handle case differences in URL schemes and domains gracefully', () => {
      const items = [
        { id: '1', title: 'A', url: 'https://example.com/test' },
        { id: '2', title: 'B', url: 'HTTPS://example.com/test' },
      ];
      const result = deduplicateBookmarks(items);
      assert.strictEqual(result.length, 1);
    });

    it('should merge two lists without duplicating existing URLs', () => {
      const existing = [
        { id: '1', title: 'Google', url: 'https://google.com' },
      ];
      const incoming = [
        { id: '2', title: 'Google Duplicate', url: 'https://google.com/' },
        { id: '3', title: 'Vite', url: 'https://vitejs.dev' },
      ];
      const result = deduplicateBookmarks(existing, incoming);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, 'Google');
      assert.strictEqual(result[1].title, 'Vite');
    });
  });

  describe('parseChromeBookmarkTree', () => {
    it('should recursively parse bookmark folders and construct folder paths', () => {
      const chromeTree = {
        roots: {
          bookmark_bar: {
            name: 'Bookmarks Bar',
            children: [
              {
                name: 'Search Engine',
                url: 'https://google.com',
              },
              {
                name: 'Dev Tools',
                children: [
                  {
                    name: 'GitHub',
                    url: 'https://github.com',
                  },
                  {
                    name: 'Sub Folder',
                    children: [
                      {
                        name: 'Docs',
                        url: 'https://docs.rs',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          other: {
            name: 'Other Bookmarks',
            children: [
              {
                name: 'News',
                url: 'https://news.ycombinator.com',
              },
            ],
          },
        },
      };

      const result = parseChromeBookmarkTree(chromeTree);
      assert.strictEqual(result.length, 4);

      assert.strictEqual(result[0].title, 'Search Engine');
      assert.strictEqual(result[0].url, 'https://google.com');
      assert.strictEqual(result[0].folder, 'Yer İmleri Çubuğu');

      assert.strictEqual(result[1].title, 'GitHub');
      assert.strictEqual(result[1].folder, 'Yer İmleri Çubuğu / Dev Tools');

      assert.strictEqual(result[2].title, 'Docs');
      assert.strictEqual(result[2].folder, 'Yer İmleri Çubuğu / Dev Tools / Sub Folder');

      assert.strictEqual(result[3].title, 'News');
      assert.strictEqual(result[3].folder, 'Diğer Yer İmleri');
    });

    it('should safely return empty array for null, empty or invalid tree input', () => {
      assert.deepStrictEqual(parseChromeBookmarkTree(null), []);
      assert.deepStrictEqual(parseChromeBookmarkTree({}), []);
      assert.deepStrictEqual(parseChromeBookmarkTree({ roots: {} }), []);
    });

    it('should skip invalid nodes missing urls and children', () => {
      const corruptTree = {
        roots: {
          bookmark_bar: {
            children: [
              { name: 'Corrupt 1' },
              { name: 'Valid', url: 'https://valid.org' },
              null,
              undefined,
            ],
          },
        },
      };

      const result = parseChromeBookmarkTree(corruptTree);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Valid');
    });
  });

  describe('Privacy Preferences & External Service Guards', () => {
    describe('shouldFetchSearchSuggestions', () => {
      it('should return false if search suggestions are disabled by user preference', () => {
        assert.strictEqual(shouldFetchSearchSuggestions(false, 'typescript'), false);
        assert.strictEqual(shouldFetchSearchSuggestions(false, 'https://github.com'), false);
      });

      it('should return false for empty or whitespace-only queries even if enabled', () => {
        assert.strictEqual(shouldFetchSearchSuggestions(true, ''), false);
        assert.strictEqual(shouldFetchSearchSuggestions(true, '   '), false);
      });

      it('should return false for excessively long queries exceeding safety threshold', () => {
        const longQuery = 'a'.repeat(301);
        assert.strictEqual(shouldFetchSearchSuggestions(true, longQuery), false);
      });

      it('should return true for valid queries when enabled', () => {
        assert.strictEqual(shouldFetchSearchSuggestions(true, 'electron vite'), true);
        assert.strictEqual(shouldFetchSearchSuggestions(true, 'react 19'), true);
      });
    });

    describe('shouldPerformTranslation', () => {
      it('should return false if selection translation is disabled by user preference', () => {
        assert.strictEqual(shouldPerformTranslation(false, 'Hello world'), false);
      });

      it('should return false for single character, empty, or whitespace-only selections', () => {
        assert.strictEqual(shouldPerformTranslation(true, ''), false);
        assert.strictEqual(shouldPerformTranslation(true, ' '), false);
        assert.strictEqual(shouldPerformTranslation(true, 'a'), false);
      });

      it('should return false for text exceeding maximum translation character limit', () => {
        const hugeText = 'a'.repeat(4001);
        assert.strictEqual(shouldPerformTranslation(true, hugeText), false);
      });

      it('should return true for valid selected text when enabled', () => {
        assert.strictEqual(shouldPerformTranslation(true, 'Hello world, how are you?'), true);
      });
    });
  });

  describe('mergeChromeBookmarkProfiles', () => {
    it('should merge bookmarks from multiple profiles and remove duplicates across profiles', () => {
      const defaultProfile = {
        roots: {
          bookmark_bar: {
            children: [
              { name: 'Google', url: 'https://google.com/' },
              { name: 'GitHub', url: 'https://github.com' },
            ],
          },
        },
      };

      const workProfile = {
        roots: {
          bookmark_bar: {
            children: [
              { name: 'Google Duplicate', url: 'https://google.com' }, // Duplicate with different trailing slash
              { name: 'GitLab', url: 'https://gitlab.com' },
            ],
          },
        },
      };

      const merged = mergeChromeBookmarkProfiles([defaultProfile, workProfile]);
      assert.strictEqual(merged.length, 3);
      assert.strictEqual(merged[0].title, 'Google');
      assert.strictEqual(merged[1].title, 'GitHub');
      assert.strictEqual(merged[2].title, 'GitLab');
    });

    it('should return empty list for empty profiles array or invalid input', () => {
      assert.deepStrictEqual(mergeChromeBookmarkProfiles([]), []);
      assert.deepStrictEqual(mergeChromeBookmarkProfiles(null as any), []);
    });
  });

});
