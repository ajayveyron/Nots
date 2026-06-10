# Nots

Nots is a minimal local-first writing page inspired by Jotttt. It has no auth, no backend, no visible controls, and no build step. The note is saved in the browser with `localStorage`.

## Features

- One clean writing surface
- Autosave while typing
- Black screen with only the note text visible
- Markdown shortcuts that turn into rich text as you type
- Bold, italic, underline, lists, indentation, strikethrough, links, headings, and code
- VS Code-style line move and duplicate shortcuts
- Static deployment on Vercel

## Markdown

- `# `, `## `, `### `: headings
- `- ` or `* `: bulleted list
- `1. `: numbered list
- `> `: quote
- `**text**` or `__text__`: bold
- `*text*` or `_text_`: italic
- `++text++`: underline
- `~~text~~`: strikethrough
- `` `text` ``: inline code
- `[text](https://example.com)`: link

## Shortcuts

- `Cmd/Ctrl+B`: bold
- `Cmd/Ctrl+I`: italic
- `Cmd/Ctrl+U`: underline
- `Cmd/Ctrl+Shift+X`: strikethrough
- `Cmd/Ctrl+Shift+8`: bulleted list
- `Cmd/Ctrl+Shift+7`: numbered list
- `Tab` / `Shift+Tab`: indent / outdent
- `Cmd/Ctrl+K`: add link to selected text
- `Alt/Opt+Up` / `Alt/Opt+Down`: move the current line
- `Alt/Opt+Shift+Up` / `Alt/Opt+Shift+Down`: duplicate the current line
- `Alt/Opt+Click`: add an extra cursor
- `Esc`: clear extra cursors

## Run

Open `index.html` directly, or serve the folder with any static file server.

## Deploy

Push this repository to GitHub and connect it to Vercel as a static project. No build command is required.
