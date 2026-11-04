# LinkHarbor ⚓

A minimalist Chromium extension that replaces your New Tab page with a blown-up bookmark bar.

Organize your links into grouped islands. No feeds, no widgets, no bloat. Just your links, exactly where you put them.

<img width="2542" height="1238" alt="2026-11-04_15-37" src="https://github.com/user-attachments/assets/7dac3041-4df9-4622-b174-28e739418021" />
## How it works (essentials)

- Your board is stored as structured data (sections, cards, settings) in browser storage.
- Editing uses a temporary draft; Save validates and persists, Cancel discards.
- The page rebuilds from small templates, keeping only what the current mode needs.
- Drag and drop reorders sections and cards, with visual drop indicators.
- Import/export uses JSON, including automatic conversion of older backup formats.

<img width="2541" height="1237" alt="2026-11-04_15-38" src="https://github.com/user-attachments/assets/db378b1d-a9e4-4d19-817c-81b8fea61a09" />

## Why no background images

Not recommended unless you accept storage and performance trade-offs; background images can bloat extension storage and slow rendering. If added, limit file size, compress to a small data URL, and keep it optional with a reset. This project intentionally avoids that optional complexity.

## How to use (developer mode)

1. Open `chrome://extensions/` (or `brave://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (for example, in `Documents` or `Downloads`).
5. Open a new tab to see LinkHarbor.

 
<img width="2548" height="262" alt="2026-11-04_16-43" src="https://github.com/user-attachments/assets/26cdad59-a860-4a73-ba49-e942b087b032" />

---

<img width="934" height="683" alt="2026-11-04_16-47" src="https://github.com/user-attachments/assets/e6fbae76-007a-48ac-90d6-6c839e64fd12" />


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
