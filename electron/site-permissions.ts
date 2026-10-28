export type SitePermission = 'geolocation' | 'media' | 'notifications' | 'clipboard-read';

const SITE_PERMISSIONS: ReadonlySet<string> = new Set([
  'geolocation',
  'media',
  'notifications',
  'clipboard-read',
]);

export function getSecurePermissionOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin !== 'null' ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function isSitePermission(permission: string): permission is SitePermission {
  return SITE_PERMISSIONS.has(permission);
}

export function getPermissionLabel(permission: SitePermission, mediaTypes?: string[]): string {
  if (permission === 'media') {
    const requestedMedia = new Set(mediaTypes ?? []);
    if (requestedMedia.has('audio') && requestedMedia.has('video')) return 'kamera ve mikrofon';
    if (requestedMedia.has('video')) return 'kamera';
    if (requestedMedia.has('audio')) return 'mikrofon';
    return 'kamera veya mikrofon';
  }
  if (permission === 'geolocation') return 'konumunuzu';
  if (permission === 'notifications') return 'bildirim göndermeyi';
  return 'panonuzu okumayı';
}
