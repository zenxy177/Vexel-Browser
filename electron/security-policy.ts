export function isSafeWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAllowedWebviewSource(value: string): boolean {
  return value === 'about:blank' || isSafeWebUrl(value);
}

export function isTrustedAppFrameUrl(
  value: string,
  developmentUrl: string | undefined,
  productionUrl: string,
): boolean {
  try {
    const frameUrl = new URL(value);
    if (!developmentUrl) {
      return frameUrl.href === new URL(productionUrl).href;
    }

    const expectedUrl = new URL(developmentUrl);
    return frameUrl.origin === expectedUrl.origin && frameUrl.pathname === expectedUrl.pathname;
  } catch {
    return false;
  }
}
