// === NEWTAB.JS ===
// Shortcut board: draft/commit editing, drag-and-drop reordering, import/export,
// section colors, per-section card sizing, suggestions, i18n and empty state.
// Desktop-only; the type-to-filter search feature has been removed.

(function () {
  'use strict';

  const SCHEMA_VERSION = 3;
  const STORAGE_KEY = 'my-shortcuts/state-v3';
  const LEGACY_KEY = 'my-shortcuts-state';
  const MAX_IMPORT_BYTES = 1024 * 1024;
  const CARD_SIZE_MIN = 70;
  const CARD_SIZE_MAX = 300;
  const CARD_SIZE_STEP = 15;
  const CARD_SIZE_DEFAULT = 110;

  const BRAND_MAP = {
    'google.com': 'Google', 'mail.google.com': 'Gmail',
    'drive.google.com': 'Google Drive', 'docs.google.com': 'Google Docs',
    'maps.google.com': 'Google Maps', 'calendar.google.com': 'Google Calendar',
    'meet.google.com': 'Google Meet', 'photos.google.com': 'Google Photos',
    'youtube.com': 'YouTube', 'github.com': 'GitHub',
    'stackoverflow.com': 'Stack Overflow', 'reddit.com': 'Reddit',
    'x.com': 'X', 'twitter.com': 'X / Twitter', 'facebook.com': 'Facebook',
    'instagram.com': 'Instagram', 'linkedin.com': 'LinkedIn',
    'pinterest.com': 'Pinterest', 'amazon.com': 'Amazon', 'ebay.com': 'eBay',
    'wikipedia.org': 'Wikipedia', 'news.ycombinator.com': 'Hacker News',
    'dev.to': 'Dev.to', 'codepen.io': 'CodePen', 'dribbble.com': 'Dribbble',
    'behance.net': 'Behance', 'spotify.com': 'Spotify', 'netflix.com': 'Netflix',
    'imdb.com': 'IMDb', 'chat.openai.com': 'ChatGPT', 'chatgpt.com': 'ChatGPT',
    'discord.com': 'Discord', 'slack.com': 'Slack', 'trello.com': 'Trello',
    'asana.com': 'Asana', 'notion.so': 'Notion', 'figma.com': 'Figma',
    'canva.com': 'Canva', 'dropbox.com': 'Dropbox', 'icloud.com': 'iCloud',
    'outlook.com': 'Outlook'
  };

  // --- Runtime state ---
  let state = defaultState();
  let draft = null;
  let editing = false;
  let saving = false;
  let addTarget = null;
  let dragging = null;
  let focusToken = null;
  let toastTimer = 0;
  const autoTitle = new WeakMap();

  const els = {};

  // --- Small helpers ---
  function id() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function cloneTemplate(templateId) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return null;
    const node = tpl.content.firstElementChild;
    if (typeof node.cloneNode === 'function') return node.cloneNode(true);
    // Fallback for environments without cloneNode (e.g. test stubs)
    return node;
  }

  function deepClone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (e) { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function cleanText(value, maxLength) {
    const text = String(value == null ? '' : value)
      .replace(/[\u0000-\u001F\u007F<>]/g, '')
      .trim();
    return typeof maxLength === 'number' ? text.slice(0, maxLength) : text;
  }

  function validColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
  }

  function validBg(value) {
    return ['dark', 'midnight', 'forest', 'wine', 'light', 'sepia'].indexOf(value) >= 0 ? value : 'dark';
  }

  function normalizeUrl(raw) {
    let value = String(raw == null ? '' : raw).trim();
    if (!value) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
      value = 'https://' + value;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (!url.hostname) return '';
      if (!/^[a-z0-9.-]+$/i.test(url.hostname) || !/[a-z0-9]/i.test(url.hostname)) return '';
      return url.href;
    } catch (e) {
      return '';
    }
  }

  function hostOf(raw) {
    try { return new URL(raw).hostname.replace(/^www\./i, ''); } catch (e) { return ''; }
  }

  function titleFromUrl(raw) {
    const normalized = normalizeUrl(raw);
    if (!normalized) return '';
    const host = hostOf(normalized);
    if (BRAND_MAP[host]) return BRAND_MAP[host];
    const parts = host.split('.').filter(Boolean);
    const base = parts[0];
    if (!base) return '';
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  function initialOf(card) {
    const source = cleanText(card.title) || hostOf(card.url) || '?';
    const match = source.match(/[a-z0-9]/i);
    return (match ? match[0] : '?').toUpperCase();
  }

  function t(key) {
    const lang = editing && draft ? draft.lang : state.lang;
    const dict = I18N[lang] || I18N.en;
    return dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  }

  function tFor(lang, key) {
    const dict = I18N[lang] || I18N.en;
    return dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  }

  function data() {
    return editing && draft ? draft : state;
  }

  function defaultState() {
    return { version: SCHEMA_VERSION, lang: 'en', themeColor: '#ff6b6b', bg: 'dark', dividers: 1, sections: [] };
  }

  const I18N = {
    en: {
      appTitle: 'LinkHarbor',
      emptyTitle: 'No shortcuts yet',
      emptyIntro: 'Use the Edit button in the bottom-right corner to add sections and shortcuts. “Add Section” creates a group, and the + tile adds a shortcut to it.',
      emptyEditCta: 'Start editing',
      addSection: '＋ Add Section', exportJson: 'Export JSON', importJson: 'Import JSON',
      language: 'Language', dividers: 'Divider lines', theme: 'Theme', background: 'Background',
      cancel: 'Cancel', confirmDelete: 'Delete', discard: 'Discard', edit: 'Edit', save: 'Save',
      defaultSection: 'Section', sectionPlaceholder: 'Section name', sectionTitle: 'Section name',
      shrinkCards: 'Shrink cards', enlargeCards: 'Enlarge cards',
      sectionColor: 'Section color', resetSectionColor: 'Reset section color',
      urlPlaceholder: 'Paste a URL', titlePlaceholder: 'Title (auto)',
      urlLabel: 'Shortcut URL', titleLabel: 'Shortcut title',
      add: 'Add', addShortcut: 'Add shortcut',
      dragSection: 'Drag to reorder section', dragCard: 'Drag to reorder shortcut',
      deleteSection: 'Delete section', deleteCard: 'Delete shortcut',
      confirmDeleteSection: 'Delete this section and all its shortcuts?',
      confirmDeleteCard: 'Delete this shortcut?', confirmDiscard: 'Discard unsaved changes?',
      saved: 'Saved', saveError: 'Could not save — please try again', discarded: 'Changes discarded',
      exported: 'Exported', imported: 'Imported — review and press Save',
      importError: 'Import failed: invalid file', importTooBig: 'File is too large (max 1 MB)',
      importBadType: 'Only .json files can be imported', importReadError: 'Could not read the file',
      invalidUrl: 'Enter a valid http(s) URL',
      bgDark: 'Dark', bgMidnight: 'Midnight', bgForest: 'Forest',
      bgWine: 'Wine', bgLight: 'Light', bgSepia: 'Sepia'
    },
    tr: {
      appTitle: 'LinkHarbor',
      emptyTitle: 'Henüz kısayol yok',
      emptyIntro: 'Sağ alttaki Düzenle düğmesiyle bölüm ve kısayol ekleyin. “Bölüm Ekle” bir grup oluşturur; + kutucuğu ise kısayol ekler.',
      emptyEditCta: 'Düzenlemeye başla',
      addSection: '＋ Bölüm Ekle', exportJson: 'JSON Dışa Aktar', importJson: 'JSON İçe Aktar',
      language: 'Dil', dividers: 'Bölme çizgileri', theme: 'Tema', background: 'Arka plan',
      cancel: 'İptal', confirmDelete: 'Sil', discard: 'Vazgeç', edit: 'Düzenle', save: 'Kaydet',
      defaultSection: 'Bölüm', sectionPlaceholder: 'Bölüm adı', sectionTitle: 'Bölüm adı',
      shrinkCards: 'Kartları küçült', enlargeCards: 'Kartları büyüt',
      sectionColor: 'Bölüm rengi', resetSectionColor: 'Bölüm rengini sıfırla',
      urlPlaceholder: 'Bir URL yapıştırın', titlePlaceholder: 'Başlık (otomatik)',
      urlLabel: 'Kısayol adresi', titleLabel: 'Kısayol başlığı',
      add: 'Ekle', addShortcut: 'Kısayol ekle',
      dragSection: 'Bölümü sıralamak için sürükleyin', dragCard: 'Kısayolu sıralamak için sürükleyin',
      deleteSection: 'Bölümü sil', deleteCard: 'Kısayolu sil',
      confirmDeleteSection: 'Bu bölüm ve tüm kısayolları silinsin mi?',
      confirmDeleteCard: 'Bu kısayol silinsin mi?', confirmDiscard: 'Kaydedilmemiş değişikliklerden vazgeçilsin mi?',
      saved: 'Kaydedildi', saveError: 'Kaydedilemedi — lütfen tekrar deneyin', discarded: 'Değişiklikler geri alındı',
      exported: 'Dışa aktarıldı', imported: 'İçe aktarıldı — gözden geçirip Kaydet’e basın',
      importError: 'İçe aktarma başarısız: geçersiz dosya', importTooBig: 'Dosya çok büyük (en fazla 1 MB)',
      importBadType: 'Yalnızca .json dosyaları içe aktarılabilir', importReadError: 'Dosya okunamadı',
      invalidUrl: 'Geçerli bir http(s) adresi girin',
      bgDark: 'Koyu', bgMidnight: 'Gece', bgForest: 'Orman',
      bgWine: 'Şarap', bgLight: 'Açık', bgSepia: 'Sepya'
    }
  };

  // --- Validation / sanitisation ---
  function sanitizeState(raw) {
    if (!raw) return null;
    let source = Array.isArray(raw) ? { sections: raw } : raw;
    if (typeof source !== 'object') return null;
    if (!Array.isArray(source.sections) && Array.isArray(source.columns)) {
      const flattened = [];
      source.columns.forEach(function (column, columnIndex) {
        function pushSection(section) {
          if (!section || typeof section !== 'object') return;
          const copy = Object.assign({}, section);
          if (copy.column == null) copy.column = columnIndex;
          flattened.push(copy);
        }
        if (Array.isArray(column)) column.forEach(pushSection);
        else pushSection(column);
      });
      source = Object.assign({}, source, {
        sections: flattened,
        dividers: source.dividerCount != null ? source.dividerCount : source.dividers
      });
    }
    const rawSections = Array.isArray(source.sections) ? source.sections : [];
    const sections = [];
    for (const rawSection of rawSections.slice(0, 50)) {
      if (!rawSection || typeof rawSection !== 'object') continue;
      const rawCards = Array.isArray(rawSection.cards) ? rawSection.cards : [];
      const cards = [];
      for (const rawCard of rawCards.slice(0, 500)) {
        if (!rawCard || typeof rawCard !== 'object') continue;
        const url = normalizeUrl(rawCard.url);
        if (!url) continue;
        cards.push({
          id: typeof rawCard.id === 'string' && rawCard.id ? rawCard.id : id(),
          url,
          title: cleanText(rawCard.title != null ? rawCard.title : rawCard.name, 120)
        });
      }
      const section = {
        id: typeof rawSection.id === 'string' && rawSection.id ? rawSection.id : id(),
        title: cleanText(rawSection.title != null ? rawSection.title : rawSection.name, 80),
        cardSize: clampInt(rawSection.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT),
        color: validColor(rawSection.color),
        cards
      };
      if (Number.isInteger(rawSection.column) && rawSection.column >= 0) {
        section.column = rawSection.column;
      }
      sections.push(section);
    }
    return {
      version: SCHEMA_VERSION,
      lang: source.lang === 'tr' ? 'tr' : 'en',
      themeColor: validColor(source.themeColor) || '#ff6b6b',
      bg: validBg(source.bg),
      dividers: clampInt(source.dividers, 1, 4, 1),
      sections
    };
  }

  // --- Storage ---
  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function storageGet(key) {
    return new Promise(function (resolve) {
      if (hasChromeStorage()) {
        try {
          chrome.storage.local.get(key, function (result) {
            resolve(result ? result[key] : undefined);
          });
        } catch (e) { resolve(undefined); }
        return;
      }
      try { resolve(JSON.parse(localStorage.getItem(key) || 'null')); }
      catch (e) { resolve(undefined); }
    });
  }

  function storageSet(key, value) {
    return new Promise(function (resolve, reject) {
      if (hasChromeStorage()) {
        try {
          chrome.storage.local.set({ [key]: value }, function () {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        } catch (e) { reject(e); }
        return;
      }
      try { localStorage.setItem(key, JSON.stringify(value)); resolve(); }
      catch (e) { reject(e); }
    });
  }

  async function persist(candidate) {
    try {
      await storageSet(STORAGE_KEY, candidate);
      return true;
    } catch (e) {

      return false;
    }
  }

  async function loadState() {
    let raw;
    try { raw = await storageGet(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (!raw) {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) raw = JSON.parse(local);
      } catch (e) { /* ignore */ }
    }
    if (!raw) {
      try { raw = await storageGet(LEGACY_KEY); } catch (e) { /* ignore */ }
    }
    if (!raw) {
      try {
        const local = localStorage.getItem(LEGACY_KEY);
        if (local) raw = JSON.parse(local);
      } catch (e) { /* ignore */ }
    }
    const clean = sanitizeState(raw);
    return clean || defaultState();
  }

  // --- UI primitives ---
  function toast(message, type) {
    if (toastTimer) clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = type === 'error' ? 'show error' : 'show';
    els.toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      els.toast.className = '';
    }, 3200);
  }

  function applyStaticI18n(lang) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const value = tFor(lang, el.dataset.i18n);
      if (value != null) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      const value = tFor(lang, el.dataset.i18nAriaLabel);
      if (value != null) el.setAttribute('aria-label', value);
    });
  }

  function applySettings(source) {
    const settings = source || data();
    document.documentElement.setAttribute('data-bg', settings.bg);
    document.documentElement.style.setProperty('--accent', settings.themeColor);
    document.documentElement.lang = settings.lang;
    document.title = tFor(settings.lang, 'appTitle');
    if (els.langSelect) els.langSelect.value = settings.lang;
    if (els.bgSelect) els.bgSelect.value = settings.bg;
    if (els.dividerSelect) els.dividerSelect.value = String(settings.dividers);
    if (els.themeColorInput) els.themeColorInput.value = settings.themeColor;
    applyStaticI18n(settings.lang);
  }

  let confirmOnKey = null;
  let confirmPreviousFocus = null;

  function confirmDialog(message, confirmLabel) {
    return new Promise(function (resolve) {
      confirmPreviousFocus = document.activeElement;
      els.confirmMessage.textContent = message;
      els.confirmOk.textContent = confirmLabel || t('confirmDelete');
      els.confirmCancel.textContent = t('cancel');
      els.confirmOverlay.hidden = false;

      function close(result) {
        els.confirmOverlay.hidden = true;
        els.confirmOk.onclick = null;
        els.confirmCancel.onclick = null;
        if (confirmOnKey) document.removeEventListener('keydown', confirmOnKey, true);
        confirmOnKey = null;
        const prev = confirmPreviousFocus;
        confirmPreviousFocus = null;
        if (prev && typeof prev.focus === 'function') {
          try { prev.focus(); } catch (e) { /* ignore */ }
        }
        resolve(result);
      }

      confirmOnKey = function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(false);
        } else if (event.key === 'Tab') {
          const focusables = [els.confirmCancel, els.confirmOk];
          const index = focusables.indexOf(document.activeElement);
          event.preventDefault();
          const next = event.shiftKey
            ? (index <= 0 ? focusables[focusables.length - 1] : focusables[index - 1])
            : (index === focusables.length - 1 || index < 0 ? focusables[0] : focusables[index + 1]);
          next.focus();
        }
      };

      els.confirmOk.onclick = function () { close(true); };
      els.confirmCancel.onclick = function () { close(false); };
      document.addEventListener('keydown', confirmOnKey, true);
      els.confirmCancel.focus();
    });
  }

  // --- Icons ---
  function faviconFor(url) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=32');
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  function buildIcon(card) {
    const icon = document.createElement('div');
    icon.className = 'card-icon';
    const src = faviconFor(card.url);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.width = 32;
      img.height = 32;
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () {
        img.remove();
        icon.classList.add('card-fallback-avatar');
        icon.textContent = initialOf(card);
      });
      icon.appendChild(img);
    } else {
      icon.classList.add('card-fallback-avatar');
      icon.textContent = initialOf(card);
    }
    return icon;
  }

  // --- Render ---
  function computeAssignments(sections, columnsCount) {
    const assignments = new Array(sections.length);
    const counts = new Array(columnsCount).fill(0);
    sections.forEach(function (section, index) {
      if (Number.isInteger(section.column) && section.column >= 0 && section.column < columnsCount) {
        assignments[index] = section.column;
        counts[section.column] += 1;
      }
    });
    sections.forEach(function (section, index) {
      if (assignments[index] !== undefined) return;
      let best = 0;
      for (let c = 1; c < columnsCount; c += 1) {
        if (counts[c] < counts[best]) best = c;
      }
      assignments[index] = best;
      counts[best] += 1;
    });
    return assignments;
  }

  function render() {
    const model = data();
    applySettings(model);
    document.body.classList.toggle('edit-mode', editing);
    els.globalEditToggle.textContent = editing ? t('save') : t('edit');
    els.globalEditToggle.setAttribute('aria-label', editing ? t('save') : t('edit'));

    els.board.innerHTML = '';
    const totalCards = model.sections.reduce(function (sum, section) {
      return sum + section.cards.length;
    }, 0);
    const isEmpty = model.sections.length === 0 || (totalCards === 0 && !editing);
    els.emptyState.hidden = !isEmpty;
    els.board.hidden = isEmpty;
    document.body.classList.toggle('is-empty', isEmpty);

    if (!isEmpty) {
      const columnsCount = clampInt(model.dividers + 1, 2, 5, 2);
      const columnEls = [];
      for (let i = 0; i < columnsCount; i += 1) {
        const column = document.createElement('div');
        column.className = 'column';
        columnEls.push(column);
        els.board.appendChild(column);
        if (i < columnsCount - 1) {
          const divider = document.createElement('div');
          divider.className = 'column-divider';
          els.board.appendChild(divider);
        }
      }
      const assignments = computeAssignments(model.sections, columnsCount);
      model.sections.forEach(function (section, sectionIndex) {
        columnEls[assignments[sectionIndex]].appendChild(renderSection(section, sectionIndex, model, assignments[sectionIndex]));
      });
    }

    restoreFocus();
  }

  function renderSection(section, sectionIndex, model, columnIndex) {
    const sectionEl = cloneTemplate('tpl-section');
    sectionEl.dataset.sectionId = section.id;
    sectionEl.style.setProperty('--card-size', clampInt(section.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT) + 'px');
    if (section.color) {
      sectionEl.classList.add('has-color');
      sectionEl.style.setProperty('--section-color', section.color);
    }

    const header = sectionEl.querySelector('.section-header');
    const titleEl = sectionEl.querySelector('.section-title');
    if (editing) {
      titleEl.type = 'text';
      titleEl.value = section.title;
      titleEl.placeholder = t('sectionPlaceholder');
      titleEl.setAttribute('aria-label', t('sectionTitle'));
      titleEl.addEventListener('input', function () {
        section.title = titleEl.value;
        titleEl.classList.toggle('no-title', !titleEl.value.trim());
      });
      titleEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); titleEl.blur(); }
      });
    } else {
      titleEl.value = section.title;
      titleEl.readOnly = true;
    }

    if (editing) {
      const actions = sectionEl.querySelector('.section-actions');
      const sizeGroup = actions.querySelector('.section-size');
      const shrinkBtn = sizeGroup.firstElementChild;
      const enlargeBtn = sizeGroup.lastElementChild;
      shrinkBtn.title = t('shrinkCards');
      shrinkBtn.setAttribute('aria-label', t('shrinkCards'));
      shrinkBtn.disabled = clampInt(section.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT) <= CARD_SIZE_MIN;
      enlargeBtn.title = t('enlargeCards');
      enlargeBtn.setAttribute('aria-label', t('enlargeCards'));
      enlargeBtn.disabled = clampInt(section.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT) >= CARD_SIZE_MAX;

      function changeCardSize(delta) {
        const current = clampInt(section.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT);
        const next = clampInt(current + delta, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT);
        if (next === current) return;
        section.cardSize = next;
        sectionEl.style.setProperty('--card-size', next + 'px');
        shrinkBtn.disabled = next <= CARD_SIZE_MIN;
        enlargeBtn.disabled = next >= CARD_SIZE_MAX;
      }
      shrinkBtn.addEventListener('click', function () { changeCardSize(-CARD_SIZE_STEP); });
      enlargeBtn.addEventListener('click', function () { changeCardSize(CARD_SIZE_STEP); });

      const colorInput = actions.querySelector('.section-color-input');
      const resetColor = actions.querySelector('.color-reset');
      colorInput.value = section.color || '#888888';
      colorInput.title = t('sectionColor');
      colorInput.setAttribute('aria-label', t('sectionColor'));
      resetColor.title = t('resetSectionColor');
      resetColor.setAttribute('aria-label', t('resetSectionColor'));
      resetColor.disabled = !section.color;
      colorInput.addEventListener('input', function () {
        section.color = validColor(colorInput.value) || null;
        applySectionColor(sectionEl, section);
        resetColor.disabled = !section.color;
      });
      resetColor.addEventListener('click', function () {
        section.color = null;
        colorInput.value = '#888888';
        resetColor.disabled = true;
        applySectionColor(sectionEl, section);
      });

      const deleteBtn = actions.querySelector('.section-delete');
      deleteBtn.title = t('deleteSection');
      deleteBtn.setAttribute('aria-label', t('deleteSection'));
      deleteBtn.addEventListener('click', function () {
        confirmDialog(t('confirmDeleteSection'), t('confirmDelete')).then(function (ok) {
          if (!ok) return;
          const index = model.sections.findIndex(function (item) { return item.id === section.id; });
          if (index >= 0) model.sections.splice(index, 1);
          addTarget = null;
          render();
        });
      });

      const handle = sectionEl.querySelector('.section-drag-handle');
      handle.title = t('dragSection');
      handle.setAttribute('aria-hidden', 'true');
      handle.draggable = true;
      handle.addEventListener('dragstart', function (event) {
        startSectionDrag(event, section.id, sectionEl);
      });
    } else {
      const handle = sectionEl.querySelector('.section-drag-handle');
      if (handle) handle.remove();
      const actions = sectionEl.querySelector('.section-actions');
      if (actions) actions.remove();
    }

    const grid = sectionEl.querySelector('.grid');
    setupGridDropZone(grid, section);
    section.cards.forEach(function (card, cardIndex) {
      grid.appendChild(renderCard(card, cardIndex, section, model));
    });
    if (editing) {
      grid.appendChild(addTarget === section.id ? renderAddForm(section) : renderAddTile(section));
    }

    if (editing) setupSectionDropZone(sectionEl, section, columnIndex);
    return sectionEl;
  }

  function renderCard(card, cardIndex, section, model) {
    const cardEl = cloneTemplate('tpl-card');
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.sectionId = section.id;

    if (editing) {
      const handle = cardEl.querySelector('.card-drag-handle');
      handle.title = t('dragCard');
      handle.setAttribute('aria-hidden', 'true');
      handle.draggable = true;
      handle.addEventListener('dragstart', function (event) {
        startCardDrag(event, section.id, card.id, cardEl);
      });
    }

    const view = cardEl.querySelector('.view-mode');
    if (editing) {
      if (view) view.remove();
    } else {
      const existingIcon = view.querySelector('.card-icon');
      if (existingIcon) existingIcon.remove();
      view.appendChild(buildIcon(card));
      const name = view.querySelector('.name');
      name.textContent = card.title || hostOf(card.url);
      name.title = card.title || '';
    }

    if (editing) {
      if (!autoTitle.has(card)) autoTitle.set(card, !card.title);

      const editInputs = cardEl.querySelector('.edit-inputs');
      const urlInput = editInputs.querySelector('input[type="url"]');
      const titleInput = editInputs.querySelector('input[type="text"]');
      urlInput.value = card.url || '';
      urlInput.placeholder = t('urlPlaceholder');
      urlInput.setAttribute('aria-label', t('urlLabel'));
      titleInput.value = card.title || '';
      titleInput.placeholder = t('titlePlaceholder');
      titleInput.setAttribute('aria-label', t('titleLabel'));

      urlInput.addEventListener('input', function () {
        card.url = urlInput.value;
        urlInput.classList.toggle('invalid', !!urlInput.value.trim() && !normalizeUrl(urlInput.value));
        if (autoTitle.get(card)) {
          const suggestion = titleFromUrl(urlInput.value);
          if (suggestion !== card.title) {
            card.title = suggestion;
            titleInput.value = suggestion;
          }
        }
      });
      urlInput.addEventListener('blur', function () {
        const normalized = normalizeUrl(urlInput.value);
        if (normalized) {
          card.url = normalized;
          urlInput.value = normalized;
          urlInput.classList.remove('invalid');
          if (autoTitle.get(card) && !card.title) {
            card.title = titleFromUrl(normalized);
            titleInput.value = card.title;
          }
        }
      });
      urlInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); urlInput.blur(); }
      });
      titleInput.addEventListener('input', function () {
        card.title = titleInput.value;
        autoTitle.set(card, false);
      });

      const deleteBtn = cardEl.querySelector('.card-delete');
      deleteBtn.title = t('deleteCard');
      deleteBtn.setAttribute('aria-label', t('deleteCard'));
      deleteBtn.addEventListener('click', function () {
        const index = section.cards.findIndex(function (item) { return item.id === card.id; });
        if (index >= 0) section.cards.splice(index, 1);
        addTarget = null;
        render();
      });

      setupCardDropZone(cardEl, section);
    } else {
      const handle = cardEl.querySelector('.card-drag-handle');
      if (handle) handle.remove();
      const editInputs = cardEl.querySelector('.edit-inputs');
      if (editInputs) editInputs.remove();
      const deleteBtn = cardEl.querySelector('.card-delete');
      if (deleteBtn) deleteBtn.remove();
      cardEl.href = card.url;
      cardEl.target = '_blank';
      cardEl.rel = 'noopener noreferrer';
    }

    if (!editing) {
      const anchor = document.createElement('a');
      anchor.className = cardEl.className;
      Object.keys(cardEl.dataset || {}).forEach(function (key) {
        anchor.dataset[key] = cardEl.dataset[key];
      });
      anchor.href = card.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      while (cardEl.firstChild) anchor.appendChild(cardEl.firstChild);
      return anchor;
    }

    return cardEl;
  }

  function renderAddTile(section) {
    const button = cloneTemplate('tpl-add-tile');
    button.title = t('addShortcut');
    button.setAttribute('aria-label', t('addShortcut'));
    button.addEventListener('click', function () {
      addTarget = section.id;
      focusToken = { addUrl: true };
      render();
    });
    return button;
  }

  function renderAddForm(section) {
    const form = cloneTemplate('tpl-add-form');

    const urlInput = form.querySelector('input[type="url"]');
    urlInput.placeholder = t('urlPlaceholder');
    urlInput.setAttribute('aria-label', t('urlLabel'));

    const titleInput = form.querySelector('input[type="text"]');
    titleInput.placeholder = t('titlePlaceholder');
    titleInput.setAttribute('aria-label', t('titleLabel'));

    let titleEdited = false;
    urlInput.addEventListener('input', function () {
      urlInput.classList.toggle('invalid', !!urlInput.value.trim() && !normalizeUrl(urlInput.value));
      if (!titleEdited) titleInput.value = titleFromUrl(urlInput.value);
    });
    titleInput.addEventListener('input', function () { titleEdited = true; });

    const confirmBtn = form.querySelector('.add-card-confirm');
    confirmBtn.textContent = t('add');
    const cancelBtn = form.querySelector('.add-card-cancel');
    cancelBtn.textContent = t('cancel');

    function submit() {
      const normalized = normalizeUrl(urlInput.value);
      if (!normalized) {
        urlInput.classList.add('invalid');
        urlInput.focus();
        toast(t('invalidUrl'), 'error');
        return;
      }
      const title = cleanText(titleInput.value, 120) || titleFromUrl(normalized);
      const newCard = { id: id(), url: normalized, title };
      autoTitle.set(newCard, !titleEdited);
      section.cards.push(newCard);
      addTarget = null;
      focusToken = { cardId: newCard.id };
      render();
    }

    function cancel() {
      addTarget = null;
      render();
    }

    confirmBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', cancel);
    [urlInput, titleInput].forEach(function (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); submit(); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      });
    });

    return form;
  }

  // --- Drag & drop (pure state reordering, then re-render) ---
  function clearDrag() {
    dragging = null;
    if (els.board) {
      els.board.querySelectorAll('.dragging, .drop-target, .drop-before, .drop-after').forEach(function (el) {
        el.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
      });
    }
  }

  function setDropIndicator(el, before) {
    el.classList.toggle('drop-before', before);
    el.classList.toggle('drop-after', !before);
  }

  function clearDropIndicator(el) {
    el.classList.remove('drop-before', 'drop-after');
  }

  function cardDropBefore(event, rect) {
    const relativeY = event.clientY - rect.top;
    if (relativeY < rect.height * 0.35) return true;
    if (relativeY > rect.height * 0.65) return false;
    return event.clientX < rect.left + rect.width / 2;
  }

  function startCardDrag(event, sectionId, cardId, el) {
    if (!editing) return;
    dragging = { kind: 'card', sectionId, cardId };
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', cardId);
    } catch (e) { /* ignore */ }
    el.classList.add('dragging');
    event.stopPropagation();
  }

  function startSectionDrag(event, sectionId, el) {
    if (!editing) return;
    dragging = { kind: 'section', sectionId };
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', sectionId);
    } catch (e) { /* ignore */ }
    el.classList.add('dragging');
    event.stopPropagation();
  }

  function setupCardDropZone(cardEl, section) {
    cardEl.addEventListener('dragover', function (event) {
      if (!dragging || dragging.kind !== 'card') return;
      if (cardEl.dataset.cardId === dragging.cardId) { clearDropIndicator(cardEl); return; }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const before = cardDropBefore(event, cardEl.getBoundingClientRect());
      setDropIndicator(cardEl, before);
    });
    cardEl.addEventListener('dragleave', function () {
      clearDropIndicator(cardEl);
    });
    cardEl.addEventListener('drop', function (event) {
      if (!dragging || dragging.kind !== 'card') return;
      event.preventDefault();
      event.stopPropagation();
      const targetCardId = cardEl.dataset.cardId;
      if (targetCardId !== dragging.cardId) {
        const before = cardDropBefore(event, cardEl.getBoundingClientRect());
        moveCard(dragging.sectionId, dragging.cardId, section.id, targetCardId, before);
      }
      clearDrag();
    });
  }

  function setupGridDropZone(grid, section) {
    grid.addEventListener('dragover', function (event) {
      if (!dragging || dragging.kind !== 'card') return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      grid.classList.add('drop-target');
    });
    grid.addEventListener('dragleave', function (event) {
      if (event.relatedTarget && !grid.contains(event.relatedTarget)) {
        grid.classList.remove('drop-target');
      }
    });
    grid.addEventListener('drop', function (event) {
      if (!dragging || dragging.kind !== 'card') return;
      event.preventDefault();
      moveCard(dragging.sectionId, dragging.cardId, section.id, null, false);
      clearDrag();
    });
  }

  function setupSectionDropZone(sectionEl, section, columnIndex) {
    sectionEl.addEventListener('dragover', function (event) {
      if (!dragging) return;
      if (dragging.kind === 'section' && dragging.sectionId === section.id) {
        clearDropIndicator(sectionEl);
        return;
      }
      event.preventDefault();
      if (dragging.kind === 'section') {
        const rect = sectionEl.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        setDropIndicator(sectionEl, before);
      } else if (dragging.kind === 'card') {
        sectionEl.classList.add('drop-target');
      }
    });
    sectionEl.addEventListener('dragleave', function (event) {
      if (event.relatedTarget && !sectionEl.contains(event.relatedTarget)) {
        sectionEl.classList.remove('drop-target');
        clearDropIndicator(sectionEl);
      }
    });
    sectionEl.addEventListener('drop', function (event) {
      if (!dragging) return;
      event.preventDefault();
      if (dragging.kind === 'section') {
        const rect = sectionEl.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        moveSectionToId(dragging.sectionId, section.id, before, columnIndex);
      } else if (dragging.kind === 'card') {
        moveCard(dragging.sectionId, dragging.cardId, section.id, null, false);
      }
      clearDrag();
    });
  }

  function moveCard(fromSectionId, cardId, toSectionId, targetCardId, placeBefore) {
    const model = data();
    const source = model.sections.find(function (item) { return item.id === fromSectionId; });
    if (!source) return;
    const index = source.cards.findIndex(function (item) { return item.id === cardId; });
    if (index < 0) return;
    const card = source.cards.splice(index, 1)[0];
    const targetSection = model.sections.find(function (item) { return item.id === toSectionId; }) || source;
    if (targetCardId && targetCardId !== cardId) {
      let targetIndex = targetSection.cards.findIndex(function (item) { return item.id === targetCardId; });
      if (targetIndex < 0) targetIndex = targetSection.cards.length;
      if (!placeBefore) targetIndex += 1;
      targetSection.cards.splice(targetIndex, 0, card);
    } else {
      targetSection.cards.push(card);
    }
    focusToken = { cardId: card.id };
    render();
  }

  function moveSectionToId(sectionId, targetId, placeBefore, targetColumn) {
    const model = data();
    const from = model.sections.findIndex(function (item) { return item.id === sectionId; });
    if (from < 0) return;
    const section = model.sections.splice(from, 1)[0];
    if (Number.isInteger(targetColumn) && targetColumn >= 0) section.column = targetColumn;
    let target = model.sections.findIndex(function (item) { return item.id === targetId; });
    if (target < 0) target = model.sections.length;
    if (!placeBefore) target += 1;
    model.sections.splice(target, 0, section);
    focusToken = { sectionId: section.id };
    render();
  }

  function restoreFocus() {
    if (!focusToken) return;
    const token = focusToken;
    focusToken = null;
    if (token.addUrl) {
      const input = els.board.querySelector('.add-card.form-mode input[type="url"]');
      if (input) input.focus();
      return;
    }
    if (token.cardId) {
      const cardEl = Array.prototype.slice.call(els.board.querySelectorAll('[data-card-id]'))
        .find(function (el) { return el.dataset.cardId === token.cardId; });
      if (cardEl) {
        const target = cardEl.querySelector('input[type="url"]') || cardEl;
        if (target === cardEl) cardEl.tabIndex = -1;
        target.focus();
      }
      return;
    }
    if (token.sectionId) {
      const sectionEl = Array.prototype.slice.call(els.board.querySelectorAll('[data-section-id]'))
        .find(function (el) { return el.dataset.sectionId === token.sectionId && el.classList.contains('section'); });
      if (sectionEl) {
        const target = sectionEl.querySelector('input.section-title') || sectionEl.querySelector('.section-drag-handle');
        if (target) target.focus();
      }
    }
  }

  // --- Editing lifecycle ---
  function startEditing() {
    if (editing) return;
    draft = deepClone(state);
    addTarget = null;
    editing = true;
    render();
  }

  function cancelEditing(notify) {
    if (!editing) return;
    editing = false;
    draft = null;
    addTarget = null;
    applySettings(state);
    render();
    if (notify !== false) toast(t('discarded'));
  }

  function requestCancel() {
    if (!editing) return;
    const changed = JSON.stringify(draft) !== JSON.stringify(state);
    if (!changed) { cancelEditing(false); return; }
    confirmDialog(t('confirmDiscard'), t('discard')).then(function (ok) {
      if (!ok) return;
      cancelEditing(true);
    });
  }

  async function save() {
    if (!editing || saving) return;
    saving = true;
    try {
      const model = draft;
      const badCards = [];
      model.sections.forEach(function (section, sectionIndex) {
        const kept = [];
        section.cards.forEach(function (card) {
          const raw = String(card.url || '').trim();
          if (!raw) return;
          const normalized = normalizeUrl(raw);
          if (!normalized) { badCards.push(card.id); kept.push(card); return; }
          card.url = normalized;
          card.title = cleanText(card.title, 120) || titleFromUrl(normalized);
          kept.push(card);
        });
        section.cards = kept;
        section.title = cleanText(section.title, 80) || (tFor(model.lang, 'defaultSection') + ' ' + (sectionIndex + 1));
        section.cardSize = clampInt(section.cardSize, CARD_SIZE_MIN, CARD_SIZE_MAX, CARD_SIZE_DEFAULT);
        section.color = validColor(section.color);
      });
      if (badCards.length) {
        toast(tFor(model.lang, 'invalidUrl'), 'error');
        focusToken = { cardId: badCards[0] };
        render();
        return;
      }
      const candidate = sanitizeState(model);
      const ok = await persist(candidate);
      if (!ok) { toast(tFor(model.lang, 'saveError'), 'error'); return; }
      const lang = candidate.lang;
      state = candidate;
      editing = false;
      draft = null;
      addTarget = null;
      applySettings(state);
      render();
      toast(tFor(lang, 'saved'));
    } finally {
      saving = false;
    }
  }

  function addSection() {
    if (!editing) return;
    const section = { id: id(), title: '', cardSize: CARD_SIZE_DEFAULT, color: null, cards: [] };
    draft.sections.push(section);
    addTarget = null;
    focusToken = { sectionId: section.id };
    render();
  }

  function onSetting(key, value) {
    const model = data();
    if (key === 'lang') model.lang = value === 'tr' ? 'tr' : 'en';
    else if (key === 'bg') model.bg = validBg(value);
    else if (key === 'dividers') model.dividers = clampInt(value, 1, 4, 1);
    else if (key === 'themeColor') model.themeColor = validColor(value) || '#ff6b6b';
    else return;
    applySettings(model);
    if (key === 'lang' || key === 'dividers') render();
    if (!editing) persist(sanitizeState(model));
  }

  // --- Import / export ---
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('read-error')); };
      reader.readAsText(file);
    });
  }

  function exportJson() {
    const payload = sanitizeState(data()) || sanitizeState(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-shortcuts.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(t('exported'));
  }

  async function onImportFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { toast(t('importTooBig'), 'error'); return; }
    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    if (!/\.json$/.test(fileName) && fileType && fileType.indexOf('application/json') !== 0) {
      toast(t('importBadType'), 'error');
      return;
    }
    let text;
    try { text = await readFile(file); }
    catch (e) { toast(t('importReadError'), 'error'); return; }
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { toast(t('importError'), 'error'); return; }
    if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.sections) && !Array.isArray(parsed.columns))) {
      toast(t('importError'), 'error');
      return;
    }
    if (typeof parsed.version === 'number' && parsed.version > SCHEMA_VERSION) {
      toast(t('importError'), 'error');
      return;
    }
    const next = sanitizeState(parsed);
    if (!next) { toast(t('importError'), 'error'); return; }
    if (editing) {
      draft = next;
      addTarget = null;
      applySettings(draft);
      render();
      toast(tFor(draft.lang, 'imported'));
    } else {
      const ok = await persist(next);
      if (!ok) { toast(t('saveError'), 'error'); return; }
      state = next;
      applySettings(state);
      render();
      toast(tFor(state.lang, 'imported'));
    }
  }

  // --- Storage sync ---
  function setupStorageSync() {
    if (hasChromeStorage() && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || editing || saving) return;
        const change = changes[STORAGE_KEY];
        if (!change || !change.newValue) return;
        const next = sanitizeState(change.newValue);
        if (!next) return;
        state = next;
        applySettings(state);
        render();
      });
    }
  }

  // --- Wiring ---
  function bindElements() {
    els.board = document.getElementById('board');
    els.emptyState = document.getElementById('empty-state');
    els.emptyEditBtn = document.getElementById('empty-edit-btn');
    els.addSectionBtn = document.getElementById('add-section-btn');
    els.exportBtn = document.getElementById('export-btn');
    els.importBtn = document.getElementById('import-btn');
    els.importFile = document.getElementById('import-file');
    els.langSelect = document.getElementById('lang-select');
    els.dividerSelect = document.getElementById('divider-select');
    els.themeColorInput = document.getElementById('theme-color-input');
    els.bgSelect = document.getElementById('bg-select');
    els.globalCancelBtn = document.getElementById('global-cancel-btn');
    els.globalEditToggle = document.getElementById('global-edit-toggle');
    els.confirmOverlay = document.getElementById('confirm-overlay');
    els.confirmMessage = document.getElementById('confirm-message');
    els.confirmOk = document.getElementById('confirm-ok');
    els.confirmCancel = document.getElementById('confirm-cancel');
    els.toast = document.getElementById('toast');
  }

  function onKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editing) {
      event.preventDefault();
      save();
      return;
    }
    if (event.key !== 'Escape' || !els.confirmOverlay.hidden) return;
    if (addTarget) { event.preventDefault(); addTarget = null; render(); return; }
    if (editing) { event.preventDefault(); requestCancel(); }
  }

  function bindHandlers() {
    els.emptyEditBtn.addEventListener('click', startEditing);
    els.globalEditToggle.addEventListener('click', function () { if (editing) save(); else startEditing(); });
    els.globalCancelBtn.addEventListener('click', requestCancel);
    els.addSectionBtn.addEventListener('click', addSection);
    els.exportBtn.addEventListener('click', exportJson);
    els.importBtn.addEventListener('click', function () { els.importFile.click(); });
    els.importFile.addEventListener('change', onImportFile);
    els.langSelect.addEventListener('change', function (event) { onSetting('lang', event.target.value); });
    els.bgSelect.addEventListener('change', function (event) { onSetting('bg', event.target.value); });
    els.dividerSelect.addEventListener('change', function (event) { onSetting('dividers', event.target.value); });
    els.themeColorInput.addEventListener('input', function (event) { onSetting('themeColor', event.target.value); });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('dragend', clearDrag);
    window.addEventListener('beforeunload', function (event) {
      if (editing && draft && JSON.stringify(draft) !== JSON.stringify(state)) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  async function init() {
    bindElements();
    try {
      state = await loadState();
    } catch (e) {

      state = defaultState();
    }
    applySettings(state);
    render();
    bindHandlers();
    setupStorageSync();
  }

  init().catch(function () { });
})();
