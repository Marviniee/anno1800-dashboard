/*
 * Datenmodell:
 * Island = {
 *   id: string,
 *   name: string,
 *   functions: string[],            // Freitext-Tags, z.B. "Hauptstadt"
 *   goods: [
 *     { good: string, role: 'producer' | 'consumer' | 'both', count: number | null }
 *   ]
 * }
 *
 * good ist die kanonische Icon-ID aus GOODS_ICON_LIST (js/goods-icons-data.js,
 * z.B. "Oilwell"), nicht mehr Freitext - die deutsche Anzeige kommt über
 * Translations.good(). count ist die Anzahl Vorkommen (z.B. 3 Eisenvorkommen),
 * optional; ältere Einträge ohne count werden als count: null/undefined
 * behandelt und einfach ohne Mengenangabe angezeigt.
 *
 * Das goods[].role-Feld ist die Grundlage für spätere Handelsrouten:
 * Route = Produzent-Insel -> Konsument-Insel je Ware. Dafür muss dieses
 * Insel-Datenmodell nicht mehr geändert werden.
 */

const Islands = {
  DATA_PATH: 'data/islands.json',
  cache: [],

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, []);
  },

  getAll() {
    return this.cache;
  },

  add(island) {
    island.id = crypto.randomUUID();
    this.cache.push(island);
    this._persist(`Insel hinzugefügt: ${island.name}`);
    return island;
  },

  update(id, updatedIsland) {
    const idx = this.cache.findIndex((i) => i.id === id);
    if (idx === -1) return;
    this.cache[idx] = { ...updatedIsland, id };
    this._persist(`Insel bearbeitet: ${updatedIsland.name}`);
  },

  remove(id) {
    const island = this.cache.find((i) => i.id === id);
    this.cache = this.cache.filter((i) => i.id !== id);
    this._persist(`Insel gelöscht: ${island ? island.name : id}`);
  },

  _persist(message) {
    setSyncStatus('saving');
    GitHubSync.writeJson(this.DATA_PATH, this.cache, message)
      .then(() => setSyncStatus('saved'))
      .catch((e) => {
        console.error('Islands persist failed', e);
        setSyncStatus('error', e.message);
        alert(`Speichern fehlgeschlagen: ${e.message}`);
      });
  },
};

const ROLE_LABELS = {
  producer: 'Produzent',
  consumer: 'Konsument',
  both: 'Beides',
};

let editingIslandId = null;
let draftFunctions = [];
let draftGoods = []; // [{ good, role }]

function renderIslandsView() {
  const view = document.getElementById('view-inseln');
  const islands = Islands.getAll();

  view.innerHTML = `
    <div class="view-header">
      <h1>Inseln</h1>
      <button class="btn btn-primary" id="btn-add-island">+ Insel hinzufügen</button>
    </div>
    <div id="islands-container"></div>
  `;

  const container = document.getElementById('islands-container');

  if (islands.length === 0) {
    container.innerHTML = `<div class="empty-state">Noch keine Inseln erfasst. Leg deine erste Insel an.</div>`;
  } else {
    container.innerHTML = `<div class="island-grid">${islands.map(renderIslandCard).join('')}</div>`;
  }

  document.getElementById('btn-add-island').addEventListener('click', () => openIslandModal());

  container.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => openIslandModal(btn.dataset.editId));
  });
  container.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const island = islands.find((i) => i.id === btn.dataset.deleteId);
      if (confirm(`Insel "${island.name}" wirklich löschen?`)) {
        Islands.remove(btn.dataset.deleteId);
        renderIslandsView();
      }
    });
  });
}

function renderIslandCard(island) {
  const functionsHtml = island.functions.length
    ? `<div class="tag-row">${island.functions.map((f) => `<span class="tag function-tag">${escapeHtml(f)}</span>`).join('')}</div>`
    : '';

  const goodsHtml = island.goods.length
    ? `<div class="tag-row">${island.goods
        .map((g) => {
          const name = Translations.good(g.good, g.good);
          const countLabel = g.count ? ` ×${g.count}` : '';
          return `<span class="good-tag">${goodIconHtml(g.good, name, 'good-tag-icon')}<span class="role-dot ${g.role}"></span>${escapeHtml(name)}${countLabel}</span>`;
        })
        .join('')}</div>`
    : `<div class="empty-state" style="padding:8px 0;">Keine Güter erfasst</div>`;

  return `
    <div class="island-card">
      <div class="island-card-header">
        <h3>${escapeHtml(island.name)}</h3>
        <div class="island-card-actions">
          <button class="icon-btn" data-edit-id="${island.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn" data-delete-id="${island.id}" title="Löschen">🗑</button>
        </div>
      </div>
      ${functionsHtml}
      <div class="island-section-label">Güter vor Ort</div>
      ${goodsHtml}
    </div>
  `;
}

function openIslandModal(islandId) {
  editingIslandId = islandId || null;
  const island = islandId ? Islands.getAll().find((i) => i.id === islandId) : null;

  draftFunctions = island ? [...island.functions] : [];
  draftGoods = island ? island.goods.map((g) => ({ ...g })) : [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'island-modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${island ? 'Insel bearbeiten' : 'Insel hinzufügen'}</h2>

      <div class="form-group">
        <label for="input-island-name">Name</label>
        <input type="text" id="input-island-name" placeholder="z.B. Kap Trelawney" value="${island ? escapeHtml(island.name) : ''}">
      </div>

      <div class="form-group">
        <label for="input-function">Funktion(en)</label>
        <div class="chip-input-row">
          <input type="text" id="input-function" placeholder="z.B. Rohstoff-Insel, Enter zum Hinzufügen">
          <button class="btn btn-small" id="btn-add-function">Hinzufügen</button>
        </div>
        <div class="chip-list" id="function-chip-list"></div>
      </div>

      <div class="form-group">
        <label for="good-search">Güter vor Ort</label>
        <input type="text" id="good-search" class="good-search" placeholder="Ware suchen...">
        <div class="good-icon-grid" id="good-icon-grid"></div>
      </div>

      <div class="form-group">
        <label>Ausgewählte Güter</label>
        <div id="good-entry-list"></div>
      </div>

      <div class="modal-actions">
        <button class="btn" id="btn-cancel-modal">Abbrechen</button>
        <button class="btn btn-primary" id="btn-save-island">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  renderFunctionChips();
  renderGoodIconGrid();
  renderGoodEntries();

  document.getElementById('btn-add-function').addEventListener('click', addFunctionFromInput);
  document.getElementById('input-function').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFunctionFromInput();
    }
  });

  document.getElementById('good-search').addEventListener('input', renderGoodIconGrid);

  document.getElementById('btn-cancel-modal').addEventListener('click', closeIslandModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeIslandModal();
  });

  document.getElementById('btn-save-island').addEventListener('click', saveIslandFromModal);
}

function addFunctionFromInput() {
  const input = document.getElementById('input-function');
  const value = input.value.trim();
  if (!value || draftFunctions.includes(value)) {
    input.value = '';
    return;
  }
  draftFunctions.push(value);
  input.value = '';
  renderFunctionChips();
}

function renderFunctionChips() {
  const list = document.getElementById('function-chip-list');
  list.innerHTML = draftFunctions
    .map(
      (f, idx) =>
        `<span class="chip">${escapeHtml(f)}<button data-remove-function="${idx}">✕</button></span>`
    )
    .join('');
  list.querySelectorAll('[data-remove-function]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftFunctions.splice(Number(btn.dataset.removeFunction), 1);
      renderFunctionChips();
    });
  });
}

function renderGoodIconGrid() {
  const grid = document.getElementById('good-icon-grid');
  const term = (document.getElementById('good-search').value || '').trim().toLowerCase();
  const selectedIds = new Set(draftGoods.map((g) => g.good));

  const filtered = GOODS_ICON_LIST.filter((icon) => {
    if (!term) return true;
    const name = Translations.good(icon, icon).toLowerCase();
    return name.includes(term) || icon.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="padding:16px 0;">Keine Ware gefunden.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((icon) => {
      const name = Translations.good(icon, icon);
      const selected = selectedIds.has(icon);
      return `
        <button type="button" class="good-icon-tile ${selected ? 'selected' : ''}" data-good-id="${icon}" title="${escapeHtml(name)}">
          ${goodIconHtml(icon, name, 'good-icon-tile-img')}
          <span class="good-icon-tile-label">${escapeHtml(name)}</span>
        </button>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-good-id]').forEach((btn) => {
    btn.addEventListener('click', () => toggleGoodSelection(btn.dataset.goodId));
  });
}

function toggleGoodSelection(iconId) {
  const idx = draftGoods.findIndex((g) => g.good === iconId);
  if (idx === -1) {
    draftGoods.push({ good: iconId, role: 'producer', count: null });
  } else {
    draftGoods.splice(idx, 1);
  }
  renderGoodIconGrid();
  renderGoodEntries();
}

function renderGoodEntries() {
  const list = document.getElementById('good-entry-list');
  if (draftGoods.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:12px 0;">Noch keine Güter ausgewählt.</div>`;
    return;
  }
  list.innerHTML = draftGoods
    .map((g, idx) => {
      const name = Translations.good(g.good, g.good);
      return `
      <div class="good-entry-row">
        ${goodIconHtml(g.good, name, 'good-entry-icon')}
        <span class="good-entry-name">${escapeHtml(name)}</span>
        <select class="role-select" data-role-idx="${idx}">
          <option value="producer" ${g.role === 'producer' ? 'selected' : ''}>Produzent</option>
          <option value="consumer" ${g.role === 'consumer' ? 'selected' : ''}>Konsument</option>
          <option value="both" ${g.role === 'both' ? 'selected' : ''}>Beides</option>
        </select>
        <input type="number" min="0" class="good-count-input" data-count-idx="${idx}" placeholder="Anzahl" value="${g.count ?? ''}">
        <button class="icon-btn" data-remove-good="${idx}" title="Entfernen">✕</button>
      </div>
    `;
    })
    .join('');

  list.querySelectorAll('[data-role-idx]').forEach((select) => {
    select.addEventListener('change', () => {
      draftGoods[Number(select.dataset.roleIdx)].role = select.value;
    });
  });
  list.querySelectorAll('[data-count-idx]').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.countIdx);
      const val = input.value.trim();
      draftGoods[idx].count = val === '' ? null : Number(val);
    });
  });
  list.querySelectorAll('[data-remove-good]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeGood);
      draftGoods.splice(idx, 1);
      renderGoodEntries();
      renderGoodIconGrid();
    });
  });
}

function saveIslandFromModal() {
  const name = document.getElementById('input-island-name').value.trim();
  if (!name) {
    alert('Bitte einen Namen für die Insel angeben.');
    return;
  }

  const islandData = {
    name,
    functions: draftFunctions,
    goods: draftGoods,
  };

  if (editingIslandId) {
    Islands.update(editingIslandId, islandData);
  } else {
    Islands.add(islandData);
  }

  closeIslandModal();
  renderIslandsView();
}

function closeIslandModal() {
  const overlay = document.getElementById('island-modal-overlay');
  if (overlay) overlay.remove();
  editingIslandId = null;
  draftFunctions = [];
  draftGoods = [];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
