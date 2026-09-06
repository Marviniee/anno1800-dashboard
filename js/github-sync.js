/*
 * GitHub-Sync: liest & schreibt die App-Daten (Inseln, Kartenpositionen,
 * To-Dos) direkt im GitHub-Repo, ohne über den GitHub-Pages-Build zu gehen
 * (der 30-60s braucht und damit den Geräte-Wechsel spürbar verzögern würde).
 *
 * Lesen (readJson):
 *  - Mit Token: über die Contents-API (immer der aktuelle Git-Stand,
 *    Base64-dekodiert), gleicher Endpunkt wie beim Schreiben.
 *  - Ohne Token (z.B. vor der ersten Token-Eingabe): über
 *    raw.githubusercontent.com mit Cache-Busting, da dort kein Pages-Build
 *    nötig ist (nur der CDN-Cache von raw.githubusercontent selbst, der mit
 *    dem Zeitstempel-Query-Param umgangen wird).
 * Schreiben (writeJson): immer über die Contents-API (braucht Token).
 *
 * Der Token selbst liegt in localStorage (gerätespezifisch, wird nie
 * synchronisiert). Alle App-Daten leben ausschließlich in diesem Repo
 * unter data/*.json - GitHub ist die alleinige Quelle der Wahrheit, kein
 * localStorage-Fallback mehr für die eigentlichen Daten.
 */

const GitHubSync = {
  OWNER: 'Marviniee',
  REPO: 'anno1800-dashboard',
  BRANCH: 'main',
  RAW_BASE: 'https://raw.githubusercontent.com/Marviniee/anno1800-dashboard/main/',
  TOKEN_KEY: 'anno1800.githubToken',

  getToken() {
    try {
      return localStorage.getItem(this.TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token.trim());
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  hasToken() {
    return !!this.getToken();
  },

  apiUrl(path) {
    return `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${path}`;
  },

  authHeaders() {
    const token = this.getToken();
    return {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    };
  },

  // Liest eine JSON-Datei ohne Pages-Build-Verzögerung: mit Token über die
  // Contents-API (garantiert aktueller Git-Stand), sonst über
  // raw.githubusercontent.com als rein lesender Fallback.
  async readJson(path, fallback) {
    if (this.hasToken()) {
      try {
        const res = await fetch(`${this.apiUrl(path)}?ref=${this.BRANCH}`, {
          headers: this.authHeaders(),
          cache: 'no-store',
        });
        if (res.status === 404) return fallback;
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        return JSON.parse(this.decodeBase64(data.content));
      } catch (e) {
        console.error('GitHubSync.readJson (Contents-API) failed for', path, e, '- versuche raw.githubusercontent.com');
      }
    }

    try {
      const res = await fetch(`${this.RAW_BASE}${path}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return fallback;
      return await res.json();
    } catch (e) {
      console.error('GitHubSync.readJson (raw) failed for', path, e);
      return fallback;
    }
  },

  // UTF-8-sicheres Encoding/Decoding für die Base64-Übergabe an die GitHub-API.
  encodeBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  },

  decodeBase64(base64) {
    return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
  },

  async getFileSha(path) {
    const res = await fetch(`${this.apiUrl(path)}?ref=${this.BRANCH}`, {
      headers: this.authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API Fehler beim Lesen von ${path}: ${res.status}`);
    const data = await res.json();
    return data.sha;
  },

  // Schreibt eine JSON-Datei per Commit über die GitHub Contents-API.
  // Holt den SHA vor JEDEM Versuch frisch (nie zwischengespeichert). Schlägt
  // der erste Versuch mit 409 fehl (ein anderer Schreibvorgang - z.B. eine
  // zweite schnelle Änderung kurz danach oder ein anderes Gerät - kam
  // zwischen SHA-Abfrage und PUT dazwischen), wird einmal mit frisch
  // geholtem SHA erneut versucht, bevor ein Fehler an den Aufrufer geht.
  async writeJson(path, data, message) {
    if (!this.hasToken()) {
      throw new Error('Kein GitHub-Token hinterlegt. Bitte in den Einstellungen eintragen.');
    }

    const attemptWrite = async () => {
      const sha = await this.getFileSha(path);
      const content = this.encodeBase64(JSON.stringify(data, null, 2) + '\n');

      return fetch(this.apiUrl(path), {
        method: 'PUT',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          content,
          branch: this.BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
    };

    let res = await attemptWrite();

    if (res.status === 409) {
      console.warn(`GitHubSync.writeJson: 409-Konflikt bei ${path}, versuche mit frischem SHA erneut...`);
      res = await attemptWrite();
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`GitHub-Commit fehlgeschlagen (${res.status}): ${errBody.message || 'Unbekannter Fehler'}`);
    }

    return res.json();
  },

  async testConnection() {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'Kein Token eingetragen.' };
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        return { ok: false, error: `Token ungültig oder abgelaufen (${res.status}).` };
      }
      const data = await res.json();
      return { ok: true, login: data.login };
    } catch (e) {
      return { ok: false, error: 'Netzwerkfehler beim Verbindungstest.' };
    }
  },
};
