// Small client for the Claude API, called straight from the browser.
// The user's API key is kept only in their own browser (localStorage).

const API_URL = 'https://api.anthropic.com/v1/messages'
export const MODEL = 'claude-haiku-5-5'

const KEY_STORAGE = 'ai-todo-api-key'

export function getApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* storage unavailable */
  }
}

async function askClaude(system, prompt) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings first.')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const err = await res.json()
      if (err?.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const data = await res.json()
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

function extractJson(text) {
  const start = text.search(/[[{]/)
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'))
  if (start === -1 || end === -1) throw new Error('AI returned an unexpected answer.')
  return JSON.parse(text.slice(start, end + 1))
}

const today = () => new Date().toISOString().slice(0, 10)

/** Turn free text ("buy milk tomorrow, finish report asap") into structured tasks. */
export async function parseTasks(input) {
  const text = await askClaude(
    `You turn messy notes into to-do items. Today is ${today()}.
Reply with ONLY a JSON array. Each item: {"title": string (short, starts with a verb), "priority": "high"|"medium"|"low", "category": one short word like Work, Personal, Health, Shopping, Home, Finance, "due": "YYYY-MM-DD" or null}.
Only set "due" when the text implies a date.`,
    input
  )
  const items = extractJson(text)
  return Array.isArray(items) ? items : [items]
}

/** Break one task into 3–6 concrete subtasks. */
export async function breakDown(title) {
  const text = await askClaude(
    'You break tasks into small, concrete next steps. Reply with ONLY a JSON array of 3 to 6 short strings, each starting with a verb.',
    `Task: ${title}`
  )
  return extractJson(text).map(String)
}

/** Pick what to work on next, with a short reason. */
export async function suggestNext(todos) {
  const list = todos
    .map((t) => `- id=${t.id} | ${t.title} | priority=${t.priority} | due=${t.due || 'none'}`)
    .join('\n')
  const text = await askClaude(
    `You are a calm productivity coach. Today is ${today()}. Given open tasks, choose up to 3 to do next, in order.
Reply with ONLY JSON: {"order": [ids...], "advice": "one or two friendly sentences explaining why"}.`,
    list
  )
  return extractJson(text)
}
