/*
 * Warenketten-Referenz: zeigt die Anno-1800-Produktionsketten aus
 * data/production-chains.json, gruppiert nach Kategorie, mit Suche.
 *
 * Daten & Icons stammen aus dem Community-Projekt
 * https://github.com/dotSp0T/Anno_1800_Chains_Consumption von Michael
 * Stocker (@dot_Sp0T), Zahlen/Icons ursprünglich von anno1800.fandom.com.
 * Lizenz: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
 */

const CATEGORY_ORDER = [
  'Building Materials',
  'Farmer Consumables',
  'Worker Consumables',
  'Jornalero Consumables',
  'Artisan Consumables',
  'Engineer Consumables',
  'Investor Consumables',
  'Obrero Consumables',
];

let productionChains = null;
let chainsLoadPromise = null;
let warenkettenSearchTerm = '';

function loadProductionChains() {
  if (productionChains) return Promise.resolve(productionChains);
  if (!chainsLoadPromise) {
    chainsLoadPromise = fetch('data/production-chains.json')
      .then((res) => res.json())
      .then((data) => {
        productionChains = data.chains;
        return productionChains;
      });
  }
  return chainsLoadPromise;
}

function renderWarenkettenView() {
  const view = document.getElementById('view-warenketten');

  view.innerHTML = `
    <div class="view-header">
      <h1>Warenketten</h1>
    </div>
    <input type="text" id="warenketten-search" class="warenketten-search" placeholder="Ware suchen, z.B. Stahl, Bricks..." value="${escapeHtml(warenkettenSearchTerm)}">
    <div id="warenketten-content" class="warenketten-content">
      <div class="empty-state">Lade Warenketten...</div>
    </div>
    <div class="warenketten-footer">
      Daten &amp; Icons: Michael Stocker
      (<a href="https://github.com/dotSp0T/Anno_1800_Chains_Consumption" target="_blank" rel="noopener">Anno_1800_Chains_Consumption</a>),
      basierend auf <a href="https://anno1800.fandom.com" target="_blank" rel="noopener">anno1800.fandom.com</a>.
      Lizenz: <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>
    </div>
  `;

  const searchInput = document.getElementById('warenketten-search');
  searchInput.addEventListener('input', () => {
    warenkettenSearchTerm = searchInput.value;
    renderWarenkettenContent();
  });
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);

  loadProductionChains()
    .then(() => renderWarenkettenContent())
    .catch((err) => {
      console.error('Konnte Warenketten nicht laden', err);
      document.getElementById('warenketten-content').innerHTML =
        `<div class="empty-state">Warenketten konnten nicht geladen werden.</div>`;
    });
}

function renderWarenkettenContent() {
  const content = document.getElementById('warenketten-content');
  if (!content || !productionChains) return;

  const term = warenkettenSearchTerm.trim().toLowerCase();

  const chainsByCategory = {};
  productionChains.forEach((chain) => {
    if (term) {
      const matches = chain.nodes.some((n) => n.name.toLowerCase().includes(term));
      if (!matches) return;
    }
    if (!chainsByCategory[chain.category]) chainsByCategory[chain.category] = [];
    chainsByCategory[chain.category].push(chain);
  });

  const categoriesToShow = CATEGORY_ORDER.filter((cat) => chainsByCategory[cat]?.length);

  if (categoriesToShow.length === 0) {
    content.innerHTML = `<div class="empty-state">Keine Waren gefunden für "${escapeHtml(warenkettenSearchTerm)}".</div>`;
    return;
  }

  content.innerHTML = categoriesToShow
    .map(
      (category) => `
      <section class="warenketten-category">
        <h2 class="warenketten-category-title">${escapeHtml(category)}</h2>
        <div class="chain-card-grid">
          ${chainsByCategory[category].map(renderChainCard).join('')}
        </div>
      </section>
    `
    )
    .join('');
}

function renderChainCard(chain) {
  const maxLevel = Math.max(...chain.nodes.map((n) => n.level));
  const levels = [];
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    levels.push(chain.nodes.filter((n) => n.level === lvl));
  }

  const finalNode = chain.nodes.find((n) => n.isFinal);
  const consumedBy = finalNode?.consumedBy || [];

  return `
    <div class="chain-card">
      <div class="chain-card-title">
        ${goodIconHtml(finalNode.icon, finalNode.name, 'chain-card-title-icon')}
        <span>${escapeHtml(finalNode.name)}</span>
      </div>
      <div class="chain-flow">
        ${levels
          .map(
            (levelNodes, idx) => `
              ${idx > 0 ? '<span class="chain-arrow">→</span>' : ''}
              <div class="chain-level">
                ${levelNodes.map(renderChainNode).join('')}
              </div>
            `
          )
          .join('')}
      </div>
      ${
        consumedBy.length
          ? `<div class="chain-consumed-by">Verbraucht von: ${consumedBy.map((c) => `<span class="tag">${escapeHtml(c)}</span>`).join('')}</div>`
          : ''
      }
    </div>
  `;
}

function renderChainNode(node) {
  return `
    <div class="chain-node" title="${escapeHtml(node.name)}${node.building ? ' — ' + escapeHtml(node.building) : ''}">
      <div class="chain-node-icon-wrap">
        ${goodIconHtml(node.icon, node.name, 'chain-node-icon')}
        ${node.amount ? `<span class="chain-node-amount">×${escapeHtml(node.amount)}</span>` : ''}
      </div>
      <div class="chain-node-name">${escapeHtml(node.name)}</div>
      ${node.building ? `<div class="chain-node-building">${escapeHtml(node.building)}</div>` : ''}
      ${node.fieldInfo ? `<div class="chain-node-building">${escapeHtml(node.fieldInfo)}</div>` : ''}
    </div>
  `;
}

function goodIconHtml(icon, name, className) {
  const src = `assets/goods-icons/${encodeURIComponent(icon)}.png`;
  return `<img class="${className}" src="${src}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.onerror=null;this.classList.add('icon-missing');">`;
}
