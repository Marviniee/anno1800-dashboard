/*
 * Datenmodell:
 * Todo = {
 *   id: string,
 *   text: string,
 *   importance: 'low' | 'medium' | 'high',
 *   done: boolean,
 *   islandId: string | null,  // optionaler Bezug zu einer Insel (pro Eintrag)
 *   parentId: string | null   // Eltern-To-Do, null = Haupt-To-Do
 * }
 *
 * Outliner-Prinzip: jedes To-Do kann beliebig viele Unter-ToDos haben, ohne
 * Tiefenbegrenzung. Gespeichert wird flach (Liste mit parentId), der Baum
 * wird beim Rendern aufgebaut. Ein Eintrag, dessen Eltern-To-Do nicht mehr
 * existiert, wird wie ein Haupt-To-Do behandelt statt zu verschwinden.
 */

const Todos = {
  DATA_PATH: 'data/todos.json',
  cache: [],

  async load() {
    this.cache = await GitHubSync.readJson(this.DATA_PATH, []);

    // Migration: flache To-Dos aus der Zeit vor den Unter-ToDos bekommen
    // parentId: null (= Haupt-To-Do), sonst bleibt alles unverändert.
    let migrated = false;
    this.cache.forEach((todo) => {
      if (todo.parentId === undefined) {
        todo.parentId = null;
        migrated = true;
      }
    });
    if (migrated) this._persist('Migration: To-Dos mit parentId für Unter-ToDos');
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

  // Löscht ein To-Do samt aller Unter-ToDos (beliebig tief).
  remove(id) {
    const todo = this.cache.find((t) => t.id === id);
    const doomed = new Set([id, ...this.descendantIds(id)]);
    this.cache = this.cache.filter((t) => !doomed.has(t.id));
    this._persist(`To-Do gelöscht: ${todo ? todo.text : id}`);
  },

  toggleDone(id) {
    const todo = this.cache.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    this._persist(`To-Do ${todo.done ? 'erledigt' : 'wieder geöffnet'}: ${todo.text}`);
  },

  setImportance(id, importance) {
    const todo = this.cache.find((t) => t.id === id);
    if (!todo) return;
    todo.importance = importance;
    this._persist(`To-Do Wichtigkeit ${IMPORTANCE_LABELS[importance]}: ${todo.text}`);
  },

  setIsland(id, islandId) {
    const todo = this.cache.find((t) => t.id === id);
    if (!todo) return;
    todo.islandId = islandId;
    this._persist(`To-Do Insel geändert: ${todo.text}`);
  },

  descendantIds(id) {
    const result = [];
    const stack = [id];
    while (stack.length) {
      const current = stack.pop();
      this.cache.forEach((t) => {
        if (t.parentId === current) {
          result.push(t.id);
          stack.push(t.id);
        }
      });
    }
    return result;
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
// Klick auf den Wichtigkeits-Punkt schaltet reihum weiter.
const IMPORTANCE_NEXT = { high: 'medium', medium: 'low', low: 'high' };

let todoCompletedExpanded = false;
// Eintrag, unter dem gerade das Formular für ein neues Unter-ToDo offen ist.
let todoAddingChildTo = null;

// Eingeklappte Einträge sind eine reine Ansichts-Einstellung pro Gerät.
const TODO_COLLAPSED_STORAGE_KEY = 'todoCollapsed';
let todoCollapsed = new Set(Storage.get(TODO_COLLAPSED_STORAGE_KEY, []));

function toggleTodoCollapsed(id) {
  if (todoCollapsed.has(id)) todoCollapsed.delete(id);
  else todoCollapsed.add(id);
  Storage.set(TODO_COLLAPSED_STORAGE_KEY, [...todoCollapsed]);
}

// Offene vor erledigten, innerhalb davon nach Wichtigkeit.
function compareTodos(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
}

function buildTodoChildrenMap(todos) {
  const ids = new Set(todos.map((t) => t.id));
  const children = { root: [] };
  todos.forEach((t) => {
    const key = t.parentId && ids.has(t.parentId) ? t.parentId : 'root';
    (children[key] = children[key] || []).push(t);
  });
  Object.values(children).forEach((list) => list.sort(compareTodos));
  return children;
}

function islandOptionsHtml(islands, selectedId) {
  return `
    <option value="">Keine Insel</option>
    ${islands
      .map((i) => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${escapeHtml(islandLabel(i))}</option>`)
      .join('')}
  `;
}

function renderTodosView() {
  const view = document.getElementById('view-todos');
  const todos = Todos.getAll();
  const islands = Islands.getAll();
  const islandsById = Object.fromEntries(islands.map((i) => [i.id, i]));
  const children = buildTodoChildrenMap(todos);

  // Aufteilung nur auf oberster Ebene: ein erledigtes Haupt-To-Do wandert
  // samt Unterbaum nach "Erledigt", Unter-ToDos bleiben bei ihrem Eltern-
  // Eintrag (erledigte dort durchgestrichen).
  const openRoots = children.root.filter((t) => !t.done);
  const completedRoots = children.root.filter((t) => t.done);

  const ctx = { children, islands, islandsById };

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
      <select id="input-todo-island">${islandOptionsHtml(islands, null)}</select>
      <button class="btn btn-primary" id="btn-add-todo">+ Hinzufügen</button>
    </div>

    <div id="open-todos-container"></div>

    <div class="todo-completed-section">
      <button class="todo-completed-toggle" id="btn-toggle-completed">
        ${todoCompletedExpanded ? '▾' : '▸'} Erledigt (${completedRoots.length})
      </button>
      <div class="todo-list" id="completed-todos-container" ${todoCompletedExpanded ? '' : 'hidden'}></div>
    </div>
  `;

  const openContainer = document.getElementById('open-todos-container');
  if (todos.length === 0) {
    openContainer.innerHTML = `<div class="empty-state">Noch keine To-Dos angelegt.</div>`;
  } else if (openRoots.length === 0) {
    openContainer.innerHTML = `<div class="empty-state">Keine offenen To-Dos 🎉</div>`;
  } else {
    openContainer.innerHTML = `<div class="todo-list">${openRoots.map((t) => renderTodoNode(t, ctx)).join('')}</div>`;
  }

  document.getElementById('completed-todos-container').innerHTML = completedRoots
    .map((t) => renderTodoNode(t, ctx))
    .join('');

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

  setupTodoTreeEvents(view);

  const childInput = document.getElementById('input-child-todo-text');
  if (childInput) childInput.focus();
}

function setupTodoTreeEvents(view) {
  view.querySelectorAll('[data-toggle-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      Todos.toggleDone(checkbox.dataset.toggleId);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-importance-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todo = Todos.getAll().find((t) => t.id === btn.dataset.importanceId);
      if (!todo) return;
      Todos.setImportance(todo.id, IMPORTANCE_NEXT[todo.importance]);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-island-select-id]').forEach((select) => {
    select.addEventListener('change', () => {
      Todos.setIsland(select.dataset.islandSelectId, select.value || null);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-collapse-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleTodoCollapsed(btn.dataset.collapseId);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-add-child-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.addChildId;
      todoAddingChildTo = todoAddingChildTo === id ? null : id;
      // Beim Hinzufügen muss der Eintrag aufgeklappt sein, sonst sieht man
      // das neue Unter-ToDo nicht.
      if (todoAddingChildTo && todoCollapsed.has(id)) toggleTodoCollapsed(id);
      renderTodosView();
    });
  });

  view.querySelectorAll('[data-delete-todo-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteTodoId;
      const todo = Todos.getAll().find((t) => t.id === id);
      const childCount = Todos.descendantIds(id).length;
      if (childCount > 0 && !confirm(`"${todo.text}" inklusive ${childCount} Unter-ToDo(s) löschen?`)) return;
      Todos.remove(id);
      renderTodosView();
    });
  });

  const saveChild = document.getElementById('btn-save-child-todo');
  if (saveChild) {
    saveChild.addEventListener('click', addChildTodoFromForm);
    document.getElementById('input-child-todo-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addChildTodoFromForm();
      } else if (e.key === 'Escape') {
        todoAddingChildTo = null;
        renderTodosView();
      }
    });
    document.getElementById('btn-cancel-child-todo').addEventListener('click', () => {
      todoAddingChildTo = null;
      renderTodosView();
    });
  }
}

function countSubtree(id, children) {
  let total = 0;
  let done = 0;
  (children[id] || []).forEach((child) => {
    total++;
    if (child.done) done++;
    const sub = countSubtree(child.id, children);
    total += sub.total;
    done += sub.done;
  });
  return { total, done };
}

function renderTodoNode(todo, ctx) {
  const kids = ctx.children[todo.id] || [];
  const collapsed = todoCollapsed.has(todo.id);
  const { total, done } = countSubtree(todo.id, ctx.children);

  const childrenHtml =
    !collapsed && (kids.length || todoAddingChildTo === todo.id)
      ? `<div class="todo-children">
          ${kids.map((k) => renderTodoNode(k, ctx)).join('')}
          ${todoAddingChildTo === todo.id ? renderChildAddRow(todo, ctx.islands) : ''}
        </div>`
      : '';

  return `
    <div class="todo-node">
      ${renderTodoRow(todo, ctx, { hasChildren: kids.length > 0, collapsed, total, done })}
      ${childrenHtml}
    </div>
  `;
}

function renderTodoRow(todo, ctx, tree) {
  const island = todo.islandId ? ctx.islandsById[todo.islandId] : null;
  const collapseBtn = tree.hasChildren
    ? `<button class="todo-collapse-btn" data-collapse-id="${todo.id}" title="${tree.collapsed ? 'Aufklappen' : 'Einklappen'}">${tree.collapsed ? '▸' : '▾'}</button>`
    : `<span class="todo-collapse-spacer"></span>`;

  return `
    <div class="todo-row ${todo.done ? 'done' : ''}">
      ${collapseBtn}
      <label class="todo-checkbox-wrap">
        <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} data-toggle-id="${todo.id}">
      </label>
      <button class="importance-dot-btn" data-importance-id="${todo.id}" title="Wichtigkeit: ${IMPORTANCE_LABELS[todo.importance]} (klicken zum Ändern)">
        <span class="importance-dot importance-${todo.importance}"></span>
      </button>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      ${tree.total ? `<span class="todo-progress" title="Erledigte Unter-ToDos">${tree.done}/${tree.total}</span>` : ''}
      <label class="todo-island-select-wrap ${island ? 'has-island' : ''}" title="Insel-Bezug">
        <select class="todo-island-select" data-island-select-id="${todo.id}">${islandOptionsHtml(ctx.islands, todo.islandId)}</select>
      </label>
      <button class="icon-btn" data-add-child-id="${todo.id}" title="Unter-ToDo hinzufügen">＋</button>
      <button class="icon-btn" data-delete-todo-id="${todo.id}" title="Löschen">🗑</button>
    </div>
  `;
}

function renderChildAddRow(parent, islands) {
  return `
    <div class="todo-add-row todo-child-add-row">
      <input type="text" id="input-child-todo-text" placeholder="Unter-ToDo für &quot;${escapeHtml(parent.text)}&quot;...">
      <select id="input-child-todo-importance">
        <option value="high">Hoch</option>
        <option value="medium" selected>Mittel</option>
        <option value="low">Niedrig</option>
      </select>
      <select id="input-child-todo-island">${islandOptionsHtml(islands, parent.islandId)}</select>
      <button class="btn btn-primary" id="btn-save-child-todo">Hinzufügen</button>
      <button class="btn" id="btn-cancel-child-todo">Abbrechen</button>
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
    parentId: null,
  });

  renderTodosView();
}

// Nach dem Speichern bleibt das Formular offen, damit man mehrere
// Unter-ToDos hintereinander eintippen kann (Escape/Abbrechen schließt es).
function addChildTodoFromForm() {
  const text = document.getElementById('input-child-todo-text').value.trim();
  if (!text || !todoAddingChildTo) return;

  Todos.add({
    text,
    importance: document.getElementById('input-child-todo-importance').value,
    islandId: document.getElementById('input-child-todo-island').value || null,
    done: false,
    parentId: todoAddingChildTo,
  });

  renderTodosView();
}
