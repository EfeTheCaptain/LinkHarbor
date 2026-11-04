# LinkHarbor ⚓

A minimalist Chromium extension that replaces your New Tab page with a blown-up bookmark bar.

Organize your links into grouped islands. No feeds, no widgets, no bloat. Just your links, exactly where you put them.

## How it works (essentials)

- Your board is stored as structured data (sections, cards, settings) in browser storage.
- Editing uses a temporary draft; Save validates and persists, Cancel discards.
- The page rebuilds from small templates, keeping only what the current mode needs.
- Drag and drop reorders sections and cards, with visual drop indicators.
- Import/export uses JSON, including automatic conversion of older backup formats.

## Why no background images

Not recommended unless you accept storage and performance trade-offs; background images can bloat extension storage and slow rendering. If added, limit file size, compress to a small data URL, and keep it optional with a reset. This project intentionally avoids that optional complexity.

## How to use (developer mode)

1. Open `chrome://extensions/` (or `brave://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (for example, in `Documents` or `Downloads`).
5. Open a new tab to see LinkHarbor.

## Backup disclaimer

Before installing or updating, back up your current shortcuts using the extension's Export JSON feature. If you skip this, you may lose existing shortcuts. It is also recommended to export a fresh backup before every update.

## Files

- `manifest.json` — extension metadata and permissions
- `newtab.html` — page structure and templates
- `newtab.css` — styling
- `newtab.js` — state, rendering, editing, drag-and-drop, storage
- `icons/` — extension icons
- `CHANGELOG.md` — version history
- `HOW_IT_WORKS.md` — detailed explanation
