import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { infoPageTranslations, translations } from '../src/platform/i18n.js';
import { generatedTranslations } from '../src/platform/generatedTranslations.js';
import { manualTranslations } from '../src/platform/manualTranslations.js';
import { intakeTranslations } from '../src/platform/intakeTranslations.js';
import { languageOptions } from '../src/platform/data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src', 'platform', 'generatedTranslations.js');
const targets = languageOptions.map(({ code }) => code).filter((code) => code !== 'en');
const sourceCatalog = translations.en;
const sourceKeys = Object.keys(sourceCatalog);
const placeholderPattern = /\{[a-zA-Z0-9_]+\}/g;
const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com')
  .replace(/\/+$/, '');
const batchSize = 40;

function assertPlaceholders(source, translated, language, key) {
  const expected = [...new Set(source.match(placeholderPattern) || [])].sort();
  const actual = [...new Set(translated.match(placeholderPattern) || [])].sort();
  if (expected.length !== actual.length || expected.some((token, index) => token !== actual[index])) {
    throw new Error(`Placeholder mismatch in ${language} catalog key "${key}". No catalogs were written.`);
  }
}

function protectPlaceholders(text) {
  const tokens = [];
  const protectedText = text.replace(placeholderPattern, (placeholder) => {
    const token = `__NERAVU_TOKEN_${tokens.length}__`;
    tokens.push({ token, placeholder });
    return token;
  });
  return {
    text: protectedText,
    restore(translated) {
      let output = translated;
      for (const { token, placeholder } of tokens) {
        if (!output.includes(token)) {
          throw new Error(`Azure Translator did not preserve placeholder ${placeholder}. No catalogs were written.`);
        }
        output = output.replaceAll(token, placeholder);
      }
      return output;
    }
  };
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function translateBatch(texts, language) {
  const url = new URL(`${endpoint}/translate`);
  url.searchParams.set('api-version', '3.0');
  url.searchParams.set('to', language);
  url.searchParams.set('textType', 'plain');

  const headers = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_TEXT_KEY,
    'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATOR_REGION
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(texts.map(({ text }) => ({ Text: text })))
    });

    if (response.ok) {
      const results = await response.json();
      if (!Array.isArray(results) || results.length !== texts.length) {
        throw new Error(`Azure Translator returned an unexpected response for ${language}. No catalogs were written.`);
      }
      return results.map((item, index) => {
        const translated = item?.translations?.[0]?.text;
        if (typeof translated !== 'string') {
          throw new Error(`Azure Translator omitted text for ${language}. No catalogs were written.`);
        }
        return texts[index].restore(translated);
      });
    }

    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
      throw new Error(`Azure Translator returned HTTP ${response.status} for ${language}. No catalogs were written.`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await pause(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
  }

  throw new Error(`Azure Translator retries exhausted for ${language}. No catalogs were written.`);
}

async function main() {
  if (!sourceKeys.length) throw new Error('The English translation catalog is empty.');
  const configuredTargets = languageOptions.map(({ code }) => code).filter((code) => code !== 'en');
  if (targets.length !== configuredTargets.length || targets.some((code) => !configuredTargets.includes(code))) {
    throw new Error('The translation target list does not match the languages offered by the UI.');
  }

  for (const key of sourceKeys) {
    if (typeof sourceCatalog[key] !== 'string') {
      throw new Error(`English translation key "${key}" is not a string.`);
    }
  }

  const validateCatalogs = (catalogs) => {
    const coverage = {};
    for (const language of targets) {
      const merged = {
        ...(translations[language] || {}),
        ...(catalogs[language] || {}),
        ...(intakeTranslations[language] || {}),
        ...(manualTranslations[language] || {}),
        ...(infoPageTranslations[language] || {})
      };
      for (const [key, text] of Object.entries(merged)) {
        if (typeof text !== 'string') {
          throw new Error(`${language} translation key "${key}" is not a string.`);
        }
        if (Object.hasOwn(sourceCatalog, key)) {
          assertPlaceholders(sourceCatalog[key], text, language, key);
        }
      }
      coverage[language] = sourceKeys.filter((key) => merged[key]).length;
    }
    return coverage;
  };

  if (process.argv.includes('--validate')) {
    const coverage = validateCatalogs(generatedTranslations);
    console.log(`Validated ${sourceKeys.length} English UI strings and interpolation tokens.`);
    for (const language of targets) {
      console.log(`${language}: ${coverage[language]}/${sourceKeys.length} UI strings available.`);
    }
    return;
  }

  if (!process.env.AZURE_TRANSLATOR_TEXT_KEY || !process.env.AZURE_TRANSLATOR_REGION) {
    throw new Error('Set AZURE_TRANSLATOR_TEXT_KEY and AZURE_TRANSLATOR_REGION in your shell before generating catalogs.');
  }

  const result = {};
  for (const language of targets) {
    const existing = translations[language] || {};
    const keysToTranslate = sourceKeys.filter((key) => (
      (!Object.hasOwn(existing, key) || !existing[key])
      && !Object.hasOwn(intakeTranslations[language] || {}, key)
      && !Object.hasOwn(manualTranslations[language] || {}, key)
      && !Object.hasOwn(infoPageTranslations[language] || {}, key)
    ));
    const catalog = {
      ...(generatedTranslations[language] || {}),
      ...(manualTranslations[language] || {}),
      ...(infoPageTranslations[language] || {})
    };

    for (let offset = 0; offset < keysToTranslate.length; offset += batchSize) {
      const batchKeys = keysToTranslate.slice(offset, offset + batchSize);
      const protectedTexts = batchKeys.map((key) => ({
        key,
        ...protectPlaceholders(sourceCatalog[key])
      }));
      const translated = await translateBatch(protectedTexts, language);
      translated.forEach((text, index) => {
        const key = batchKeys[index];
        assertPlaceholders(sourceCatalog[key], text, language, key);
        catalog[key] = text;
      });
      console.log(`${language}: translated ${Math.min(offset + batchKeys.length, keysToTranslate.length)}/${keysToTranslate.length}`);
      await pause(120);
    }

    result[language] = catalog;
  }

  const coverage = validateCatalogs(result);
  for (const language of targets) {
    const missing = sourceKeys.filter((key) => !(
      translations[language]?.[key]
      || intakeTranslations[language]?.[key]
      || infoPageTranslations[language]?.[key]
      || result[language]?.[key]
    ));
    if (missing.length) {
      throw new Error(`${language} catalog is missing ${missing.length} keys. No catalogs were written.`);
    }
  }

  const metadata = {
    status: 'machine-translated-draft-pending-human-review',
    generatedAt: new Date().toISOString(),
    languages: targets
  };
  const contents = `export const generatedTranslations = ${JSON.stringify(result, null, 2)};\n`
    + `export const generatedTranslationMetadata = ${JSON.stringify(metadata, null, 2)};\n`;
  await writeFile(outputPath, contents, 'utf8');
  console.log(`Wrote draft catalogs for ${targets.length} languages to src/platform/generatedTranslations.js.`);
  for (const language of targets) {
    console.log(`${language}: ${coverage[language]}/${sourceKeys.length} UI strings available.`);
  }
  console.log('Review every translation with fluent speakers before treating it as authoritative.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'UI translation generation failed.');
  process.exitCode = 1;
});
