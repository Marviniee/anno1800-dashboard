// Zwei Themes (Dark/Light), umschaltbar in den Einstellungen. Die eigentliche
// frühe Anwendung (vor dem ersten Paint, gegen FOUC) passiert per Inline-
// Script in index.html <head> - dieses Modul ist die gemeinsame Quelle für
// Lesen/Schreiben der Präferenz und wird von den Einstellungen benutzt.
const THEME_STORAGE_KEY = 'anno1800.theme';

const Theme = {
  get() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    } catch (e) {
      return 'dark';
    }
  },

  set(mode) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      // localStorage nicht verfügbar (z.B. privater Modus) - Theme gilt dann
      // nur für die aktuelle Seitenladung.
    }
    this.apply();
  },

  apply() {
    document.documentElement.dataset.theme = this.get();
  },
};

Theme.apply();
