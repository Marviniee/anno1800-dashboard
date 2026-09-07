const APP_SEMVER = '0.12.0';
const APP_BUILD = 19;

function renderSettingsView() {
  const view = document.getElementById('view-einstellungen');
  const hasToken = GitHubSync.hasToken();
  const migrationPending = needsMigration();

  view.innerHTML = `
    <div class="view-header">
      <h1>Einstellungen</h1>
    </div>

    <div class="settings-block">
      <h2 class="settings-block-title">Darstellung</h2>
      <div class="theme-switch" id="theme-switch">
        <button type="button" class="theme-switch-option ${Theme.get() === 'dark' ? 'active' : ''}" data-theme-option="dark">🌙 Dark</button>
        <button type="button" class="theme-switch-option ${Theme.get() === 'light' ? 'active' : ''}" data-theme-option="light">☀️ Light</button>
      </div>
    </div>

    <div class="settings-block">
      <h2 class="settings-block-title">GitHub-Synchronisierung</h2>
      <p class="settings-hint">
        Inseln, Kartenpositionen und To-Dos werden über das GitHub-Repo
        <strong>Marviniee/anno1800-dashboard</strong> zwischen deinen Geräten synchronisiert.
        Zum Schreiben braucht dieses Gerät einen Personal Access Token mit
        <code>repo</code>-Rechten (auf github.com unter Settings → Developer settings →
        Personal access tokens erstellen). Der Token bleibt nur lokal auf diesem Gerät.
      </p>

      <div class="form-group">
        <label for="input-github-token">GitHub Personal Access Token</label>
        <input type="password" id="input-github-token" placeholder="ghp_..." value="${hasToken ? escapeHtml(GitHubSync.getToken()) : ''}" autocomplete="off">
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary" id="btn-save-token">Speichern</button>
        <button class="btn" id="btn-test-token">Verbindung testen</button>
        ${hasToken ? '<button class="btn btn-danger" id="btn-clear-token">Token entfernen</button>' : ''}
      </div>

      <div id="token-status" class="settings-status"></div>
    </div>

    <div class="settings-block">
      <h2 class="settings-block-title">Migration</h2>
      ${
        migrationPending
          ? `
            <p class="settings-hint">
              Es wurden lokale Daten aus einer früheren Version (localStorage) gefunden, die noch
              nicht ins GitHub-Repo übernommen wurden.
              ${hasToken ? 'Du kannst die Migration hier manuell anstoßen:' : 'Trag zuerst einen gültigen Token ein, dann kannst du migrieren.'}
            </p>
            <div class="settings-actions">
              <button class="btn btn-primary" id="btn-migrate-now" ${hasToken ? '' : 'disabled'}>Jetzt migrieren</button>
            </div>
            <div id="migration-status" class="settings-status"></div>
          `
          : `<p class="settings-hint">Keine ausstehende Migration. GitHub ist die alleinige Datenquelle.</p>`
      }
    </div>

    <div class="settings-block">
      <div class="settings-row">
        <span class="label">Version</span>
        <span>${APP_SEMVER}</span>
      </div>
      <div class="settings-row">
        <span class="label">Build</span>
        <span>${APP_BUILD}</span>
      </div>
    </div>
  `;

  document.querySelectorAll('#theme-switch [data-theme-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Theme.set(btn.dataset.themeOption);
      document.querySelectorAll('#theme-switch [data-theme-option]').forEach((b) => {
        b.classList.toggle('active', b.dataset.themeOption === btn.dataset.themeOption);
      });
    });
  });

  document.getElementById('btn-save-token').addEventListener('click', async () => {
    const input = document.getElementById('input-github-token');
    const value = input.value.trim();
    if (!value) {
      alert('Bitte einen Token eintragen.');
      return;
    }
    GitHubSync.setToken(value);
    setSettingsStatus('token-status', 'Token gespeichert.', 'ok');
    await tryMigrateIfNeeded();
    renderSettingsView();
  });

  document.getElementById('btn-test-token').addEventListener('click', async () => {
    const input = document.getElementById('input-github-token');
    const value = input.value.trim();
    if (value && value !== GitHubSync.getToken()) {
      GitHubSync.setToken(value);
    }
    setSettingsStatus('token-status', 'Teste Verbindung...', 'pending');
    const result = await GitHubSync.testConnection();
    if (result.ok) {
      setSettingsStatus('token-status', `✓ Verbunden als ${result.login}.`, 'ok');
    } else {
      setSettingsStatus('token-status', `⚠ ${result.error}`, 'error');
    }
  });

  const clearBtn = document.getElementById('btn-clear-token');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Token wirklich entfernen? Änderungen können auf diesem Gerät danach nicht mehr gespeichert werden.')) {
        GitHubSync.clearToken();
        renderSettingsView();
      }
    });
  }

  const migrateBtn = document.getElementById('btn-migrate-now');
  if (migrateBtn) {
    migrateBtn.addEventListener('click', async () => {
      setSettingsStatus('migration-status', 'Migriere...', 'pending');
      const result = await migrateLegacyDataToGitHub();
      if (result.ok) {
        setSettingsStatus('migration-status', '✓ Migration abgeschlossen.', 'ok');
        updateMigrationBanner();
        renderCurrentView();
      } else {
        setSettingsStatus('migration-status', `⚠ ${result.error}`, 'error');
      }
    });
  }
}

function setSettingsStatus(elementId, message, kind) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `settings-status settings-status-${kind}`;
}
