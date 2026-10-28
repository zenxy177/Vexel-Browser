import fs from 'node:fs';
import path from 'node:path';
import { ChromeProfile } from './types';
import { ChromeImporter } from './chrome-importer';

interface ChromeLocalState {
  profile?: {
    info_cache?: Record<string, { name?: string }>;
  };
}

export function getChromeProfiles(userDataPath = ChromeImporter.getChromeUserDataPath()): ChromeProfile[] {
  if (!userDataPath) return [];

  try {
    const entries = fs.readdirSync(userDataPath, { withFileTypes: true });
    const statePath = path.join(userDataPath, 'Local State');
    let infoCache: Record<string, { name?: string }> | undefined;
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as ChromeLocalState;
      infoCache = state.profile?.info_cache;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Could not read Chrome profile display names:', error);
      }
    }

    const profileIds = new Set(Object.keys(infoCache ?? {}));
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const profilePath = path.join(userDataPath, entry.name);
      if (
        fs.existsSync(path.join(profilePath, 'Bookmarks')) ||
        fs.existsSync(path.join(profilePath, 'History'))
      ) {
        profileIds.add(entry.name);
      }
    }

    return [...profileIds]
      .map(id => {
        const profilePath = path.join(userDataPath, id);
        const localInfo = infoCache?.[id];
        return {
          id,
          name: localInfo?.name?.trim() || id,
          hasBookmarks: fs.existsSync(path.join(profilePath, 'Bookmarks')),
          hasHistory: fs.existsSync(path.join(profilePath, 'History')),
        };
      })
      .sort((a, b) => {
        if (a.id === 'Default') return -1;
        if (b.id === 'Default') return 1;
        return a.name.localeCompare(b.name, 'tr');
      });
  } catch (error) {
    console.warn('Could not discover Chrome profiles:', error);
    return [];
  }
}

export function getChromeProfilePath(profileId: string): string | null {
  if (typeof profileId !== 'string' || !profileId || profileId !== path.basename(profileId)) return null;
  const profile = getChromeProfiles().find(candidate => candidate.id === profileId);
  if (!profile) return null;
  const userDataPath = ChromeImporter.getChromeUserDataPath();
  return userDataPath ? path.join(userDataPath, profile.id) : null;
}
