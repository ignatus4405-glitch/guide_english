#!/usr/bin/env node
/**
 * Вырезает из docs/CHANGELOG.md раздел нужной версии и пишет build/release-notes.md.
 * Этот файл читает electron-builder (releaseInfo.releaseNotesFile) и кладёт в тело GitHub Release.
 *
 * Использование: node scripts/extract-release-notes.js 0.2.0
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/extract-release-notes.js <version>');
  process.exit(1);
}

const changelogPath = path.join(ROOT, 'docs', 'CHANGELOG.md');
const outPath = path.join(ROOT, 'build', 'release-notes.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

let notes = `## Guide English ${version}\n\n`;

if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = changelog.split('\n');
  const start = lines.findIndex(l => l.startsWith(`## [${version}]`));
  if (start >= 0) {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^## \[/.test(lines[i])) { end = i; break; }
    }
    const section = lines.slice(start + 1, end).join('\n').trim();
    notes = `## Guide English ${version}\n\n${section}\n`;
  }
}

notes += `
### Установка

1. Скачайте \`Guide-English-Setup-${version}.exe\` и запустите.
2. SmartScreen может предупредить — «Подробнее» → «Выполнить в любом случае».
3. Приложение само проверяет обновления на GitHub и обновляется в один клик.

Портативная версия: \`Guide-English-Portable-${version}.exe\` (без установки, обновляется вручную).

**Полный список изменений:** [docs/CHANGELOG.md](https://github.com/ignatus4405-glitch/guide_english/blob/main/docs/CHANGELOG.md)
`;

fs.writeFileSync(outPath, notes);
console.log(`✓ ${path.relative(ROOT, outPath)} (${notes.length} символов)`);
