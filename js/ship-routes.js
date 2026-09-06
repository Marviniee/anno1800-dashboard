/*
 * Datenmodell:
 * ShipRoute = {
 *   id: string,
 *   name: string,
 *   color: string,          // Hex-Farbe, aus ROUTE_COLOR_PALETTE oder frei gewählt
 *   stops: string[],        // geordnete Insel-IDs, mindestens 2
 * }
 *
 * Eine Route ist immer ein Rundlauf: die letzte Station fährt zurück zur
 * ersten (wie in Anno üblich). Das wird nicht extra gespeichert, sondern
 * beim Rendern/Auswerten aus stops abgeleitet (Segment stops[i] -> stops[i+1],
 * letztes Segment stops[length-1] -> stops[0]).
 */

const ROUTE_COLOR_PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1',
];

const ShipRoutes = {
  DATA_PATH: 'data/ship-routes.json',
  cache: [],

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, []);
  },

  getAll() {
    return this.cache;
  },

  add(route) {
    route.id = crypto.randomUUID();
    this.cache.push(route);
    this._persist(`Route hinzugefügt: ${route.name}`);
    return route;
  },

  update(id, updatedRoute) {
    const idx = this.cache.findIndex((r) => r.id === id);
    if (idx === -1) return;
    this.cache[idx] = { ...updatedRoute, id };
    this._persist(`Route bearbeitet: ${updatedRoute.name}`);
  },

  remove(id) {
    const route = this.cache.find((r) => r.id === id);
    this.cache = this.cache.filter((r) => r.id !== id);
    this._persist(`Route gelöscht: ${route ? route.name : id}`);
  },

  // Segmente einer Route inkl. Rücklauf vom letzten zum ersten Stop.
  segmentsFor(route) {
    const segments = [];
    for (let i = 0; i < route.stops.length; i++) {
      const from = route.stops[i];
      const to = route.stops[(i + 1) % route.stops.length];
      segments.push({ from, to });
    }
    return segments;
  },

  _persist(message) {
    setSyncStatus('saving');
    GitHubSync.writeJson(this.DATA_PATH, this.cache, message)
      .then(() => setSyncStatus('saved'))
      .catch((e) => {
        console.error('ShipRoutes persist failed', e);
        setSyncStatus('error', e.message);
        alert(`Speichern fehlgeschlagen: ${e.message}`);
      });
  },
};
