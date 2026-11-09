import { useEffect, useMemo, useState } from 'react'
import { breakDown, getApiKey, parseTasks, setApiKey, suggestNext, MODEL } from './ai.js'

const STORAGE = 'ai-todo-items'
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

const uid = () => Math.random().toString(36).slice(2, 10)

function loadTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) || []
  } catch {
    return []
  }
}

function makeTodo(fields) {
  return {
    id: uid(),
    title: fields.title?.trim() || 'Untitled task',
    priority: ['high', 'medium', 'low'].includes(fields.priority) ? fields.priority : 'medium',
    category: fields.category || '',
    due: fields.due || null,
    done: false,
    subtasks: [],
    createdAt: Date.now(),
  }
}

export default function App() {
  const [todos, setTodos] = useState(loadTodos)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('') // which AI action is running
  const [error, setError] = useState('')
  const [advice, setAdvice] = useState(null)
  const [showSettings, setShowSettings] = useState(!getApiKey())
  const [keyDraft, setKeyDraft] = useState(getApiKey())
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(todos))
    } catch {
      /* storage unavailable */
    }
  }, [todos])

  const update = (id, patch) =>
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  // --- adding ---
  const addPlain = () => {
    if (!input.trim()) return
    setTodos((ts) => [makeTodo({ title: input }), ...ts])
    setInput('')
  }

  const addWithAI = () =>
    input.trim() &&
    run('magic', async () => {
      const items = await parseTasks(input)
      setTodos((ts) => [...items.map(makeTodo), ...ts])
      setInput('')
    })

  // --- AI per task ---
  const aiBreakDown = (todo) =>
    run(`split-${todo.id}`, async () => {
      const steps = await breakDown(todo.title)
      update(todo.id, {
        subtasks: [...todo.subtasks, ...steps.map((s) => ({ id: uid(), title: s, done: false }))],
      })
    })

  const aiSuggest = () =>
    run('suggest', async () => {
      const open = todos.filter((t) => !t.done)
      if (!open.length) throw new Error('No open tasks to plan.')
      const result = await suggestNext(open)
      setAdvice(result)
    })

  // --- subtasks ---
  const toggleSub = (todo, subId) =>
    update(todo.id, {
      subtasks: todo.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)),
    })
  const removeSub = (todo, subId) =>
    update(todo.id, { subtasks: todo.subtasks.filter((s) => s.id !== subId) })

  // --- edit ---
  const startEdit = (t) => {
    setEditingId(t.id)
    setEditText(t.title)
  }
  const saveEdit = () => {
    if (editText.trim()) update(editingId, { title: editText.trim() })
    setEditingId(null)
  }

  const visible = useMemo(() => {
    const list = todos.filter((t) =>
      filter === 'active' ? !t.done : filter === 'done' ? t.done : true
    )
    return [...list].sort(
      (a, b) =>
        a.done - b.done ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.due || '9999').localeCompare(b.due || '9999') ||
        b.createdAt - a.createdAt
    )
  }, [todos, filter])

  const openCount = todos.filter((t) => !t.done).length
  const doneCount = todos.length - openCount
  const today = new Date().toISOString().slice(0, 10)
  const byId = Object.fromEntries(todos.map((t) => [t.id, t]))

  return (
    <div className="app">
      <header>
        <div>
          <h1>AI To-Do</h1>
          <p className="sub">
            {openCount} open · {doneCount} done
          </p>
        </div>
        <button className="ghost" onClick={() => setShowSettings((s) => !s)}>
          ⚙ Settings
        </button>
      </header>

      {showSettings && (
        <section className="card settings">
          <label htmlFor="key">Anthropic API key</label>
          <p className="hint">
            Needed for the ✨ AI features. It is stored only in this browser and sent only to
            api.anthropic.com. Model: <code>{MODEL}</code>
          </p>
          <div className="row">
            <input
              id="key"
              type="password"
              placeholder="sk-ant-..."
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
            <button
              onClick={() => {
                setApiKey(keyDraft.trim())
                setShowSettings(false)
              }}
            >
              Save
            </button>
          </div>
        </section>
      )}

      <section className="card composer">
        <textarea
          rows={2}
          placeholder='Add a task… or type a messy note like "call dentist friday, finish slides asap, buy eggs" and hit ✨'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.metaKey || e.ctrlKey ? addWithAI() : addPlain()
            }
          }}
        />
        <div className="row end">
          <span className="hint">Enter = add · ⌘/Ctrl+Enter = AI add</span>
          <button className="ghost" onClick={addPlain} disabled={!input.trim()}>
            Add
          </button>
          <button className="ai" onClick={addWithAI} disabled={!input.trim() || !!busy}>
            {busy === 'magic' ? 'Thinking…' : '✨ AI add'}
          </button>
        </div>
      </section>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="link" onClick={() => setError('')}>
            dismiss
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="tabs">
          {['all', 'active', 'done'].map((f) => (
            <button
              key={f}
              className={filter === f ? 'tab on' : 'tab'}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="row">
          {doneCount > 0 && (
            <button className="ghost" onClick={() => setTodos((ts) => ts.filter((t) => !t.done))}>
              Clear done
            </button>
          )}
          <button className="ai" onClick={aiSuggest} disabled={!!busy || !openCount}>
            {busy === 'suggest' ? 'Planning…' : '✨ What next?'}
          </button>
        </div>
      </div>

      {advice && (
        <section className="card advice">
          <div className="row between">
            <strong>✨ Suggested focus</strong>
            <button className="link" onClick={() => setAdvice(null)}>
              close
            </button>
          </div>
          <ol>
            {(advice.order || [])
              .filter((id) => byId[id])
              .map((id) => (
                <li key={id}>{byId[id].title}</li>
              ))}
          </ol>
          <p>{advice.advice}</p>
        </section>
      )}

      <ul className="list">
        {visible.length === 0 && (
          <li className="empty">
            {todos.length ? 'Nothing here.' : 'No tasks yet — add one above.'}
          </li>
        )}
        {visible.map((t) => {
          const overdue = t.due && !t.done && t.due < today
          return (
            <li key={t.id} className={`item ${t.done ? 'done' : ''}`}>
              <div className="main">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => update(t.id, { done: !t.done })}
                  aria-label={`Mark ${t.title} done`}
                />
                <div className="body">
                  {editingId === t.id ? (
                    <input
                      className="edit"
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <span className="title" onDoubleClick={() => startEdit(t)}>
                      {t.title}
                    </span>
                  )}
                  <div className="meta">
                    <select
                      className={`pill p-${t.priority}`}
                      value={t.priority}
                      onChange={(e) => update(t.id, { priority: e.target.value })}
                      aria-label="Priority"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    {t.category && <span className="pill">{t.category}</span>}
                    <input
                      type="date"
                      className={`pill date ${overdue ? 'overdue' : ''}`}
                      value={t.due || ''}
                      onChange={(e) => update(t.id, { due: e.target.value || null })}
                      aria-label="Due date"
                    />
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="ai small"
                    onClick={() => aiBreakDown(t)}
                    disabled={!!busy}
                    title="Break into subtasks with AI"
                  >
                    {busy === `split-${t.id}` ? '…' : '✨ Split'}
                  </button>
                  <button className="ghost small" onClick={() => startEdit(t)} title="Edit">
                    ✎
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => setTodos((ts) => ts.filter((x) => x.id !== t.id))}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {t.subtasks.length > 0 && (
                <ul className="subs">
                  {t.subtasks.map((s) => (
                    <li key={s.id} className={s.done ? 'done' : ''}>
                      <input type="checkbox" checked={s.done} onChange={() => toggleSub(t, s.id)} />
                      <span>{s.title}</span>
                      <button className="link" onClick={() => removeSub(t, s.id)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <footer>Double-click a task to rename it. Your tasks are saved in this browser.</footer>
    </div>
  )
}
