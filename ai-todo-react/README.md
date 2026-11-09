# AI To-Do (React)

A clean to-do list built with React + Vite, with AI features powered by Claude.

## Features

- Add, edit (double-click), complete, delete tasks
- Priority, category and due date per task (overdue dates turn red)
- Filters: All / Active / Done, and "Clear done"
- Tasks saved in your browser (localStorage)
- Light and dark mode

### ✨ AI features

- **AI add** – type a messy note like *"call dentist friday, finish slides asap, buy eggs"* and it becomes separate tasks with priority, category and due date.
- **Split** – breaks any task into 3–6 concrete subtasks.
- **What next?** – looks at your open tasks and suggests what to focus on, with a short reason.

The AI features need an [Anthropic API key](https://console.anthropic.com/). Paste it in **Settings** in the app; it is stored only in your browser and sent only to `api.anthropic.com`. Don't share a deployed copy with your key saved in someone else's browser.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Build

```bash
npm run build
```

The static site is written to `dist/` and can be hosted on GitHub Pages, Vercel, Netlify, etc.
