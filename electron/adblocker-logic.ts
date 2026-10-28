export function normalizeFilterDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (
    domain.length > 253 ||
    !domain.includes('.') ||
    domain.split('.').every(label => /^\d+$/.test(label)) ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i.test(domain)
  ) {
    return null;
  }
  return domain;
}

export function parseHostsFilterList(contents: string): string[] {
  const domains = new Set<string>();
  for (const line of contents.split(/\r?\n/)) {
    const entry = line.split('#', 1)[0].trim();
    if (!entry) continue;
    const [address, ...hosts] = entry.split(/\s+/);
    if (address !== '0.0.0.0' && address !== '127.0.0.1') continue;
    for (const host of hosts) {
      const domain = normalizeFilterDomain(host);
      if (domain && domain !== 'localhost.localdomain') domains.add(domain);
    }
  }
  return [...domains];
}

export function matchesBlockedDomain(hostname: string, blockedDomains: Set<string>): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const labels = host.split('.');
  for (let index = 0; index < labels.length - 1; index++) {
    const candidate = labels.slice(index).join('.');
    if (blockedDomains.has(candidate)) return candidate;
  }
  return null;
}

export function isBlockedPopup(
  sourceUrl: string,
  targetUrl: string,
  blockedDomains: Set<string>,
  allowedSites: Set<string>,
): boolean {
  try {
    const source = new URL(sourceUrl);
    const target = new URL(targetUrl);
    if (
      (source.protocol !== 'http:' && source.protocol !== 'https:') ||
      (target.protocol !== 'http:' && target.protocol !== 'https:') ||
      allowedSites.has(source.hostname.toLowerCase())
    ) {
      return false;
    }
    if (matchesBlockedDomain(target.hostname, blockedDomains)) return true;
    const targetHostname = target.hostname.toLowerCase();
    return (targetHostname === 'facebook.net' || targetHostname.endsWith('.facebook.net')) &&
      (target.pathname + target.search).includes('/en_US/fbevents.js');
  } catch {
    return false;
  }
}

export function normalizeSiteException(value: string): string | null {
  return normalizeFilterDomain(value);
}
