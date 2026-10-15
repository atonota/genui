// Offline classic-script locale layer. Canonical source and exports remain English.
const ATLAS_TR = JSON.parse(document.getElementById('atlas-i18n-tr')?.textContent || '{}');
const ATLAS_EN = Object.fromEntries(Object.entries(ATLAS_TR).map(([en, tr]) => [tr, en]));
let atlasLocale = 'en';
const localeTextSources = new WeakMap();
const localeAttributeSources = new WeakMap();
let localeObserver;
function getLocale() {
  return atlasLocale;
}
function localeRegex(dictionary) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = Object.keys(dictionary)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return new RegExp(
    keys
      .map(key => {
        const first = /^[\p{L}\p{N}]/u.test(key) ? '(?<![\\p{L}\\p{N}])' : '';
        const last = /[\p{L}\p{N}]$/u.test(key) ? '(?![\\p{L}\\p{N}])' : '';
        return first + escape(key) + last;
      })
      .join('|') || '(?!)',
    'gu',
  );
}
const localeEnglishPattern = localeRegex(ATLAS_TR);
const localeTurkishPattern = localeRegex(ATLAS_EN);
function canonicalLocaleText(message) {
  if (Object.hasOwn(ATLAS_TR, message)) return message;
  if (Object.hasOwn(ATLAS_EN, message)) return ATLAS_EN[message];
  return /[çğıöşüÇĞİÖŞÜ]/.test(message)
    ? message.replace(localeTurkishPattern, phrase => ATLAS_EN[phrase])
    : message;
}
function t(message, params = {}) {
  const source = String(message);
  const translated =
    atlasLocale === 'tr'
      ? Object.hasOwn(ATLAS_TR, source)
        ? ATLAS_TR[source]
        : source.replace(localeEnglishPattern, phrase => ATLAS_TR[phrase])
      : source;
  return translated.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(params, key) ? String(params[key]) : match,
  );
}
function formatNumber(value, options) {
  return new Intl.NumberFormat(atlasLocale === 'tr' ? 'tr-TR' : 'en-US', options).format(value);
}
function normalizeSearch(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('en-US')
    .trim();
}
function localeEligible(node) {
  const owner = node.nodeType === 1 ? node : node.parentElement;
  return owner && !owner.closest('script,style,pre,code,textarea,[data-i18n-ignore]');
}
function localizeTextNode(node) {
  if (
    !localeEligible(node) ||
    !node.parentElement.closest('[data-i18n]') ||
    !node.nodeValue?.trim()
  )
    return;
  const previous = localeTextSources.get(node);
  const source =
    previous && node.nodeValue === previous.display
      ? previous.source
      : canonicalLocaleText(node.nodeValue);
  const display = t(source);
  localeTextSources.set(node, { source, display });
  if (node.nodeValue !== display) node.nodeValue = display;
}
function localizeAttributes(node) {
  if (!localeEligible(node)) return;
  let sources = localeAttributeSources.get(node);
  if (!sources) {
    sources = new Map();
    localeAttributeSources.set(node, sources);
  }
  for (const name of ['aria-label', 'title', 'placeholder', 'content']) {
    if (
      !node.hasAttribute(name) ||
      !(node.hasAttribute('data-i18n-' + name) || node.closest('[data-i18n]'))
    )
      continue;
    if (name === 'content' && node.getAttribute('name') !== 'description') continue;
    const value = node.getAttribute(name),
      previous = sources.get(name);
    const source =
      previous && value === previous.display ? previous.source : canonicalLocaleText(value);
    const display = t(source);
    sources.set(name, { source, display });
    if (value !== display) node.setAttribute(name, display);
  }
}
function localizeTree(root) {
  if (root.nodeType === 3) {
    localizeTextNode(root);
    return;
  }
  if (root.nodeType !== 1 || !localeEligible(root)) return;
  localizeAttributes(root);
  for (const child of root.childNodes) localizeTree(child);
}
function setLocale(value) {
  atlasLocale = value === 'tr' ? 'tr' : 'en';
  try {
    localStorage.setItem('atlas-locale', atlasLocale);
  } catch {}
  document.documentElement.lang = atlasLocale;
  document.documentElement.dataset.locale = atlasLocale;
  for (const value of ['en', 'tr'])
    document
      .getElementById('locale-' + value)
      ?.setAttribute('aria-pressed', String(value === atlasLocale));
  document.dispatchEvent(
    new CustomEvent('atlas:localechange', { detail: { locale: atlasLocale } }),
  );
  localizeTree(document.documentElement);
}
function initializeLocale() {
  for (const value of ['en', 'tr'])
    document.getElementById('locale-' + value).onclick = () => setLocale(value);
  let saved;
  try {
    saved = localStorage.getItem('atlas-locale');
  } catch {}
  setLocale(saved === 'tr' ? 'tr' : 'en');
  localeObserver = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') localizeTextNode(record.target);
      else if (record.type === 'attributes') localizeAttributes(record.target);
      else for (const node of record.addedNodes) localizeTree(node);
    }
  });
  localeObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder', 'content'],
  });
}
