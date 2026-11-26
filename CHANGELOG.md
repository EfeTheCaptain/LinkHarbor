# Changelog

All notable changes to the LinkHarbor extension.

## [1.5] - 2026-11-26

### Added
- **Drag sections across column dividers**: In edit mode, drag a section (by the ≡ handle) onto a divider line between columns. Drop on the left or right half to move the section to that column. Visual feedback shows active drop target.
- **Keyboard reorder (accessibility)**: In edit mode, hold Alt + Arrow keys to reorder without mouse:
  - Alt+Up/Down — move card up/down within section
  - Alt+Shift+Left/Right — move card to previous/next section
  - Alt+Up/Down on section title — move section up/down
- **Content Security Policy**: Manifest V3 compliant CSP (`script-src 'self'; object-src 'none; style-src 'self' 'unsafe-inline'`).
- **URL security blocklist**: Blocks localhost, private IPs (10.x, 172.16-31.x, 127.x, 169.254.x, 100.64-127.x, 198.18-19.x), IPv6 loopback/link-local, and reserved hostnames (.local, .internal, .test, .example, .invalid, .localhost). 192.168.x allowed for local network services.
- **Debounced storage writes**: Settings changes (theme, background, dividers, language) batch into a single write 300ms after last change.
- **Favicon caching**: Favicon URLs computed once and reused across re-renders.
- **Column assignment memoization**: Layout calculation cached (50-entry LRU).
- **Unit tests**: 29 tests covering URL validation, blocklist, state sanitization, column assignment, and core utilities.

### Fixed
- **Favicon icons not loading**: Reverted to `chrome.runtime.getURL('/_favicon/...')` with `favicon` permission (works in Brave and Chrome).
- **192.168.x addresses blocked**: Removed from blocklist for local network convenience.
- **Debounced write loss on tab close**: Pending writes now flush on `beforeunload`, save, cancel, and import.
- **Keyboard reorder focus loss**: Focus token preserved on card up/down moves.
- **Dead favicon cache entries**: Negative results now cached to prevent repeated parsing.
- **Divider drag-drop now triggers column "hop"**: Sections can move across columns via divider drop zones.

### Changed
- Links open in same tab (`target="_self"`) instead of new tab.
- Section reorder via keyboard clears pinned columns for auto-rebalancing.
- Removed dead blocklist entries (chrome://, about:, file://, etc. — unreachable after protocol check).

### Files
- `manifest.json` — version 1.5, CSP, favicon permission
- `newtab.js` — all logic changes above
- `newtab.css` — divider drop target styling
- `tests/utils.test.js` — unit test suite
- `AUDIT.md` — codebase audit report

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
