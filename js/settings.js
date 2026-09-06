const APP_SEMVER = '0.2.0';
const APP_BUILD = 2;

function renderSettingsView() {
  const view = document.getElementById('view-einstellungen');
  view.innerHTML = `
    <div class="view-header">
      <h1>Einstellungen</h1>
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
}
