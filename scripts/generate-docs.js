#!/usr/bin/env node
/**
 * Генерирует документацию из учебных данных:
 *   docs/CONTENT_INDEX.md  — полный индекс контента (детерминированный)
 *   README.md              — блок статистики между маркерами CONTENT_STATS
 *
 * Детерминированность важна: CI сравнивает результат через `git diff --exit-code`,
 * чтобы данные и документация не расходились.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

const grammar = require(path.join(ROOT, 'src/data/grammar.js'));
const listening = require(path.join(ROOT, 'src/data/listening.js'));
const vocabulary = require(path.join(ROOT, 'src/data/vocabulary.js'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function sha256(rel) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, rel)))
    .digest('hex')
    .slice(0, 16);
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|');
}

const grammarExercises = grammar.reduce((n, t) => n + (t.content.exercises?.length || 0), 0);
const lessons = listening.flatMap(l => l.lessons.map(x => ({ ...x, level: l.title })));
const questions = lessons.reduce((n, l) => n + l.questions.length, 0);
const words = vocabulary.reduce((n, s) => n + s.words.length, 0);

// ---------- CONTENT_INDEX.md ----------
let md = `# Индекс учебного контента

> Файл сгенерирован автоматически: \`npm run docs:generate\`.
> Не редактируйте вручную — изменения будут перезаписаны.
> Версия приложения: **${pkg.version}**

## Сводка

| Раздел | Количество |
|---|---|
| Тем грамматики | ${grammar.length} |
| Упражнений | ${grammarExercises} |
| Уровней аудирования | ${listening.length} |
| Уроков аудирования | ${lessons.length} |
| Вопросов к аудированию | ${questions} |
| Наборов слов | ${vocabulary.length} |
| Слов | ${words} |

## Грамматика

| ID | Тема | Уровень | Минут | Упражнений |
|---|---|---|---|---|
${grammar.map(t => `| \`${t.id}\` | ${esc(t.title)} | ${t.level} | ${t.estMinutes} | ${t.content.exercises.length} |`).join('\n')}

## Аудирование

| ID | Урок | Уровень | Длительность | Вопросов |
|---|---|---|---|---|
${lessons.map(l => `| \`${l.id}\` | ${esc(l.title)} | ${esc(l.level)} | ${l.duration} | ${l.questions.length} |`).join('\n')}

## Словарь

| ID | Набор | Уровень | Слов |
|---|---|---|---|
${vocabulary.map(s => `| \`${s.id}\` | ${esc(s.title)} | ${s.level} | ${s.words.length} |`).join('\n')}

## Контрольные суммы данных

| Файл | SHA-256 (16) |
|---|---|
| \`src/data/grammar.js\` | \`${sha256('src/data/grammar.js')}\` |
| \`src/data/listening.js\` | \`${sha256('src/data/listening.js')}\` |
| \`src/data/vocabulary.js\` | \`${sha256('src/data/vocabulary.js')}\` |

## Как добавить контент

См. [CONTENT_GUIDE.md](./CONTENT_GUIDE.md). После правки данных выполните:

\`\`\`bash
npm run docs:generate
npm test
\`\`\`
`;

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'CONTENT_INDEX.md'), md);
console.log('✓ docs/CONTENT_INDEX.md');

// ---------- README stats ----------
const statsBlock = `<!-- CONTENT_STATS:START -->
| Грамматика | Аудирование | Словарь | Версия |
|---|---|---|---|
| ${grammar.length} тем / ${grammarExercises} упражнений | ${lessons.length} уроков / ${questions} вопросов | ${words} слов | v${pkg.version} |
<!-- CONTENT_STATS:END -->`;

const readmePath = path.join(ROOT, 'README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  if (readme.includes('<!-- CONTENT_STATS:START -->') && readme.includes('<!-- CONTENT_STATS:END -->')) {
    readme = readme.replace(/<!-- CONTENT_STATS:START -->[\s\S]*?<!-- CONTENT_STATS:END -->/, statsBlock);
    fs.writeFileSync(readmePath, readme);
    console.log('✓ README.md (блок статистики)');
  } else {
    console.log('• README.md: маркеры CONTENT_STATS не найдены, статистика не обновлена');
  }
}
