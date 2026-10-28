import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ChromeHistoryImportResult, HistoryItem } from './types';
import { ChromeImporter } from './chrome-importer';
import { getChromeProfilePath } from './chrome-profiles';

const CHROMIUM_EPOCH_OFFSET_MS = 11_644_473_600_000;
const MAX_IMPORTED_VISITS = 10_000;

export class ChromeHistoryImporter {
  public static importHistoryForProfile(profileId: string): ChromeHistoryImportResult {
    const profilePath = getChromeProfilePath(profileId);
    if (!profilePath) {
      return {
        status: 'no_profile',
        items: [],
        errorMessage: 'Seçilen Chrome profili bulunamadı.',
      };
    }
    return this.importHistory(profilePath);
  }

  private static getProfileDirectories(selectedPath?: string): string[] {
    const root = selectedPath || ChromeImporter.getChromeUserDataPath();
    if (!root) return [];

    try {
      if (fs.statSync(root).isFile()) {
        return path.basename(root).toLowerCase() === 'history' ? [path.dirname(root)] : [];
      }

      if (fs.existsSync(path.join(root, 'History'))) return [root];

      return fs.readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(root, entry.name))
        .filter(profilePath => fs.existsSync(path.join(profilePath, 'History')));
    } catch (error) {
      console.warn('Could not scan Chrome history profile directories:', error);
      return [];
    }
  }

  public static importHistory(selectedPath?: string): ChromeHistoryImportResult {
    const profiles = this.getProfileDirectories(selectedPath);
    if (profiles.length === 0) {
      return {
        status: selectedPath ? 'no_history' : 'no_profile',
        items: [],
        errorMessage: selectedPath
          ? 'Seçilen klasörde Chrome History veritabanı bulunamadı.'
          : 'Chrome profili bulunamadı.',
      };
    }

    const items: HistoryItem[] = [];
    const errors: string[] = [];

    for (const [profileIndex, profilePath] of profiles.entries()) {
      const historyPath = path.join(profilePath, 'History');
      let database: DatabaseSync | undefined;

      try {
        database = new DatabaseSync(historyPath, { readOnly: true });
        const columns = database.prepare('PRAGMA table_info(keyword_search_terms)').all() as Array<{ name: string }>;
        const hasSearchTerms = columns.some(column => column.name === 'term' || column.name === 'normalized_term');
        const searchColumn = columns.some(column => column.name === 'normalized_term') ? 'normalized_term' : 'term';
        const searchJoin = hasSearchTerms
          ? `LEFT JOIN keyword_search_terms AS search_terms ON search_terms.url_id = urls.id`
          : '';
        const searchSelect = hasSearchTerms ? `search_terms.${searchColumn} AS search_term` : 'NULL AS search_term';
        const remaining = MAX_IMPORTED_VISITS - items.length;
        if (remaining <= 0) break;

        const rows = database.prepare(`
          SELECT visits.id AS visit_id, urls.url, urls.title,
            CAST(visits.visit_time / 1000 AS INTEGER) - ${CHROMIUM_EPOCH_OFFSET_MS} AS visit_time_ms,
            ${searchSelect}
          FROM visits
          INNER JOIN urls ON urls.id = visits.url
          ${searchJoin}
          WHERE urls.url LIKE 'http://%' OR urls.url LIKE 'https://%'
          ORDER BY visits.visit_time DESC
          LIMIT ?
        `).all(remaining) as Array<{
          visit_id: number;
          url: string;
          title: string | null;
          visit_time_ms: number;
          search_term: string | null;
        }>;

        for (const row of rows) {
          items.push({
            id: `chrome-${profileIndex}-${row.visit_id}`,
            title: row.title?.trim() || row.url,
            url: row.url,
            visitTime: Math.max(0, row.visit_time_ms),
            searchTerm: row.search_term?.trim() || undefined,
          });
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Chrome geçmişi okunamadı.');
        console.error(`Could not import Chrome history from ${historyPath}:`, error);
      } finally {
        database?.close();
      }
    }

    if (items.length > 0) return { status: 'success', items };
    if (errors.length > 0) {
      return { status: 'read_error', items: [], errorMessage: errors[0] };
    }
    return {
      status: 'no_history',
      items: [],
      errorMessage: 'Chrome profilinde içe aktarılabilecek ziyaret geçmişi bulunamadı.',
    };
  }
}
