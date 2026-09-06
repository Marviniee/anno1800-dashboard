const Storage = {
  PREFIX: 'anno1800.',

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.error('Storage.get failed for', key, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.set failed for', key, e);
    }
  },
};
