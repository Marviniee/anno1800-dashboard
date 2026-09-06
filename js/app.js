function switchView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'karte') renderMapView();
  if (viewName === 'todos') renderTodosView();
  if (viewName === 'warenketten') renderWarenkettenView();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

renderIslandsView();
renderSettingsView();

console.log(`Anno 1800 Inselplaner v${APP_SEMVER} (Build ${APP_BUILD})`);
