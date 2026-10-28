export interface ShortcutKeyInput {
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export function getBrowserShortcut(input: ShortcutKeyInput): string | null {
  const key = input.key.toLowerCase();
  const command = input.control || input.meta;

  if (input.alt) {
    if (command) return null;
    if (key === 'arrowleft' || key === 'left') return 'navigate-back';
    if (key === 'arrowright' || key === 'right') return 'navigate-forward';
    if (key === 'd') return 'focus-address';
    if (key === 'home') return 'go-home';
    if (key === 'enter') return 'open-address-new-tab';
    return null;
  }

  if (command) {
    if (key === 'tab') return input.shift ? 'previous-tab' : 'next-tab';
    if (key === 'pagedown') return 'next-tab';
    if (key === 'pageup') return 'previous-tab';
    if (key === 'f4') return input.shift ? null : 'close-tab';
    if (input.shift && (key === '+' || key === '=')) return 'zoom-in';
    if (!input.shift && /^[1-8]$/.test(key)) return `select-tab-${key}`;
    if (!input.shift && key === '9') return 'select-last-tab';

    if (input.shift) {
      if (key === 't') return 'reopen-closed-tab';
      if (key === 'r') return 'hard-reload';
      if (key === 'd') return 'bookmark-all-tabs';
      if (key === 'o') return 'open-bookmarks';
      if (key === 'w') return 'close-window';
      if (key === 'g') return 'find-previous';
      return null;
    }

    switch (key) {
      case 'k':
      case 'e': return 'command-palette';
      case 't': return 'new-tab';
      case 'w': return 'close-tab';
      case 'h': return 'history';
      case 'l': return 'focus-address';
      case 'r': return 'reload';
      case 'f': return 'find-in-page';
      case 'j': return 'downloads';
      case 'd': return 'bookmark-page';
      case 'g': return 'find-next';
      case 'add':
      case '+':
      case '=': return 'zoom-in';
      case 'subtract':
      case '-': return 'zoom-out';
      case '0': return 'zoom-reset';
      default: return null;
    }
  }

  if (key === 'f5') return 'reload';
  if (key === 'f3') return input.shift ? 'find-previous' : 'find-next';
  if (key === 'f6') return 'focus-address';
  if (key === 'f11') return 'toggle-fullscreen';
  return null;
}
