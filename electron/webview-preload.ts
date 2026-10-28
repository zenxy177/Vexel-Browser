import { ipcRenderer } from 'electron';

// Listen for selection changes in the webpage
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  if (selectedText.length > 1 && selectedText.length < 500) {
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();

    if (rect) {
      ipcRenderer.sendToHost('text-selected', {
        text: selectedText,
        x: rect.left + rect.width / 2,
        y: rect.top,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
  } else {
    ipcRenderer.sendToHost('text-selection-cleared');
  }
});

document.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  ipcRenderer.sendToHost('browser-zoom', event.deltaY);
}, { passive: false });

// Full page translation trigger listener
ipcRenderer.on('translate-page-to-tr', () => {
  const scriptId = 'zny-google-translate-script';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(script);

    const div = document.createElement('div');
    div.id = 'google_translate_element';
    div.style.display = 'none';
    document.body.appendChild(div);

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        { pageLanguage: 'auto', includedLanguages: 'tr', layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE },
        'google_translate_element'
      );
    };
  }
});
