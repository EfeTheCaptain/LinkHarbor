// Unit tests for pure utility functions (copied from newtab.js for isolation)
const { test, describe } = require('node:test');
const assert = require('node:assert');

// --- Copied pure functions from newtab.js ---

function id() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
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

const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '.local',
  '.internal',
  '.test',
  '.example',
  '.invalid',
  'chrome://',
  'chrome-extension://',
  'moz-extension://',
  'edge://',
  'brave://',
  'about:',
  'file://'
];

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
  }
  return BLOCKED_HOST_SUFFIXES.some(suffix => {
    if (suffix.startsWith('.')) {
      return lower === suffix.slice(1) || lower.endsWith(suffix);
    }
    return lower === suffix || lower.endsWith('.' + suffix);
  });
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
    if (isBlockedHost(url.hostname)) return '';
    return url.href;
  } catch (e) {
    return '';
  }
}

function hostOf(raw) {
  try { return new URL(raw).hostname.replace(/^www\./i, ''); } catch (e) { return ''; }
}

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

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (e) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value));
}

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
      cardSize: clampInt(rawSection.cardSize, 70, 300, 110),
      color: validColor(rawSection.color),
      cards
    };
    if (Number.isInteger(rawSection.column) && rawSection.column >= 0) {
      section.column = rawSection.column;
    }
    sections.push(section);
  }
  return {
    version: 3,
    lang: source.lang === 'tr' ? 'tr' : 'en',
    themeColor: validColor(source.themeColor) || '#ff6b6b',
    bg: validBg(source.bg),
    dividers: clampInt(source.dividers, 1, 4, 1),
    sections
  };
}

function defaultState() {
  return { version: 3, lang: 'en', themeColor: '#ff6b6b', bg: 'dark', dividers: 1, sections: [] };
}

const assignmentCache = new Map();

function computeAssignments(sections, columnsCount) {
  const key = sections.map(s => s.column ?? -1).join(',') + '|' + columnsCount;
  const cached = assignmentCache.get(key);
  if (cached) return cached;
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
  if (assignmentCache.size > 50) assignmentCache.clear();
  assignmentCache.set(key, assignments);
  return assignments;
}

// --- Tests ---

describe('Utility functions', () => {
  test('id() generates unique strings', () => {
    const a = id();
    const b = id();
    assert.ok(typeof a === 'string' && a.length > 0);
    assert.notStrictEqual(a, b);
  });

  test('cleanText strips control chars and trims', () => {
    assert.strictEqual(cleanText('  hello  '), 'hello');
    assert.strictEqual(cleanText('hello\x00world'), 'helloworld');
    assert.strictEqual(cleanText('<script>'), 'script');
    assert.strictEqual(cleanText(null), '');
    assert.strictEqual(cleanText(undefined), '');
    assert.strictEqual(cleanText('a'.repeat(200), 50), 'a'.repeat(50));
  });

  test('validColor accepts valid hex colors', () => {
    assert.strictEqual(validColor('#ff6b6b'), '#ff6b6b');
    assert.strictEqual(validColor('#FF6B6B'), '#ff6b6b');
    assert.strictEqual(validColor('#abcdef'), '#abcdef');
    assert.strictEqual(validColor('ff6b6b'), null);
    assert.strictEqual(validColor('#gggggg'), null);
    assert.strictEqual(validColor('#ff6b6'), null);
    assert.strictEqual(validColor(null), null);
  });

  test('validBg accepts known backgrounds', () => {
    assert.strictEqual(validBg('dark'), 'dark');
    assert.strictEqual(validBg('light'), 'light');
    assert.strictEqual(validBg('sepia'), 'sepia');
    assert.strictEqual(validBg('unknown'), 'dark');
    assert.strictEqual(validBg(null), 'dark');
  });

  test('clampInt clamps to range', () => {
    assert.strictEqual(clampInt(50, 0, 100, 10), 50);
    assert.strictEqual(clampInt(-5, 0, 100, 10), 0);
    assert.strictEqual(clampInt(150, 0, 100, 10), 100);
    assert.strictEqual(clampInt('abc', 0, 100, 10), 10);
    assert.strictEqual(clampInt(null, 0, 100, 10), 10);
  });

  test('deepClone creates independent copies', () => {
    const obj = { a: 1, b: { c: 2 }, d: [1, 2, 3] };
    const clone = deepClone(obj);
    assert.deepStrictEqual(clone, obj);
    clone.b.c = 99;
    assert.strictEqual(obj.b.c, 2);
    clone.d.push(4);
    assert.strictEqual(obj.d.length, 3);
  });
});

describe('URL normalization', () => {
  test('normalizeUrl accepts valid http(s) URLs', () => {
    assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com/');
    assert.strictEqual(normalizeUrl('http://example.com/path?query=1'), 'http://example.com/path?query=1');
    assert.strictEqual(normalizeUrl('example.com'), 'https://example.com/');
    assert.strictEqual(normalizeUrl('  https://example.com  '), 'https://example.com/');
  });

  test('normalizeUrl rejects invalid protocols', () => {
    assert.strictEqual(normalizeUrl('ftp://example.com'), '');
    assert.strictEqual(normalizeUrl('javascript:alert(1)'), '');
    assert.strictEqual(normalizeUrl('data:text/html,<script>'), '');
    assert.strictEqual(normalizeUrl('chrome://settings'), '');
    assert.strictEqual(normalizeUrl('file:///etc/passwd'), '');
  });

  test('normalizeUrl rejects blocked hosts', () => {
    assert.strictEqual(normalizeUrl('http://localhost'), '');
    assert.strictEqual(normalizeUrl('http://127.0.0.1'), '');
    assert.strictEqual(normalizeUrl('http://192.168.1.1'), '');
    assert.strictEqual(normalizeUrl('http://10.0.0.1'), '');
    assert.strictEqual(normalizeUrl('http://172.16.0.1'), '');
    assert.strictEqual(normalizeUrl('http://my.local'), '');
    assert.strictEqual(normalizeUrl('http://my.internal'), '');
  });

  test('normalizeUrl allows public IPs', () => {
    assert.strictEqual(normalizeUrl('http://8.8.8.8'), 'http://8.8.8.8/');
    assert.strictEqual(normalizeUrl('http://1.1.1.1'), 'http://1.1.1.1/');
  });

  test('hostOf extracts hostname', () => {
    assert.strictEqual(hostOf('https://www.example.com/path'), 'example.com');
    assert.strictEqual(hostOf('http://sub.domain.com'), 'sub.domain.com');
    assert.strictEqual(hostOf('invalid'), '');
  });

  test('titleFromUrl generates titles from domains', () => {
    assert.strictEqual(titleFromUrl('https://google.com'), 'Google');
    assert.strictEqual(titleFromUrl('https://github.com/user/repo'), 'GitHub');
    assert.strictEqual(titleFromUrl('https://example.com'), 'Example');
  });

  test('initialOf extracts first alphanumeric', () => {
    assert.strictEqual(initialOf({ title: 'Hello', url: 'https://example.com' }), 'H');
    assert.strictEqual(initialOf({ title: '', url: 'https://example.com' }), 'E');
    assert.strictEqual(initialOf({ title: '', url: 'https://123.com' }), '1');
  });
});

describe('State sanitization', () => {
  test('sanitizeState handles valid state', () => {
    const input = {
      version: 3,
      lang: 'en',
      themeColor: '#ff6b6b',
      bg: 'dark',
      dividers: 2,
      sections: [{
        id: 'sec1',
        title: 'Test',
        cardSize: 110,
        color: '#ff6b6b',
        cards: [{ id: 'card1', url: 'https://example.com', title: 'Example' }]
      }]
    };
    const result = sanitizeState(input);
    assert.ok(result);
    assert.strictEqual(result.version, 3);
    assert.strictEqual(result.sections.length, 1);
    assert.strictEqual(result.sections[0].cards.length, 1);
  });

  test('sanitizeState handles legacy columns format', () => {
    const input = {
      columns: [[{ title: 'Sec1', cards: [{ url: 'https://a.com', title: 'A' }] }]],
      dividerCount: 1
    };
    const result = sanitizeState(input);
    assert.ok(result);
    assert.strictEqual(result.sections.length, 1);
    assert.strictEqual(result.dividers, 1);
  });

  test('sanitizeState clamps limits', () => {
    const manySections = Array(60).fill({ title: 'S', cards: [] });
    const input = { sections: manySections };
    const result = sanitizeState(input);
    assert.ok(result.sections.length <= 50);

    const manyCards = Array(600).fill({ url: 'https://a.com', title: 'A' });
    const input2 = { sections: [{ title: 'S', cards: manyCards }] };
    const result2 = sanitizeState(input2);
    assert.ok(result2.sections[0].cards.length <= 500);
  });

  test('sanitizeState filters invalid URLs', () => {
    const input = {
      sections: [{
        title: 'Test',
        cards: [
          { url: 'https://valid.com', title: 'Valid' },
          { url: 'javascript:alert(1)', title: 'Invalid' },
          { url: 'http://localhost', title: 'Blocked' }
        ]
      }]
    };
    const result = sanitizeState(input);
    assert.strictEqual(result.sections[0].cards.length, 1);
    assert.strictEqual(result.sections[0].cards[0].title, 'Valid');
  });
});

describe('computeAssignments', () => {
  test('distributes sections across columns', () => {
    const sections = [
      { id: '1', column: 0 },
      { id: '2', column: 1 },
      { id: '3' },
      { id: '4' }
    ];
    const result = computeAssignments(sections, 2);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0], 0);
    assert.strictEqual(result[1], 1);
  });

  test('respects explicit column assignments', () => {
    const sections = [
      { id: '1', column: 1 },
      { id: '2', column: 1 },
      { id: '3' }
    ];
    const result = computeAssignments(sections, 2);
    assert.strictEqual(result[0], 1);
    assert.strictEqual(result[1], 1);
    assert.strictEqual(result[2], 0);
  });

  test('handles empty sections', () => {
    const result = computeAssignments([], 3);
    assert.deepStrictEqual(result, []);
  });

  test('cache works for repeated calls', () => {
    const sections = [{ id: '1' }, { id: '2' }];
    const r1 = computeAssignments(sections, 2);
    const r2 = computeAssignments(sections, 2);
    assert.deepStrictEqual(r1, r2);
  });
});

describe('defaultState', () => {
  test('returns valid default state', () => {
    const state = defaultState();
    assert.strictEqual(state.version, 3);
    assert.strictEqual(state.lang, 'en');
    assert.strictEqual(state.themeColor, '#ff6b6b');
    assert.strictEqual(state.bg, 'dark');
    assert.strictEqual(state.dividers, 1);
    assert.deepStrictEqual(state.sections, []);
  });
});

describe('isBlockedHost', () => {
  test('blocks private IP ranges', () => {
    assert.ok(isBlockedHost('10.0.0.1'));
    assert.ok(isBlockedHost('192.168.1.1'));
    assert.ok(isBlockedHost('172.16.0.1'));
    assert.ok(isBlockedHost('172.31.255.255'));
    assert.ok(isBlockedHost('127.0.0.1'));
    assert.ok(isBlockedHost('169.254.1.1'));
    assert.ok(isBlockedHost('0.0.0.0'));
  });

  test('allows public IPs', () => {
    assert.ok(!isBlockedHost('8.8.8.8'));
    assert.ok(!isBlockedHost('1.1.1.1'));
    assert.ok(!isBlockedHost('203.0.113.1'));
  });

  test('blocks reserved hostnames', () => {
    assert.ok(isBlockedHost('localhost'));
    assert.ok(isBlockedHost('my.local'));
    assert.ok(isBlockedHost('my.internal'));
    assert.ok(isBlockedHost('test.example'));
  });

  test('allows normal hostnames', () => {
    assert.ok(!isBlockedHost('example.com'));
    assert.ok(!isBlockedHost('google.com'));
    assert.ok(!isBlockedHost('github.io'));
  });
});