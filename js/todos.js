/*
 * Datenmodell:
 * Todo = {
 *   id: string,
 *   text: string,
 *   importance: 'low' | 'medium' | 'high',
 *   done: boolean,
 *   islandId: string | null   // optionaler Bezug zu einer Insel
 * }
 */

const Todos = {
  DATA_PATH: 'data/todos.json',
  cache: [],

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, []);
  },

  getAll() {
    return this.cache;
  },

  add(todo) {
    todo.id = crypto.randomUUID();
    this.cache.push(todo);
    this._persist(`To-Do hinzugefügt: ${todo.text}`);
    return todo;
  },

  remove(id) {
    const todo = this.cache.find((t) => t.id === id);
    this.cache = this.cache.filter((t) => t.id !== id);
    this._persist(`To-Do gelöscht: ${todo ? todo.text : id}`);
  },

  toggleDone(id) {
    const todo = this.cache.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    this._persist(`To-Do ${todo.done ? 'erledigt' : 'wieder geöffnet'}: ${todo.text}`);
  },

  _persist(message) {
    setSyncStatus('saving');
    GitHubSync.writeJson(this.DATA_PATH, this.cache, message)
      .then(() => setSyncStatus('saved'))
      .catch((e) => {
        console.error('Todos persist failed', e);
        setSyncStatus('error', e.message);
        alert(`Speichern fehlgeschlagen: ${e.message}`);
      });
  },
};

const IMPORTANCE_LABELS = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };
const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 };

let todoCompletedExpanded = false;

function renderTodosView() {
  const view = document.getElementById('view-todos');
  const todos = Todos.getAll();
  const islands = Islands.getAll();
  const islandsById = Object.fromEntries(islands.map((i) => [i.id, i]));

  const openTodos = todos
    .filter((t) => !t.done)
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);
  const completedTodos = todos
    .filter((t) => t.done)
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);

  view.innerHTML = `
    <div class="view-header">
      <h1>To-Dos</h1>
    </div>
    <div class="todo-add-row">
      <input type="text" id="input-todo-text" placeholder="Neues To-Do...">
      <select id="input-todo-importance">
        <option value="high">Hoch</option>
        <option value="medium" selected>Mittel</option>
        <option value="low">Niedrig</option>
      </select>
      <select id="input-todo-island">
        <option value="">Keine Insel</option>
        ${islands.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="btn-add-todo">+ Hinzufügen</button>
    </div>

    <div id="open-todos-container"></div>

    <div class="todo-completed-section">
      <button class="todo-completed-toggle" id="btn-toggle-completed">
        ${todoCompletedExpanded ? '▾' : '▸'} Erledigt (${completedTodos.length})
      </button>
      <div class="todo-list" id="completed-todos-container" ${todoCompletedExpanded ? '' : 'hidden'}></div>
    </div>
  `;

  const openContainer = document.getElementById('open-todos-container');
  if (todos.length === 0) {
    openContainer.innerHTML = `<div class="empty-state">Noch keine To-Dos angelegt.</div>`;
  } else if (openTodos.length === 0) {
    openContainer.innerHTML = `<div class="empty-state">Keine offenen To-Dos 🎉</div>`;
  } else {
    openContainer.innerHTML = `<div class="todo-list">${openTodos
      .map((t) => renderTodoRow(t, islandsById))
      .join('')}</div>`;
  }

  const completedContainer = document.getElementById('completed-todos-container');
  completedContainer.innerHTML = completedTodos.map((t) => renderTodoRow(t, islandsById)).join('');

  document.getElementById('btn-add-todo').addEventListener('click', addTodoFromForm);
  document.getElementById('input-todo-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodoFromForm();
    }
  });

  document.getElementById('btn-toggle-completed').addEventListener('click', () => {
    todoCompletedExpanded = !todoCompletedExpanded;
    renderTodosView();
  });

  view.querySelectorAll('[data-toggle-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      Todos.toggleDone(checkbox.dataset.toggleId);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-delete-todo-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Todos.remove(btn.dataset.deleteTodoId);
      renderTodosView();
    });
  });
}

function renderTodoRow(todo, islandsById) {
  const island = todo.islandId ? islandsById[todo.islandId] : null;

  return `
    <div class="todo-row ${todo.done ? 'done' : ''}">
      <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} data-toggle-id="${todo.id}">
      <span class="importance-dot importance-${todo.importance}" title="Wichtigkeit: ${IMPORTANCE_LABELS[todo.importance]}"></span>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      ${island ? `<span class="tag todo-island-tag">${escapeHtml(island.name)}</span>` : ''}
      <button class="icon-btn" data-delete-todo-id="${todo.id}" title="Löschen">🗑</button>
    </div>
  `;
}

function addTodoFromForm() {
  const textInput = document.getElementById('input-todo-text');
  const importanceInput = document.getElementById('input-todo-importance');
  const islandInput = document.getElementById('input-todo-island');

  const text = textInput.value.trim();
  if (!text) return;

  Todos.add({
    text,
    importance: importanceInput.value,
    islandId: islandInput.value || null,
    done: false,
  });

  renderTodosView();
}
