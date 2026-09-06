/*
 * Datenmodell:
 * Island = {
 *   id: string,
 *   name: string,
 *   functions: string[],            // Freitext-Tags, z.B. "Hauptstadt"
 *   vorkommen: [
 *     { good: string, count: number | null }   // Rohstoffquellen vor Ort
 *   ],
 *   goods: [
 *     { good: string, role: 'producer' | 'consumer' | 'both', count: number | null }
 *   ]
 * }
 *
 * good ist die kanonische Icon-ID aus GOODS_ICON_LIST (js/goods-icons-data.js,
 * z.B. "Oilwell"), nicht Freitext - die deutsche Anzeige kommt über
 * Translations.good(). count ist die Anzahl Vorkommen bzw. Fabriken,
 * optional (null wenn nicht angegeben).
 *
 * vorkommen vs. goods: automatisch aus data/production-chains.json abgeleitet
 * (RAW_MATERIAL_ICON_LIST = Güter, die in jeder Kette nur auf Level 0
 * auftreten, PRODUCED_GOOD_ICON_LIST = alles mit mindestens einer Vorstufe).
 * Ein Vorkommen hat keine Rolle (immer vor Ort verfügbar) - für die
 * automatische Handelsrouten-Berechnung auf der Karte zählt es wie ein
 * "Produzent" dieser Ware (siehe computeTradeEdges in map.js).
 */

const Islands = {
  DATA_PATH: 'data/islands.json',
  cache: [],

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, []);

    // Einmalige, automatische Migration von Alt-Daten: vor der Trennung von
    // Vorkommen/produzierten Gütern lagen alle Einträge in "goods". Rohstoffe
    // darunter (anhand RAW_MATERIAL_ICON_LIST erkannt) wandern nach
    // "vorkommen", die Rolle entfällt dabei (ein Vorkommen ist immer da).
    let migrated = false;
    this.cache.forEach((island) => {
      if (!island.vorkommen) island.vorkommen = [];
      if (!island.goods) island.goods = [];

      const stillGoods = [];
      island.goods.forEach((g) => {
        if (RAW_MATERIAL_ICON_LIST.includes(g.good)) {
          island.vorkommen.push({ good: g.good, count: g.count ?? null });
          migrated = true;
        } else {
          stillGoods.push(g);
        }
      });
      island.goods = stillGoods;
    });

    if (migrated) {
      this._persist('Migration: Vorkommen von produzierten Gütern getrennt');
    }
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
let draftVorkommen = []; // [{ good, count }]
let draftGoods = []; // [{ good, role, count }]
let activeGoodsTab = 'vorkommen';

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
      <div class="island-section-label">Vorkommen</div>
      ${renderGoodsTagRow(island.vorkommen || [], false)}
      <div class="island-section-label">Produzierte Güter</div>
      ${renderGoodsTagRow(island.goods || [], true)}
    </div>
  `;
}

function renderGoodsTagRow(items, showRole) {
  if (!items.length) {
    return `<div class="empty-state" style="padding:8px 0;">Keine erfasst</div>`;
  }
  return `<div class="tag-row">${items
    .map((g) => {
      const name = Translations.good(g.good, g.good);
      const countLabel = g.count ? ` ×${g.count}` : '';
      const roleDot = showRole ? `<span class="role-dot ${g.role}"></span>` : '';
      return `<span class="good-tag">${goodIconHtml(g.good, name, 'good-tag-icon')}${roleDot}${escapeHtml(name)}${countLabel}</span>`;
    })
    .join('')}</div>`;
}

function openIslandModal(islandId) {
  editingIslandId = islandId || null;
  const island = islandId ? Islands.getAll().find((i) => i.id === islandId) : null;

  draftFunctions = island ? [...island.functions] : [];
  draftVorkommen = island ? (island.vorkommen || []).map((v) => ({ ...v })) : [];
  draftGoods = island ? island.goods.map((g) => ({ ...g })) : [];
  activeGoodsTab = 'vorkommen';

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
        <div class="goods-tabs">
          <button type="button" class="goods-tab" data-tab="vorkommen">Vorkommen</button>
          <button type="button" class="goods-tab" data-tab="goods">Produzierte Güter</button>
        </div>

        <div id="vorkommen-panel">
          <input type="text" id="vorkommen-search" class="good-search" placeholder="Vorkommen suchen...">
          <div class="good-icon-grid" id="vorkommen-icon-grid"></div>
          <div class="island-section-label">Ausgewählte Vorkommen</div>
          <div id="vorkommen-entry-list"></div>
        </div>

        <div id="goods-panel" hidden>
          <input type="text" id="good-search" class="good-search" placeholder="Ware suchen...">
          <div class="good-icon-grid" id="good-icon-grid"></div>
          <div class="island-section-label">Ausgewählte produzierte Güter</div>
          <div id="good-entry-list"></div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn" id="btn-cancel-modal">Abbrechen</button>
        <button class="btn btn-primary" id="btn-save-island">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  renderFunctionChips();
  renderIconPickerGrid('vorkommen');
  renderIconPickerGrid('goods');
  renderEntryList('vorkommen');
  renderEntryList('goods');
  setActiveGoodsTab(activeGoodsTab);

  document.getElementById('btn-add-function').addEventListener('click', addFunctionFromInput);
  document.getElementById('input-function').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFunctionFromInput();
    }
  });

  document.querySelectorAll('.goods-tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveGoodsTab(btn.dataset.tab));
  });

  document.getElementById('vorkommen-search').addEventListener('input', () => renderIconPickerGrid('vorkommen'));
  document.getElementById('good-search').addEventListener('input', () => renderIconPickerGrid('goods'));

  document.getElementById('btn-cancel-modal').addEventListener('click', closeIslandModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeIslandModal();
  });

  document.getElementById('btn-save-island').addEventListener('click', saveIslandFromModal);
}

function setActiveGoodsTab(tab) {
  activeGoodsTab = tab;
  document.getElementById('vorkommen-panel').hidden = tab !== 'vorkommen';
  document.getElementById('goods-panel').hidden = tab !== 'goods';
  document.querySelectorAll('.goods-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
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

// kind: 'vorkommen' | 'goods'
function draftArrayFor(kind) {
  return kind === 'vorkommen' ? draftVorkommen : draftGoods;
}

function iconListFor(kind) {
  return kind === 'vorkommen' ? RAW_MATERIAL_ICON_LIST : PRODUCED_GOOD_ICON_LIST;
}

function renderIconPickerGrid(kind) {
  const grid = document.getElementById(kind === 'vorkommen' ? 'vorkommen-icon-grid' : 'good-icon-grid');
  const searchInput = document.getElementById(kind === 'vorkommen' ? 'vorkommen-search' : 'good-search');
  const term = (searchInput.value || '').trim().toLowerCase();
  const draftArray = draftArrayFor(kind);
  const selectedIds = new Set(draftArray.map((g) => g.good));

  const filtered = iconListFor(kind).filter((icon) => {
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
        <button type="button" class="good-icon-tile ${selected ? 'selected' : ''}" data-good-id="${icon}" data-kind="${kind}" title="${escapeHtml(name)}">
          ${goodIconHtml(icon, name, 'good-icon-tile-img')}
          <span class="good-icon-tile-label">${escapeHtml(name)}</span>
        </button>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-good-id]').forEach((btn) => {
    btn.addEventListener('click', () => toggleGoodSelection(btn.dataset.kind, btn.dataset.goodId));
  });
}

function toggleGoodSelection(kind, iconId) {
  const draftArray = draftArrayFor(kind);
  const idx = draftArray.findIndex((g) => g.good === iconId);
  if (idx === -1) {
    if (kind === 'vorkommen') {
      draftVorkommen.push({ good: iconId, count: null });
    } else {
      draftGoods.push({ good: iconId, role: 'producer', count: null });
    }
  } else {
    draftArray.splice(idx, 1);
  }
  renderIconPickerGrid(kind);
  renderEntryList(kind);
}

function renderEntryList(kind) {
  const isVorkommen = kind === 'vorkommen';
  const list = document.getElementById(isVorkommen ? 'vorkommen-entry-list' : 'good-entry-list');
  const draftArray = draftArrayFor(kind);

  if (draftArray.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:12px 0;">${isVorkommen ? 'Noch keine Vorkommen ausgewählt.' : 'Noch keine Güter ausgewählt.'}</div>`;
    return;
  }

  list.innerHTML = draftArray
    .map((g, idx) => {
      const name = Translations.good(g.good, g.good);
      const roleSelectHtml = isVorkommen
        ? ''
        : `
        <select class="role-select" data-role-idx="${idx}">
          <option value="producer" ${g.role === 'producer' ? 'selected' : ''}>Produzent</option>
          <option value="consumer" ${g.role === 'consumer' ? 'selected' : ''}>Konsument</option>
          <option value="both" ${g.role === 'both' ? 'selected' : ''}>Beides</option>
        </select>
      `;
      return `
        <div class="good-entry-row">
          ${goodIconHtml(g.good, name, 'good-entry-icon')}
          <span class="good-entry-name">${escapeHtml(name)}</span>
          ${roleSelectHtml}
          <input type="number" min="0" class="good-count-input" data-count-idx="${idx}" placeholder="Anzahl" value="${g.count ?? ''}">
          <button class="icon-btn" data-remove-idx="${idx}" title="Entfernen">✕</button>
        </div>
      `;
    })
    .join('');

  if (!isVorkommen) {
    list.querySelectorAll('[data-role-idx]').forEach((select) => {
      select.addEventListener('change', () => {
        draftGoods[Number(select.dataset.roleIdx)].role = select.value;
      });
    });
  }
  list.querySelectorAll('[data-count-idx]').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.countIdx);
      const val = input.value.trim();
      draftArray[idx].count = val === '' ? null : Number(val);
    });
  });
  list.querySelectorAll('[data-remove-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftArray.splice(Number(btn.dataset.removeIdx), 1);
      renderEntryList(kind);
      renderIconPickerGrid(kind);
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
    vorkommen: draftVorkommen,
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
  draftVorkommen = [];
  draftGoods = [];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
