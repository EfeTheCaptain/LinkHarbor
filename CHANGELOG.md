# Changelog

All notable changes to the My Shortcuts extension.

## [1.3] - 2026-11-01

### Removed
- Type-to-filter search entirely: the search input, card index, filtering and open-first-match handlers are gone from the markup, styles and script.
- Per-card colour controls and state.
- Move-to-section select and card move up/down/top/bottom buttons.
- Mobile/touch reordering affordances.

### Added
- Section-level card sizing (+/- 15px, 70–300).
- Section colour tint.
- Drag handles with insertion indicators.
- Empty-state welcome panel with a “Start editing” action.
- URL-first shortcut creation in both the add form and the card editor.
- Automatic title suggestions from the domain (brand map first, then hostname heuristic), stopping once the title is edited manually.
- Import validation: 1 MB size cap, MIME/extension checks, FileReader error handling, schema sanitisation and URL normalisation.
- Cross-tab storage sync through `chrome.storage.onChanged`, with a `localStorage` fallback.
- Schema versioning (`version: 3`) plus legacy state migration.
- Backward-compatible import for old `columns`/`dividerCount` exports, preserving column placement.
- Toast error styling, assertive error announcements, reduced-motion support and consistent `:focus-visible` rings.

### Fixed
- Drag-and-drop state desync: reorders are applied to state first, then re-rendered, with focus restoration.
- Section and card dragging is handle-only, so titles and edit inputs stay usable.
- Save failures are reported without leaving edit mode or losing the draft.
- User-supplied text is no longer inserted as HTML; URLs are restricted to http(s) and hostnames are validated.
- Focus and scroll no longer jump after a reorder.

### Changed
- All relocation is drag-and-drop only; card/section move buttons and select removed.
- Card deletion is immediate; the confirmation dialog remains for sections and for discarding unsaved edits.
- Section titles are text inputs in edit mode and plain text in view mode.
- Manifest version/description updated; marked as Manifest V3 with `storage` and `favicon` permissions.
- i18n is centralised through `data-i18n` attributes for English and Turkish.
- Desktop-only UI: removed mobile/touch affordances.

### Files
- `manifest.json`
- `newtab.html`
- `newtab.css`
- `newtab.js`
