import { useEffect, useRef } from 'react';
import { usePreferences, type LanguageCode } from '../../stores/preferences';
import { translateTextsWithGoogle, type TranslationLanguage } from './googleTranslateService';

const sourceLanguage: LanguageCode = 'PT';
const batchSize = 50;
const maxTextLength = 1000;
const cachePrefix = 'sigparamirim:google-translation:v1';
const translatableAttributes = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'] as const;
const noTranslateSelector = [
  '[data-no-auto-translate]',
  '[translate="no"]',
  '.notranslate',
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'video', 'audio', 'iframe',
  'code', 'pre', '[contenteditable="true"]', '.ol-viewport', '.map-canvas',
].join(',');
const hasLetter = /\p{L}/u;

type TextRecord = { original: string; translated?: string };
type AttributeName = (typeof translatableAttributes)[number];
type AttributeRecord = { original: string; translated?: string };
type Target =
  | { kind: 'text'; node: Text; source: string; original: string }
  | { kind: 'attribute'; element: Element; attribute: AttributeName; source: string; original: string };

const textRecords = new WeakMap<Text, TextRecord>();
const attributeRecords = new WeakMap<Element, Map<AttributeName, AttributeRecord>>();
const translatedElementOriginals = new WeakMap<Element, { lang: string | null; dir: string | null }>();
const memoryCache = new Map<string, string>();

function normalize(value: string) { return value.trim().replace(/\s+/g, ' '); }

function hash(value: string) {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) result = (result * 33) ^ value.charCodeAt(index);
  return (result >>> 0).toString(36);
}

function cacheKey(language: TranslationLanguage, source: string) {
  return `${cachePrefix}:${language}:${source.length}:${hash(source)}`;
}

function readCache(language: TranslationLanguage, source: string) {
  const key = cacheKey(language, source);
  const memory = memoryCache.get(key);
  if (memory) return memory;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const record = JSON.parse(value) as { source?: string; translated?: string };
    if (record.source === source && typeof record.translated === 'string') {
      memoryCache.set(key, record.translated);
      return record.translated;
    }
  } catch { /* Private browsing or storage quota: continue without persistence. */ }
  return null;
}

function writeCache(language: TranslationLanguage, source: string, translated: string) {
  const key = cacheKey(language, source);
  memoryCache.set(key, translated);
  try { window.localStorage.setItem(key, JSON.stringify({ source, translated })); } catch { /* In-memory cache remains available. */ }
}

function isTranslatable(value: string) {
  const source = normalize(value);
  return source.length >= 2
    && source.length <= maxTextLength
    && hasLetter.test(source)
    && !/^https?:\/\//i.test(source)
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);
}

function getOriginalText(node: Text) {
  const current = node.nodeValue ?? '';
  const record = textRecords.get(node);
  if (!record) {
    textRecords.set(node, { original: current });
    return current;
  }
  if (record.translated === current) return record.original;
  record.original = current; // React changed this node since its previous translation.
  record.translated = undefined;
  return current;
}

function getAttributeRecord(element: Element, attribute: AttributeName, current: string) {
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }
  let record = records.get(attribute);
  if (!record) {
    record = { original: current };
    records.set(attribute, record);
  } else if (record.translated !== current) {
    record.original = current;
    record.translated = undefined;
  }
  return record;
}

function collectTargets(root: HTMLElement) {
  const targets: Target[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(`${noTranslateSelector}, input, textarea, select, option`)) return NodeFilter.FILTER_REJECT;
      return isTranslatable(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const original = getOriginalText(textNode);
    targets.push({ kind: 'text', node: textNode, original, source: normalize(original) });
    node = walker.nextNode();
  }

  const attributeSelector = translatableAttributes.map((attribute) => `[${attribute}]`).join(',');
  root.querySelectorAll(attributeSelector).forEach((element) => {
    if (element.closest(noTranslateSelector)) return;
    translatableAttributes.forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current || !isTranslatable(current)) return;
      const original = getAttributeRecord(element, attribute, current).original;
      targets.push({ kind: 'attribute', element, attribute, original, source: normalize(original) });
    });
  });
  return targets;
}

function markTranslated(element: Element, language: TranslationLanguage) {
  if (!translatedElementOriginals.has(element)) {
    translatedElementOriginals.set(element, { lang: element.getAttribute('lang'), dir: element.getAttribute('dir') });
  }
  element.setAttribute('lang', language === 'ZH' ? 'zh-CN' : language.toLowerCase());
  element.setAttribute('dir', 'auto');
  element.setAttribute('data-sig-translated', 'true');
}

function applyTranslation(target: Target, translated: string, language: TranslationLanguage) {
  if (target.kind === 'text') {
    if (!target.node.isConnected) return;
    const leading = target.original.match(/^\s*/)?.[0] ?? '';
    const trailing = target.original.match(/\s*$/)?.[0] ?? '';
    target.node.nodeValue = `${leading}${translated}${trailing}`;
    const record = textRecords.get(target.node);
    if (record) record.translated = target.node.nodeValue ?? '';
    if (target.node.parentElement) markTranslated(target.node.parentElement, language);
    return;
  }
  if (!target.element.isConnected) return;
  target.element.setAttribute(target.attribute, translated);
  const record = attributeRecords.get(target.element)?.get(target.attribute);
  if (record) record.translated = translated;
  markTranslated(target.element, language);
}

function restoreOriginal(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const record = textRecords.get(textNode);
    if (record && record.translated === textNode.nodeValue) {
      textNode.nodeValue = record.original;
      record.translated = undefined;
    }
    node = walker.nextNode();
  }

  const selector = translatableAttributes.map((attribute) => `[${attribute}]`).join(',');
  root.querySelectorAll(selector).forEach((element) => {
    attributeRecords.get(element)?.forEach((record, attribute) => {
      if (record.translated === element.getAttribute(attribute)) {
        element.setAttribute(attribute, record.original);
        record.translated = undefined;
      }
    });
  });
  root.querySelectorAll('[data-sig-translated="true"]').forEach((element) => {
    const original = translatedElementOriginals.get(element);
    if (original?.lang === null || !original) element.removeAttribute('lang');
    else element.setAttribute('lang', original.lang);
    if (original?.dir === null || !original) element.removeAttribute('dir');
    else element.setAttribute('dir', original.dir);
    element.removeAttribute('data-sig-translated');
  });
}

async function translateTargets(
  targets: Target[],
  language: TranslationLanguage,
  isCurrent: () => boolean,
  mutateSafely: (callback: () => void) => void,
) {
  const translations = new Map<string, string>();
  const pending: string[] = [];
  for (const target of targets) {
    if (translations.has(target.source)) continue;
    const cached = readCache(language, target.source);
    if (cached) translations.set(target.source, cached);
    else pending.push(target.source);
  }

  const uniquePending = [...new Set(pending)];
  const batches: string[][] = [];
  for (let index = 0; index < uniquePending.length; index += batchSize) batches.push(uniquePending.slice(index, index + batchSize));
  const results = await Promise.all(batches.map((batch) => translateTextsWithGoogle(batch, language)));
  if (!isCurrent()) return;
  batches.forEach((batch, batchIndex) => batch.forEach((source, index) => {
    const translated = results[batchIndex]?.[index];
    if (translated) {
      translations.set(source, translated);
      writeCache(language, source, translated);
    }
  }));

  if (!isCurrent()) return;
  mutateSafely(() => targets.forEach((target) => {
    const translated = translations.get(target.source);
    if (translated) applyTranslation(target, translated, language);
  }));
}

export function GoogleAutoTranslate() {
  const language = usePreferences((state) => state.language);
  const runId = useRef(0);
  const applying = useRef(false);

  useEffect(() => {
    const root = document.body;
    const currentRun = ++runId.current;
    let disposed = false;
    let debounce: number | undefined;
    const isCurrent = () => !disposed && runId.current === currentRun;
    const mutateSafely = (callback: () => void) => {
      applying.current = true;
      try { callback(); } finally { window.setTimeout(() => { applying.current = false; }, 0); }
    };

    const run = async () => {
      if (language === sourceLanguage) {
        mutateSafely(() => restoreOriginal(root));
        document.documentElement.dataset.translationState = 'original';
        return;
      }
      document.documentElement.dataset.translationState = 'loading';
      try {
        const targets = collectTargets(root);
        if (targets.length) await translateTargets(targets, language as TranslationLanguage, isCurrent, mutateSafely);
        if (isCurrent()) document.documentElement.dataset.translationState = 'translated';
      } catch {
        if (isCurrent()) document.documentElement.dataset.translationState = 'error';
        // The original Portuguese interface remains usable when the service is unavailable.
        console.warn('Não foi possível traduzir a interface do SIG Paramirim. Verifique a configuração da tradução Google.');
      }
    };
    const schedule = () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => { if (!applying.current) void run(); }, 180);
    };
    const observer = new MutationObserver(() => { if (!applying.current) schedule(); });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatableAttributes],
    });
    void run();
    return () => {
      disposed = true;
      observer.disconnect();
      if (debounce !== undefined) window.clearTimeout(debounce);
    };
  }, [language]);

  return null;
}
