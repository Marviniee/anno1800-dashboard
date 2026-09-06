/*
 * Lädt data/de-translations.json einmal und stellt Übersetzungshilfen
 * bereit. Wird sowohl von der Warenketten-Ansicht als auch vom
 * Insel-Formular (Güter-Icon-Auswahl) genutzt, damit die Tabelle nicht
 * dupliziert werden muss.
 */

const Translations = {
  data: null,
  loadPromise: null,

  load() {
    if (this.data) return Promise.resolve(this.data);
    if (!this.loadPromise) {
      this.loadPromise = fetch('data/de-translations.json')
        .then((res) => res.json())
        .then((data) => {
          this.data = data;
          return data;
        });
    }
    return this.loadPromise;
  },

  good(id, fallback) {
    return this.data?.goods?.[id] || fallback || id;
  },

  category(category) {
    return this.data?.categories?.[category] || category;
  },

  tier(tier) {
    return this.data?.tiers?.[tier] || tier;
  },

  building(building) {
    return this.data?.buildings?.[building] || building;
  },
};

// Rendert ein Waren-Icon aus assets/goods-icons/. Gemeinsam genutzt von der
// Warenketten-Ansicht und der Güter-Auswahl im Insel-Formular.
function goodIconHtml(icon, name, className) {
  const src = `assets/goods-icons/${encodeURIComponent(icon)}.png`;
  return `<img class="${className}" src="${src}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.onerror=null;this.classList.add('icon-missing');">`;
}
