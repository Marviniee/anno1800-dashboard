/*
 * Karte: Inseln als frei verschiebbare Boxen auf einer Canvas-Fläche.
 * Zwei unabhängige Linien-Ebenen:
 *  - Warenlinien: automatisch berechnete Verbindungen zwischen Inseln, die
 *    dieselbe Ware handeln (aus goods/role, computeTradeEdges).
 *  - Schiffsrouten: manuell angelegte Rundläufe über mehrere Stationen in
 *    fester Reihenfolge (ShipRoutes, js/ship-routes.js).
 * Beide Ebenen können unabhängig ein-/ausgeblendet werden und wandern beim
 * Verschieben einer Insel automatisch mit.
 */

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1400;
const BOX_DEFAULT_WIDTH = 190;
const BOX_DEFAULT_HEIGHT = 140;
const GRID_GAP = 40;
const GRID_COLUMNS = 6;
const MAX_BOX_FUNCTIONS = 3;
const MAX_BOX_GOODS = 6;

const MapPositions = {
  DATA_PATH: 'data/map-positions.json',
  cache: {},

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, {});
  },

  getAll() {
    return this.cache;
  },

  saveAll(positions) {
    this.cache = positions;
    this._persist('Kartenpositionen aktualisiert');
  },

  setPosition(islandId, x, y) {
    this.cache[islandId] = { x, y };
    this._persist(`Kartenposition aktualisiert: ${islandId}`);
  },

  clearAll() {
    this.cache = {};
    this._persist('Kartenlayout zurückgesetzt');
  },

  _persist(message) {
    setSyncStatus('saving');
    GitHubSync.writeJson(this.DATA_PATH, this.cache, message)
      .then(() => setSyncStatus('saved'))
      .catch((e) => {
        console.error('MapPositions persist failed', e);
        setSyncStatus('error', e.message);
        alert(`Speichern fehlgeschlagen: ${e.message}`);
      });
  },
};

let routesPanelExpanded = true;
let editingRouteId = null;
let draftRouteStops = [];
let draftRouteColor = ROUTE_COLOR_PALETTE[0];

function renderMapView() {
  const view = document.getElementById('view-karte');
  const islands = Islands.getAll();
  const routes = ShipRoutes.getAll();

  view.innerHTML = `
    <div class="view-header">
      <h1>Karte</h1>
      <div class="map-header-actions">
        <label class="layer-toggle"><input type="checkbox" id="toggle-trade-edges" checked> Warenlinien</label>
        <label class="layer-toggle"><input type="checkbox" id="toggle-ship-routes" checked> Schiffsrouten</label>
        <button class="btn btn-primary" id="btn-add-route">+ Route anlegen</button>
        <button class="btn" id="btn-reset-layout">Layout zurücksetzen</button>
      </div>
    </div>
  `;

  if (islands.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Inseln angelegt. Leg zuerst unter "Inseln" welche an.';
    view.appendChild(empty);
    return;
  }

  const routePanel = document.createElement('div');
  routePanel.className = 'route-panel';
  routePanel.innerHTML = `
    <button class="route-panel-toggle" id="btn-toggle-routes-panel">
      ${routesPanelExpanded ? '▾' : '▸'} Schiffsrouten (${routes.length})
    </button>
    <div id="routes-list-container" ${routesPanelExpanded ? '' : 'hidden'}></div>
  `;
  view.appendChild(routePanel);
  renderRoutesList(routes, islands);

  document.getElementById('btn-toggle-routes-panel').addEventListener('click', () => {
    routesPanelExpanded = !routesPanelExpanded;
    renderMapView();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'map-canvas-wrapper';

  const canvas = document.createElement('div');
  canvas.className = 'map-canvas';
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('width', CANVAS_WIDTH);
  svg.setAttribute('height', CANVAS_HEIGHT);

  canvas.appendChild(svg);
  wrapper.appendChild(canvas);
  view.appendChild(wrapper);

  document.getElementById('btn-reset-layout').addEventListener('click', () => {
    if (confirm('Layout zurücksetzen? Alle Inseln werden neu im Raster angeordnet.')) {
      MapPositions.clearAll();
      renderMapView();
    }
  });

  document.getElementById('btn-add-route').addEventListener('click', () => openRouteModal());

  const positions = assignMissingPositions(islands);
  const boxEls = {};

  islands.forEach((island) => {
    const pos = positions[island.id];
    const box = createIslandBox(island, pos);
    canvas.appendChild(box);
    boxEls[island.id] = box;
  });

  const tradeEdges = computeTradeEdges(islands);
  const tradeEdgeEls = drawTradeEdges(svg, tradeEdges, boxEls);
  const routeLineEls = drawShipRoutes(svg, routes, boxEls);
  const allLineEls = [...tradeEdgeEls, ...routeLineEls];

  document.getElementById('toggle-trade-edges').addEventListener('change', (e) => {
    const g = svg.querySelector('.trade-edges-layer');
    if (g) g.style.display = e.target.checked ? '' : 'none';
  });
  document.getElementById('toggle-ship-routes').addEventListener('change', (e) => {
    const g = svg.querySelector('.ship-routes-layer');
    if (g) g.style.display = e.target.checked ? '' : 'none';
  });

  islands.forEach((island) => {
    setupDrag(boxEls[island.id], island.id, allLineEls, boxEls);
  });
}

function gridCellKey(x, y) {
  const col = Math.round((x - GRID_GAP) / (BOX_DEFAULT_WIDTH + GRID_GAP));
  const row = Math.round((y - GRID_GAP) / (BOX_DEFAULT_HEIGHT + GRID_GAP));
  return `${col},${row}`;
}

function assignMissingPositions(islands) {
  const positions = MapPositions.getAll();

  // Belegte Rasterzellen ermitteln, damit neue Inseln nicht auf bereits
  // positionierte (auch manuell verschobene) Inseln gelegt werden.
  const takenCells = new Set();
  islands.forEach((island) => {
    const pos = positions[island.id];
    if (pos) takenCells.add(gridCellKey(pos.x, pos.y));
  });

  let changed = false;
  let searchIndex = 0;

  islands.forEach((island) => {
    if (positions[island.id]) return;

    let col, row, key;
    do {
      col = searchIndex % GRID_COLUMNS;
      row = Math.floor(searchIndex / GRID_COLUMNS);
      key = `${col},${row}`;
      searchIndex++;
    } while (takenCells.has(key));

    takenCells.add(key);
    positions[island.id] = {
      x: GRID_GAP + col * (BOX_DEFAULT_WIDTH + GRID_GAP),
      y: GRID_GAP + row * (BOX_DEFAULT_HEIGHT + GRID_GAP),
    };
    changed = true;
  });

  if (changed) MapPositions.saveAll(positions);
  return positions;
}

function createIslandBox(island, pos) {
  const box = document.createElement('div');
  box.className = 'map-island-box';
  box.dataset.islandId = island.id;
  box.style.left = `${pos.x}px`;
  box.style.top = `${pos.y}px`;
  const combinedGoods = [...(island.vorkommen || []), ...(island.fruchtbarkeiten || []), ...(island.goods || [])];
  box.innerHTML = `
    <div class="map-island-box-title">${escapeHtml(island.name)}</div>
    ${renderBoxFunctions(island.functions)}
    ${renderBoxGoods(combinedGoods)}
  `;
  return box;
}

function renderBoxFunctions(functions) {
  if (!functions.length) return '';
  const shown = functions.slice(0, MAX_BOX_FUNCTIONS);
  const overflow = functions.length - shown.length;
  return `
    <div class="map-island-box-functions">
      ${shown.map((f) => `<span class="map-function-chip">${escapeHtml(f)}</span>`).join('')}
      ${overflow > 0 ? `<span class="map-function-chip map-function-chip-more">+${overflow}</span>` : ''}
    </div>
  `;
}

function renderBoxGoods(goods) {
  if (!goods.length) return '';
  const shown = goods.slice(0, MAX_BOX_GOODS);
  const overflow = goods.length - shown.length;
  return `
    <div class="map-island-box-goods">
      ${shown
        .map((g) => {
          const name = Translations.good(g.good, g.good);
          const titleText = g.count ? `${name} ×${g.count}` : name;
          return `
            <span class="map-good-icon-wrap" title="${escapeHtml(titleText)}">
              ${goodIconHtml(g.good, name, 'map-good-icon')}
              ${g.count ? `<span class="map-good-count">${escapeHtml(String(g.count))}</span>` : ''}
            </span>
          `;
        })
        .join('')}
      ${overflow > 0 ? `<span class="map-good-more" title="${overflow} weitere Güter">+${overflow}</span>` : ''}
    </div>
  `;
}

function normalizeGoodName(good) {
  return good.trim().toLowerCase();
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join('|');
}

function computeTradeEdges(islands) {
  const goodMap = {}; // normalized good -> { displayName, producers: Set, consumers: Set }

  function ensureEntry(norm, good) {
    if (!goodMap[norm]) {
      goodMap[norm] = { displayName: Translations.good(good, good.trim()), producers: new Set(), consumers: new Set() };
    }
    return goodMap[norm];
  }

  islands.forEach((island) => {
    // Ein Vorkommen oder eine Fruchtbarkeit zählt für die Handelsrouten-
    // Berechnung wie ein Produzent dieser Rohware (keine eigene Rolle,
    // immer vor Ort verfügbar).
    (island.vorkommen || []).forEach((v) => {
      const norm = normalizeGoodName(v.good);
      if (!norm) return;
      ensureEntry(norm, v.good).producers.add(island.id);
    });

    (island.fruchtbarkeiten || []).forEach((f) => {
      const norm = normalizeGoodName(f.good);
      if (!norm) return;
      ensureEntry(norm, f.good).producers.add(island.id);
    });

    (island.goods || []).forEach((g) => {
      const norm = normalizeGoodName(g.good);
      if (!norm) return;
      const entry = ensureEntry(norm, g.good);
      if (g.role === 'producer' || g.role === 'both') entry.producers.add(island.id);
      if (g.role === 'consumer' || g.role === 'both') entry.consumers.add(island.id);
    });
  });

  const edgeMap = {}; // pairKey -> { a, b, goods: Set<displayName> }

  Object.values(goodMap).forEach(({ displayName, producers, consumers }) => {
    producers.forEach((producerId) => {
      consumers.forEach((consumerId) => {
        if (producerId === consumerId) return;
        const key = pairKey(producerId, consumerId);
        if (!edgeMap[key]) {
          const [a, b] = key.split('|');
          edgeMap[key] = { a, b, goods: new Set() };
        }
        edgeMap[key].goods.add(displayName);
      });
    });
  });

  return Object.values(edgeMap).map((e) => ({ ...e, goods: Array.from(e.goods) }));
}

function getBoxCenter(box) {
  return {
    x: box.offsetLeft + box.offsetWidth / 2,
    y: box.offsetTop + box.offsetHeight / 2,
  };
}

// Punkt auf dem Rand von `box`, dort wo die Linie Richtung `towardPoint`
// das Rechteck verlässt (für Schiffsrouten-Pfeile, die sichtbar an der
// Box-Kante enden sollen statt unter der Box im Zentrum zu verschwinden).
function getBoxEdgePoint(box, towardPoint) {
  const center = getBoxCenter(box);
  const hw = box.offsetWidth / 2;
  const hh = box.offsetHeight / 2;
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: center.x + dx * t, y: center.y + dy * t };
}

function drawTradeEdges(svg, edges, boxEls) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'trade-edges-layer');
  svg.appendChild(group);

  const edgeEls = [];

  edges.forEach((edge) => {
    const boxA = boxEls[edge.a];
    const boxB = boxEls[edge.b];
    if (!boxA || !boxB) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'edge-line');

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'edge-label');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = edge.goods.join(', ');
    label.appendChild(title);

    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hitArea.setAttribute('class', 'edge-hit-area');
    const hitTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    hitTitle.textContent = edge.goods.join(', ');
    hitArea.appendChild(hitTitle);

    group.appendChild(line);
    group.appendChild(hitArea);
    group.appendChild(label);

    const entry = { edge, line, hitArea, label };
    edgeEls.push(entry);
    updateEdgePosition(entry, boxA, boxB);
  });

  return edgeEls;
}

function updateEdgePosition(entry, boxA, boxB) {
  const centerA = getBoxCenter(boxA);
  const centerB = getBoxCenter(boxB);

  entry.line.setAttribute('x1', centerA.x);
  entry.line.setAttribute('y1', centerA.y);
  entry.line.setAttribute('x2', centerB.x);
  entry.line.setAttribute('y2', centerB.y);

  entry.hitArea.setAttribute('x1', centerA.x);
  entry.hitArea.setAttribute('y1', centerA.y);
  entry.hitArea.setAttribute('x2', centerB.x);
  entry.hitArea.setAttribute('y2', centerB.y);

  const midX = (centerA.x + centerB.x) / 2;
  const midY = (centerA.y + centerB.y) / 2;

  // Label leicht senkrecht zur Linie versetzen, damit er nicht auf der Linie liegt
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const len = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / len) * 12;
  const offsetY = (dx / len) * 12;

  entry.label.setAttribute('x', midX + offsetX);
  entry.label.setAttribute('y', midY + offsetY);
  entry.label.textContent = formatEdgeLabel(entry.edge.goods);
}

function formatEdgeLabel(goods) {
  if (goods.length <= 2) return goods.join(', ');
  return `${goods.slice(0, 2).join(', ')} +${goods.length - 2}`;
}

// Schiffsrouten: gestrichelte, farbige Linien mit Pfeilspitzen in
// Fahrtrichtung, ein Kreis je Route (letzter Stop -> erster Stop).
function drawShipRoutes(svg, routes, boxEls) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'ship-routes-layer');
  svg.appendChild(group);

  const routeEls = [];
  if (routes.length === 0) return routeEls;

  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  routes.forEach((route) => {
    const markerId = `route-arrow-${route.id}`;
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    arrowPath.setAttribute('fill', route.color);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    ShipRoutes.segmentsFor(route).forEach((seg) => {
      const boxA = boxEls[seg.from];
      const boxB = boxEls[seg.to];
      if (!boxA || !boxB) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'route-line');
      line.setAttribute('stroke', route.color);
      line.setAttribute('marker-end', `url(#${markerId})`);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = route.name;
      line.appendChild(title);

      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hitArea.setAttribute('class', 'route-hit-area');
      const hitTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      hitTitle.textContent = route.name;
      hitArea.appendChild(hitTitle);

      group.appendChild(hitArea);
      group.appendChild(line);

      const entry = { type: 'route', edge: { a: seg.from, b: seg.to }, line, hitArea };
      routeEls.push(entry);
      updateRoutePosition(entry, boxA, boxB);
    });
  });

  return routeEls;
}

function updateRoutePosition(entry, boxA, boxB) {
  const centerA = getBoxCenter(boxA);
  const centerB = getBoxCenter(boxB);
  const start = getBoxEdgePoint(boxA, centerB);
  const end = getBoxEdgePoint(boxB, centerA);

  entry.line.setAttribute('x1', start.x);
  entry.line.setAttribute('y1', start.y);
  entry.line.setAttribute('x2', end.x);
  entry.line.setAttribute('y2', end.y);

  entry.hitArea.setAttribute('x1', start.x);
  entry.hitArea.setAttribute('y1', start.y);
  entry.hitArea.setAttribute('x2', end.x);
  entry.hitArea.setAttribute('y2', end.y);
}

function setupDrag(box, islandId, allLineEls, boxEls) {
  box.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = box.offsetLeft;
    const startTop = box.offsetTop;

    box.classList.add('dragging');

    const relatedLines = allLineEls.filter((entry) => entry.edge.a === islandId || entry.edge.b === islandId);

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      newLeft = Math.max(0, Math.min(CANVAS_WIDTH - box.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(CANVAS_HEIGHT - box.offsetHeight, newTop));

      box.style.left = `${newLeft}px`;
      box.style.top = `${newTop}px`;

      relatedLines.forEach((entry) => {
        const updater = entry.type === 'route' ? updateRoutePosition : updateEdgePosition;
        updater(entry, boxEls[entry.edge.a], boxEls[entry.edge.b]);
      });
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      box.classList.remove('dragging');
      MapPositions.setPosition(islandId, box.offsetLeft, box.offsetTop);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// ---- Schiffsrouten-Verwaltung (Liste + Anlegen/Bearbeiten/Löschen) ----

function renderRoutesList(routes, islands) {
  const container = document.getElementById('routes-list-container');
  if (!container) return;

  if (routes.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:12px 0;">Noch keine Schiffsrouten angelegt.</div>`;
    return;
  }

  const islandsById = Object.fromEntries(islands.map((i) => [i.id, i]));

  container.innerHTML = routes
    .map((route) => {
      const stopNames = route.stops.map((id) => (islandsById[id] ? islandsById[id].name : '(gelöscht)'));
      return `
        <div class="route-row">
          <span class="route-color-dot" style="background:${route.color}"></span>
          <span class="route-row-name">${escapeHtml(route.name)}</span>
          <span class="route-row-stops" title="${escapeHtml(stopNames.join(' → '))}">${stopNames.length} Stationen</span>
          <button class="icon-btn" data-edit-route="${route.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn" data-delete-route="${route.id}" title="Löschen">🗑</button>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-edit-route]').forEach((btn) => {
    btn.addEventListener('click', () => openRouteModal(btn.dataset.editRoute));
  });
  container.querySelectorAll('[data-delete-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = routes.find((r) => r.id === btn.dataset.deleteRoute);
      if (confirm(`Route "${route.name}" wirklich löschen?`)) {
        ShipRoutes.remove(btn.dataset.deleteRoute);
        renderMapView();
      }
    });
  });
}

function openRouteModal(routeId) {
  editingRouteId = routeId || null;
  const route = routeId ? ShipRoutes.getAll().find((r) => r.id === routeId) : null;

  draftRouteStops = route ? [...route.stops] : [];
  draftRouteColor = route ? route.color : ROUTE_COLOR_PALETTE[ShipRoutes.getAll().length % ROUTE_COLOR_PALETTE.length];

  const islands = Islands.getAll();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'route-modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${route ? 'Route bearbeiten' : 'Route anlegen'}</h2>

      <div class="form-group">
        <label for="input-route-name">Name</label>
        <input type="text" id="input-route-name" placeholder="z.B. Alte-Welt-Ringroute" value="${route ? escapeHtml(route.name) : ''}">
      </div>

      <div class="form-group">
        <label>Farbe</label>
        <div class="route-color-row">
          <div class="route-color-swatches" id="route-color-swatches">
            ${ROUTE_COLOR_PALETTE.map(
              (c) => `<button type="button" class="route-color-swatch ${c === draftRouteColor ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`
            ).join('')}
          </div>
          <input type="color" id="input-route-color-custom" value="${draftRouteColor}" title="Eigene Farbe">
        </div>
      </div>

      <div class="form-group">
        <label for="input-route-stop">Stationen (Reihenfolge)</label>
        <div class="chip-input-row">
          <select id="input-route-stop">
            ${islands.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('')}
          </select>
          <button class="btn btn-small" id="btn-add-stop">Hinzufügen</button>
        </div>
        <div id="route-stop-list"></div>
      </div>

      <div class="modal-actions">
        <button class="btn" id="btn-cancel-route-modal">Abbrechen</button>
        <button class="btn btn-primary" id="btn-save-route">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  renderRouteStopList();

  document.getElementById('btn-add-stop').addEventListener('click', () => {
    const select = document.getElementById('input-route-stop');
    if (!select.value) return;
    draftRouteStops.push(select.value);
    renderRouteStopList();
  });

  document.querySelectorAll('#route-color-swatches [data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftRouteColor = btn.dataset.color;
      document.getElementById('input-route-color-custom').value = draftRouteColor;
      document.querySelectorAll('#route-color-swatches .route-color-swatch').forEach((b) => {
        b.classList.toggle('selected', b.dataset.color === draftRouteColor);
      });
    });
  });

  document.getElementById('input-route-color-custom').addEventListener('input', (e) => {
    draftRouteColor = e.target.value;
    document.querySelectorAll('#route-color-swatches .route-color-swatch').forEach((b) => b.classList.remove('selected'));
  });

  document.getElementById('btn-cancel-route-modal').addEventListener('click', closeRouteModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeRouteModal();
  });

  document.getElementById('btn-save-route').addEventListener('click', saveRouteFromModal);
}

function renderRouteStopList() {
  const list = document.getElementById('route-stop-list');
  const islandsById = Object.fromEntries(Islands.getAll().map((i) => [i.id, i]));

  if (draftRouteStops.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:12px 0;">Noch keine Stationen ausgewählt.</div>`;
    return;
  }

  list.innerHTML = draftRouteStops
    .map((islandId, idx) => {
      const island = islandsById[islandId];
      const name = island ? island.name : '(gelöschte Insel)';
      return `
        <div class="route-stop-row">
          <span class="route-stop-index">${idx + 1}</span>
          <span class="route-stop-name">${escapeHtml(name)}</span>
          <button class="icon-btn" data-move-up="${idx}" title="Nach oben" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-move-down="${idx}" title="Nach unten" ${idx === draftRouteStops.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-remove-stop="${idx}" title="Entfernen">✕</button>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-move-up]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.moveUp);
      [draftRouteStops[idx - 1], draftRouteStops[idx]] = [draftRouteStops[idx], draftRouteStops[idx - 1]];
      renderRouteStopList();
    });
  });
  list.querySelectorAll('[data-move-down]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.moveDown);
      [draftRouteStops[idx + 1], draftRouteStops[idx]] = [draftRouteStops[idx], draftRouteStops[idx + 1]];
      renderRouteStopList();
    });
  });
  list.querySelectorAll('[data-remove-stop]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftRouteStops.splice(Number(btn.dataset.removeStop), 1);
      renderRouteStopList();
    });
  });
}

function saveRouteFromModal() {
  const name = document.getElementById('input-route-name').value.trim();
  if (!name) {
    alert('Bitte einen Namen für die Route angeben.');
    return;
  }
  if (draftRouteStops.length < 2) {
    alert('Eine Route braucht mindestens 2 Stationen.');
    return;
  }

  const routeData = { name, color: draftRouteColor, stops: draftRouteStops };

  if (editingRouteId) {
    ShipRoutes.update(editingRouteId, routeData);
  } else {
    ShipRoutes.add(routeData);
  }

  closeRouteModal();
  renderMapView();
}

function closeRouteModal() {
  const overlay = document.getElementById('route-modal-overlay');
  if (overlay) overlay.remove();
  editingRouteId = null;
  draftRouteStops = [];
}
