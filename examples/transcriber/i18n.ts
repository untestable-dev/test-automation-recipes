// Language switching shared by every page. The inline script in each page's
// <head> sets <html lang> before first paint (so the wrong language never
// flashes); this module wires the EN/日本語 switcher and lets app code react.
// Static copy lives in the HTML as <span lang="en">/<span lang="ja"> pairs
// toggled by CSS; only JS-generated strings need the callbacks here.

export type Lang = 'en' | 'ja';

export function currentLang(): Lang {
  return document.documentElement.lang === 'ja' ? 'ja' : 'en';
}

const listeners: Array<(lang: Lang) => void> = [];

/** Register a callback fired immediately and again on every language switch. */
export function onLangChange(fn: (lang: Lang) => void): void {
  listeners.push(fn);
  fn(currentLang());
}

export function setLang(next: Lang): void {
  document.documentElement.lang = next;
  try {
    localStorage.setItem('lang', next);
  } catch {
    // Storage can be unavailable (e.g. private browsing) — switching still works.
  }
  for (const fn of listeners) fn(next);
}

for (const btn of document.querySelectorAll<HTMLElement>('[data-set-lang]')) {
  btn.addEventListener('click', () => setLang(btn.dataset.setLang === 'ja' ? 'ja' : 'en'));
}
