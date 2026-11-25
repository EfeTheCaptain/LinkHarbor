# How This Extension Works

## What it does

This extension replaces your browser's New Tab page with a personal shortcut board.

- You organize shortcuts into **sections** (groups).
- Each section contains **cards** (links).
- You can change layout (number of columns), theme color, background, and language.
- Everything is saved locally in your browser profile.

## Under the hood (simple view)

1. **State**
   - The board is stored as structured data: sections, cards, settings.
   - On load, the data is cleaned and validated before use.

2. **Editing**
   - Clicking **Edit** creates a temporary draft copy.
   - You change the draft (add/remove/move items, rename, resize, color).
   - **Save** validates and writes the draft to storage.
   - **Cancel** throws the draft away.

3. **Rendering**
   - The page is rebuilt from small HTML templates.
   - Only the parts needed for the current mode (view or edit) are kept.

4. **Drag and drop**
   - Desktop drag-and-drop reorders sections and cards.
   - Visual lines show where an item will land.
   - State updates first, then the view refreshes.

5. **Import / export**
   - Export writes a JSON file of your board.
   - Import reads JSON, validates it, and converts older formats automatically.

## Is it lightweight?

Yes.

- No frameworks or build tools are required at runtime.
- It uses plain browser APIs and small templates.
- It avoids extra UI layers and keeps the DOM minimal.

## Is it robust?

It includes several safety checks:

- Input validation for URLs and colors.
- Size limits and clamping for card sizes.
- Storage read/write error handling.
- Confirmation dialogs for destructive actions.
- Backward-compatible import for older backup formats.
- Desktop-only interactions to avoid fragile touch handling.

## What we deliberately did NOT add

To keep it stable, we avoided optional features that can cause long-term issues:

- No mobile/touch reorder controls.
- No per-card color system.
- No search/filter bar.
- No heavy UI framework.
- No "move to section" dropdown shortcut.

These were removed or not added because they add complexity, state, and edge cases without being essential.

## Why essential features were still added

Some features are necessary for real use and reliability:

- **Section-level card sizing** (plus/minus) so layouts stay readable.
- **Section color** with reset, applied through CSS variables.
- **Legacy backup import** so old exports still work.
- **Visual drop indicators** so drag-and-drop is predictable.
- **Template-based rendering** to keep code maintainable and reduce duplication.

## Files that matter

- `newtab.html` — templates and page structure.
- `newtab.js` — state, rendering, editing, drag-and-drop, storage.
- `newtab.css` — styling and responsive behavior.
- `CHANGELOG.md` — version history.
