# Changelog

All notable changes to the LinkHarbor extension.

## [1.5] - 2026-11-26

### v1.4 → v1.5 Diff

**Link behavior**
- v1.4: Clicking a shortcut opened in a new tab (`target="_blank"`)
- v1.5: Clicking a shortcut opens in the same tab (`target="_self"`) — replaces the new-tab page

**Favicon loading**
- v1.4: Used `chrome://favicon/size/32@1x/` (blocked in Chrome, worked in Brave only)
- v1.5: Reverted to `chrome.runtime.getURL('/_favicon/...')` with `favicon` permission — works in both Brave and Chrome

**Local network addresses (192.168.x)**
- v1.4: Blocked by URL security blocklist (could not add local servers)
- v1.5: Allowed — 192.168.x removed from blocklist; 10.x, 172.16-31.x, 127.x, 169.254.x, 100.64-127.x, 198.18-19.x still blocked

**Security: Content Security Policy**
- v1.4: No CSP (default unsafe-inline allowed)
- v1.5: Added MV3-compliant CSP: `script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'`

**Security: URL blocklist**
- v1.4: Basic protocol check only (http/https)
- v1.5: Comprehensive blocklist — localhost, private IPs, IPv6 loopback/link-local, reserved hostnames (.local, .internal, .test, .example, .invalid, .localhost); dead entries removed (chrome://, about:, file:// — unreachable after protocol check)

**Storage writes**
- v1.4: Every setting change (theme, background, dividers, language) wrote immediately to storage
- v1.5: Debounced 300ms — batches rapid changes; flushes on save, cancel, import, and tab close (`beforeunload`)

**Performance: Caching**
- v1.4: Favicon URL recomputed on every render; column assignment recalculated every render
- v1.5: Favicon URLs cached (Map, includes negative results); column assignments memoized (50-entry LRU keyed by section columns + count)

**Accessibility: Keyboard reorder (edit mode)**
- v1.4: Drag-and-drop only (mouse)
- v1.5: Added keyboard shortcuts (hold Alt):
  - Alt+Up/Down — move card up/down within section
  - Alt+Shift+Left/Right — move card to previous/next section
  - Alt+Up/Down on section title — move section up/down
  - Focus preserved after each move

**Drag-and-drop: Section ↔ Column divider**
- v1.4: Sections draggable only within/above/below other sections; moving across columns required drag to section in target column
- v1.5: Divider lines between columns are drop zones — drag section onto divider, drop left/right half to move to that column; visual feedback on divider

**Section reorder side-effect**
- v1.4: Keyboard section reorder kept pinned `column` values (layout didn't rebalance)
- v1.5: Keyboard section reorder clears `column=undefined` on moved sections → auto-rebalance via `computeAssignments`

**Code health**
- v1.4: No automated tests
- v1.5: 29 unit tests (`tests/utils.test.js`) covering URL normalization, blocklist, state sanitization, column assignment, core utilities
- v1.5: `AUDIT.md` — full codebase audit with prioritized findings

### Files Changed
- `manifest.json` — version 1.5, CSP, favicon permission
- `newtab.js` — all logic changes above
- `newtab.css` — divider drop target styling (`.column-divider.drop-target`)
- `tests/utils.test.js` — unit test suite (new)
- `AUDIT.md` — codebase audit report (new)

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
