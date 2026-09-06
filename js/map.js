/*
 * Karte: Inseln als frei verschiebbare Boxen auf einer Canvas-Fläche,
 * verbunden durch Linien für gehandelte Waren (Produzent -> Konsument je Ware).
 * Positionen werden pro Insel-ID in localStorage gespeichert.
 */

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1400;
const BOX_DEFAULT_WIDTH = 170;
const BOX_DEFAULT_HEIGHT = 64;
const GRID_GAP = 40;
const GRID_COLUMNS = 6;

const MapPositions = {
  STORAGE_KEY: 'mapPositions',

  getAll() {
    return Storage.get(this.STORAGE_KEY, {});
  },

  saveAll(positions) {
    Storage.set(this.STORAGE_KEY, positions);
  },

  setPosition(islandId, x, y) {
    const positions = this.getAll();
    positions[islandId] = { x, y };
    this.saveAll(positions);
  },

  clearAll() {
    this.saveAll({});
  },
};

function renderMapView() {
  const view = document.getElementById('view-karte');
  const islands = Islands.getAll();

  view.innerHTML = `
    <div class="view-header">
      <h1>Karte</h1>
      <button class="btn" id="btn-reset-layout">Layout zurücksetzen</button>
    </div>
  `;

  if (islands.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Inseln angelegt. Leg zuerst unter "Inseln" welche an.';
    view.appendChild(empty);
    return;
  }

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

  const positions = assignMissingPositions(islands);
  const boxEls = {};

  islands.forEach((island) => {
    const pos = positions[island.id];
    const box = createIslandBox(island, pos);
    canvas.appendChild(box);
    boxEls[island.id] = box;
  });

  const edges = computeTradeEdges(islands);
  const edgeEls = drawEdges(svg, edges, boxEls);

  islands.forEach((island) => {
    setupDrag(boxEls[island.id], island.id, canvas, edges, edgeEls, boxEls);
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
  box.innerHTML = `
    <div class="map-island-box-title">${escapeHtml(island.name)}</div>
    ${island.functions.length ? `<div class="map-island-box-sub">${escapeHtml(island.functions[0])}${island.functions.length > 1 ? ` +${island.functions.length - 1}` : ''}</div>` : ''}
  `;
  return box;
}

function normalizeGoodName(good) {
  return good.trim().toLowerCase();
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join('|');
}

function computeTradeEdges(islands) {
  const goodMap = {}; // normalized good -> { displayName, producers: Set, consumers: Set }

  islands.forEach((island) => {
    island.goods.forEach((g) => {
      const norm = normalizeGoodName(g.good);
      if (!norm) return;
      if (!goodMap[norm]) {
        goodMap[norm] = { displayName: g.good.trim(), producers: new Set(), consumers: new Set() };
      }
      if (g.role === 'producer' || g.role === 'both') goodMap[norm].producers.add(island.id);
      if (g.role === 'consumer' || g.role === 'both') goodMap[norm].consumers.add(island.id);
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

function drawEdges(svg, edges, boxEls) {
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

    svg.appendChild(line);
    svg.appendChild(hitArea);
    svg.appendChild(label);

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

function setupDrag(box, islandId, canvas, edges, edgeEls, boxEls) {
  box.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = box.offsetLeft;
    const startTop = box.offsetTop;

    box.classList.add('dragging');

    const relatedEdges = edgeEls.filter((entry) => entry.edge.a === islandId || entry.edge.b === islandId);

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      newLeft = Math.max(0, Math.min(CANVAS_WIDTH - box.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(CANVAS_HEIGHT - box.offsetHeight, newTop));

      box.style.left = `${newLeft}px`;
      box.style.top = `${newTop}px`;

      relatedEdges.forEach((entry) => {
        updateEdgePosition(entry, boxEls[entry.edge.a], boxEls[entry.edge.b]);
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
