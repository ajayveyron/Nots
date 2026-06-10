# Jot

A minimal local-first writing page inspired by Jotttt. It has no auth, no backend, no visible controls, and no build step. The note is saved in the browser with `localStorage`.

## Features

- One clean writing surface
- Autosave while typing
- Black screen with only the note text visible
- Bold, italic, underline, lists, indentation, strikethrough, and links through native editing or keyboard shortcuts
- Static deployment on Vercel

## Shortcuts

- `Cmd/Ctrl+B`: bold
- `Cmd/Ctrl+I`: italic
- `Cmd/Ctrl+U`: underline
- `Cmd/Ctrl+Shift+X`: strikethrough
- `Cmd/Ctrl+Shift+8`: bulleted list
- `Cmd/Ctrl+Shift+7`: numbered list
- `Tab` / `Shift+Tab`: indent / outdent
- `Cmd/Ctrl+K`: add link to selected text

## Run

Open `index.html` directly, or serve the folder with any static file server.

## Deploy

Push this repository to GitHub and connect it to Vercel as a static project. No build command is required.
