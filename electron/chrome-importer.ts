import fs from 'fs';
import path from 'path';
import os from 'os';
import { Bookmark, ChromeImportResult } from './types';

export class ChromeImporter {
  public static getChromeUserDataPath(): string | null {
    const userRoots = [process.env.LOCALAPPDATA, os.homedir() && path.join(os.homedir(), 'AppData', 'Local')]
      .filter((value): value is string => Boolean(value));
    const candidates = [...new Set(userRoots.map(root => path.join(root, 'Google', 'Chrome', 'User Data')))];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
    return null;
  }

  public static getChromeDataPath(): string | null {
    const userData = this.getChromeUserDataPath();
    if (!userData) return null;

    const chromeDefault = path.join(userData, 'Default');
    if (fs.existsSync(chromeDefault)) {
      return chromeDefault;
    }
    return userData;
  }

  public static findBookmarksFiles(userData = this.getChromeUserDataPath()): string[] {
    if (!userData) return [];

    try {
      if (!fs.statSync(userData).isDirectory()) {
        return path.basename(userData).toLowerCase() === 'bookmarks' ? [userData] : [];
      }
    } catch {
      return [];
    }

    const files: string[] = [];
    const addBookmarksFile = (profilePath: string) => {
      const bookmarksFile = path.join(profilePath, 'Bookmarks');
      try {
        if (fs.statSync(bookmarksFile).isFile()) files.push(bookmarksFile);
      } catch {
        // Profiles without a bookmark file are valid; continue scanning other profiles.
      }
    };

    addBookmarksFile(userData);
    if (files.length > 0) return files;
    if (fs.existsSync(path.join(userData, 'History'))) return [];
    try {
      const entries = fs.readdirSync(userData, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          addBookmarksFile(path.join(userData, entry.name));
        }
      }
    } catch (e) {
      console.warn('Error reading Chrome profile directories:', e);
    }

    return [...new Set(files)];
  }

  public static importBookmarks(selectedPath?: string): ChromeImportResult {
    const userData = selectedPath || this.getChromeUserDataPath();
    if (!userData || !fs.existsSync(userData) || !fs.statSync(userData).isDirectory()) {
      return {
        status: 'no_profile',
        bookmarks: [],
        profileCount: 0,
        errorMessage: 'Google Chrome profili bulunamadı.',
      };
    }

    const files = this.findBookmarksFiles(userData);
    if (files.length === 0) {
      return {
        status: 'no_bookmarks',
        bookmarks: [],
        profileCount: 0,
        errorMessage: 'Chrome profili bulundu ancak yer imi dosyası tespit edilemedi.',
      };
    }

    const results: Bookmark[] = [];
    const seenUrls = new Set<string>();
    let hasReadError = false;
    let readErrorMessage = '';

    for (const bookmarksFile of files) {
      try {
        const raw = fs.readFileSync(bookmarksFile, 'utf-8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);

        const traverse = (node: any, currentPath = 'Genel') => {
          if (!node) return;
          if (node.type === 'url' && node.url) {
            const normalizedUrl = String(node.url).trim().toLowerCase().replace(/\/+$/, '');
            if (!seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl);
              results.push({
                id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                title: node.name || node.url,
                url: node.url,
                dateAdded: node.date_added ? parseInt(node.date_added, 10) : Date.now(),
                folder: currentPath,
              });
            }
          } else if (node.type === 'folder' && Array.isArray(node.children)) {
            const folderName = node.name || 'Klasör';
            const nextPath = currentPath ? `${currentPath} / ${folderName}` : folderName;
            for (const child of node.children) {
              traverse(child, nextPath);
            }
          }
        };

        if (data.roots) {
          if (data.roots.bookmark_bar) traverse(data.roots.bookmark_bar, 'Yer İmleri Çubuğu');
          if (data.roots.other) traverse(data.roots.other, 'Diğer Yer İmleri');
          if (data.roots.synced) traverse(data.roots.synced, 'Mobil Yer İmleri');
        }
      } catch (err: any) {
        hasReadError = true;
        readErrorMessage = err?.message || 'Yer imleri dosyası ayrıştırılamadı.';
        console.error(`Error importing bookmarks from ${bookmarksFile}:`, err);
      }
    }

    if (results.length === 0 && hasReadError) {
      return {
        status: 'read_error',
        bookmarks: [],
        profileCount: files.length,
        errorMessage: readErrorMessage,
      };
    }

    if (results.length === 0) {
      return {
        status: 'no_bookmarks',
        bookmarks: [],
        profileCount: files.length,
      };
    }

    return {
      status: 'success',
      bookmarks: results,
      profileCount: files.length,
    };
  }

  public static importBookmarksForProfile(profilePath: string): ChromeImportResult {
    return this.importBookmarks(profilePath);
  }

  public static checkChromeInstalled(): boolean {
    const userData = this.getChromeUserDataPath();
    return userData !== null && fs.existsSync(userData);
  }
}
