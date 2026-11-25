# LinkHarbor Codebase Audit

## Architecture Overview
- **Type**: Manifest V3 Chromium extension replacing New Tab page
- **Structure**: Single HTML/CSS/JS files, no build tools, no frameworks
- **Storage**: `chrome.storage.local` + localStorage fallback, cross-tab sync via `onChanged`
- **State**: In-memory state + draft pattern for editing
- **Rendering**: Template-based full re-renders

---

## Security Findings

### HIGH
1. **No Content Security Policy** - Manifest lacks `content_security_policy` key. Extension pages default to unsafe-inline scripts/styles. Risk: XSS if any user input reaches innerHTML.

2. **Favicon URL uses internal Chrome API** (`chrome.runtime.getURL('/_favicon/...')`) - Undocumented, may break or be restricted. Should use `chrome://favicon/` or a favicon service.

3. **localStorage fallback** - Writes to localStorage without user consent. Could leak data across profiles. Should be opt-in or removed.

### MEDIUM
4. **URL normalization allows any http(s) host** - No blocklist for sensitive domains (localhost, internal IPs, chrome://, etc.). Could be used for SSRF-style navigation.

5. **Import/export lacks integrity checks** - No checksum/signature on exported JSON. Tampered imports could inject malicious URLs.

6. **Toast messages use `textContent` safely** - Good, but confirm dialog uses `textContent` too. No XSS vector found in current code.

---

## Performance Findings

### HIGH
7. **Full re-render on every mutation** - `render()` rebuilds entire board DOM. For 500 cards × 50 sections, this is O(n²) with GC pressure.

8. **`deepClone` uses JSON round-trip** - `JSON.parse(JSON.stringify())` is slow for large state. Should use `structuredClone` (available) with fallback.

9. **No debounced storage writes** - Every setting change (theme, background, dividers) triggers immediate `persist()`. Rapid changes = storage spam.

### MEDIUM
10. **`computeAssignments` runs on every render** - Could be memoized.

11. **Favicon requests fire on every render** - `faviconFor()` called per card per render. Should cache or use `<link rel="prefetch">`.

---

## Maintainability Findings

### HIGH
12. **Monolithic 1249-line JS file** - All logic in one IIFE. Hard to test, review, or split work. Should be ES modules.

13. **No TypeScript / type definitions** - No type safety for state shape, function signatures, or DOM elements.

14. **No automated tests** - Zero test coverage. Changes risk regressions in drag-drop, storage, validation.

### MEDIUM
15. **Magic numbers scattered** - `CARD_SIZE_MIN`, `MAX_IMPORT_BYTES`, column limits, etc. Some duplicated in CSS.

16. **Inconsistent error handling** - Some `catch` blocks silent, others toast. No centralized error boundary.

17. **CSS custom properties duplicated** - Background palettes defined in both `:root` and `html[data-bg=...]` blocks.

---

## Accessibility Findings

### MEDIUM
18. **Drag-and-drop is mouse-only** - No keyboard alternative for reordering. Violates WCAG 2.1.1 (Keyboard).

19. **Color-only state indicators** - Section color tint, drag handle visibility. No text/icons for color-blind users.

20. **Empty state "Start editing" button** - Good, but no skip link or heading hierarchy.

---

## Manifest V3 Compliance

### LOW
21. **`favicon` permission used** - Valid, but `chrome://favicon/` URLs work without it in MV3. Could drop permission.

22. **No `content_security_policy`** - Required for MV3 extensions. Should add `script-src 'self'; object-src 'none'`.

23. **`chrome_url_overrides` for newtab** - Correct, but ensure no inline scripts in HTML (currently clean).

---

## Data Integrity

### MEDIUM
24. **Schema versioning exists but no migration logic** - `SCHEMA_VERSION = 3` but `sanitizeState` handles v1/v2 implicitly. No explicit migration tests.

25. **Import allows newer schema versions** - Rejects `version > SCHEMA_VERSION` but accepts equal. Should validate required fields per version.

26. **No backup/version history** - Single state key. Corruption = total loss. Could keep last N versions.

---

## Summary: Priority Fixes

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Add CSP to manifest | Low |
| P0 | Replace internal favicon API | Low |
| P0 | Add keyboard reorder (accessibility) | Medium |
| P1 | Debounce storage writes | Low |
| P1 | Split JS into ES modules | Medium |
| P1 | Add basic unit tests (validation, storage, render) | Medium |
| P2 | Replace JSON deepClone with structuredClone | Low |
| P2 | Add URL blocklist (localhost, internal) | Low |
| P2 | Memoize computeAssignments | Low |
| P3 | TypeScript definitions | Medium |
| P3 | Favicon caching/prefetch | Low |
| P3 | Export integrity (checksum) | Medium |

---

## Recommended Implementation Order

1. **Security baseline**: CSP, favicon fix, URL blocklist
2. **Performance**: Debounced storage, structuredClone, memoization
3. **Architecture**: ES modules, TypeScript types
4. **Quality**: Unit tests, accessibility (keyboard reorder)
5. **Polish**: Favicon caching, export checksum, version history