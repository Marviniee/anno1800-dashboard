function switchView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'karte') renderMapView();
  if (viewName === 'todos') renderTodosView();
  if (viewName === 'warenketten') renderWarenkettenView();
  if (viewName === 'einstellungen') renderSettingsView();
}

document.querySelectorAll('.nav-item, .link-button[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

let syncStatusTimeout = null;

function setSyncStatus(state, message) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  clearTimeout(syncStatusTimeout);

  el.classList.remove('sync-saving', 'sync-saved', 'sync-error');

  if (state === 'saving') {
    el.classList.add('sync-saving');
    el.textContent = '⏳ Speichere...';
  } else if (state === 'saved') {
    el.classList.add('sync-saved');
    el.textContent = '✓ Gespeichert';
    syncStatusTimeout = setTimeout(() => {
      el.textContent = '';
      el.classList.remove('sync-saved');
    }, 3000);
  } else if (state === 'error') {
    el.classList.add('sync-error');
    el.textContent = `⚠ Fehler: ${message || 'Speichern fehlgeschlagen'}`;
  } else {
    el.textContent = '';
  }
}

// Legacy-localStorage-Keys aus der Zeit vor dem GitHub-Sync (Baustein 1-3).
const LEGACY_KEYS = { islands: 'islands', mapPositions: 'mapPositions', todos: 'todos' };
const MIGRATION_FLAG_KEY = 'migrationDone';

function hasLegacyData() {
  return (
    Storage.get(LEGACY_KEYS.islands, null) !== null ||
    Storage.get(LEGACY_KEYS.mapPositions, null) !== null ||
    Storage.get(LEGACY_KEYS.todos, null) !== null
  );
}

function isMigrationDone() {
  return Storage.get(MIGRATION_FLAG_KEY, false) === true;
}

function needsMigration() {
  return hasLegacyData() && !isMigrationDone();
}

async function migrateLegacyDataToGitHub() {
  const legacyIslands = Storage.get(LEGACY_KEYS.islands, null);
  const legacyPositions = Storage.get(LEGACY_KEYS.mapPositions, null);
  const legacyTodos = Storage.get(LEGACY_KEYS.todos, null);

  setSyncStatus('saving');
  try {
    if (legacyIslands !== null) {
      await GitHubSync.writeJson(Islands.DATA_PATH, legacyIslands, 'Migration: bestehende Inseln aus localStorage');
      Islands.cache = legacyIslands;
    }
    if (legacyPositions !== null) {
      await GitHubSync.writeJson(MapPositions.DATA_PATH, legacyPositions, 'Migration: bestehende Kartenpositionen aus localStorage');
      MapPositions.cache = legacyPositions;
    }
    if (legacyTodos !== null) {
      await GitHubSync.writeJson(Todos.DATA_PATH, legacyTodos, 'Migration: bestehende To-Dos aus localStorage');
      Todos.cache = legacyTodos;
    }

    Storage.set(MIGRATION_FLAG_KEY, true);
    localStorage.removeItem('anno1800.islands');
    localStorage.removeItem('anno1800.mapPositions');
    localStorage.removeItem('anno1800.todos');

    setSyncStatus('saved');
    return { ok: true };
  } catch (e) {
    console.error('Migration fehlgeschlagen', e);
    setSyncStatus('error', e.message);
    return { ok: false, error: e.message };
  }
}

// Wird von den Einstellungen nach dem Speichern eines Tokens aufgerufen:
// migriert automatisch, falls noch unmigrierte Alt-Daten vorhanden sind.
async function tryMigrateIfNeeded() {
  if (!GitHubSync.hasToken() || !needsMigration()) return null;
  const result = await migrateLegacyDataToGitHub();
  updateMigrationBanner();
  renderCurrentView();
  return result;
}

function updateMigrationBanner() {
  const banner = document.getElementById('legacy-migration-banner');
  if (!banner) return;
  banner.hidden = !needsMigration();
}

function renderCurrentView() {
  const activeBtn = document.querySelector('.nav-item.active');
  const viewName = activeBtn ? activeBtn.dataset.view : 'inseln';
  if (viewName === 'karte') renderMapView();
  else if (viewName === 'todos') renderTodosView();
  else if (viewName === 'warenketten') renderWarenkettenView();
  else if (viewName === 'einstellungen') renderSettingsView();
  else renderIslandsView();
}

async function init() {
  await Promise.all([Islands.load(), MapPositions.load(), Todos.load(), Translations.load(), ShipRoutes.load()]);

  document.getElementById('app-loading').hidden = true;
  document.getElementById('view-inseln').classList.add('active');

  updateMigrationBanner();
  renderIslandsView();

  console.log(`Anno 1800 Inselplaner v${APP_SEMVER} (Build ${APP_BUILD})`);
}

init();
