#!/usr/bin/env node
/**
 * Валидация учебного контента и конфигурации.
 * Запускается в CI перед сборкой. Любая ошибка → exit code 1.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function load(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(`Файл не найден: ${rel}`); return null; }
  try {
    delete require.cache[require.resolve(p)];
    return require(p);
  } catch (e) {
    fail(`Ошибка загрузки ${rel}: ${e.message}`);
    return null;
  }
}

const grammar = load('src/data/grammar.js');
const listening = load('src/data/listening.js');
const vocab = load('src/data/vocabulary.js');

// ---------- package.json ----------
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) fail(`package.json: некорректная версия "${pkg.version}"`);
if (!pkg.main) fail('package.json: отсутствует "main"');
['electron', 'electron-builder'].forEach(d => {
  if (!pkg.devDependencies || !pkg.devDependencies[d]) warn(`package.json: нет devDependency ${d}`);
});

// ---------- Grammar ----------
if (!Array.isArray(grammar)) fail('grammar.js: должен экспортировать массив');
else {
  const ids = new Set();
  grammar.forEach((t, i) => {
    const at = `grammar[${i}] (${t && t.id})`;
    if (!t.id) fail(`${at}: нет id`);
    else if (ids.has(t.id)) fail(`${at}: дублирующийся id`);
    else ids.add(t.id);

    ['title', 'level', 'summary', 'icon'].forEach(k => {
      if (!t[k]) fail(`${at}: нет поля ${k}`);
    });
    if (!t.content || !t.content.rule) fail(`${at}: нет content.rule`);
    else if (t.content.rule.length < 100) warn(`${at}: слишком короткое объяснение`);

    if (!t.content.examples || !t.content.examples.length) fail(`${at}: нет примеров`);
    else t.content.examples.forEach((ex, j) => {
      if (!ex.en || !ex.ru) fail(`${at}: пример ${j} должен содержать en и ru`);
    });

    if (t.content.table) {
      if (!Array.isArray(t.content.table.headers) || !Array.isArray(t.content.table.rows)) {
        fail(`${at}: некорректная таблица`);
      } else {
        t.content.table.rows.forEach((row, r) => {
          if (row.length !== t.content.table.headers.length) {
            fail(`${at}: строка таблицы ${r} имеет ${row.length} ячеек, ожидается ${t.content.table.headers.length}`);
          }
        });
      }
    }

    if (!t.content.exercises || t.content.exercises.length < 3) {
      fail(`${at}: нужно минимум 3 упражнения`);
    } else {
      t.content.exercises.forEach((ex, j) => {
        if (!ex.q) fail(`${at}: упражнение ${j} без вопроса`);
        if (!Array.isArray(ex.options) || ex.options.length < 2) fail(`${at}: упражнение ${j}: нужно минимум 2 варианта`);
        if (typeof ex.answer !== 'number' || ex.answer < 0 || ex.answer >= (ex.options || []).length) {
          fail(`${at}: упражнение ${j}: некорректный answer`);
        }
        if (!ex.explain) fail(`${at}: упражнение ${j}: нет explain`);
      });
    }
    if (typeof t.estMinutes !== 'number' || t.estMinutes <= 0) fail(`${at}: некорректный estMinutes`);
  });
  console.log(`  grammar: ${grammar.length} тем, ${grammar.reduce((n, t) => n + (t.content.exercises?.length || 0), 0)} упражнений`);
}

// ---------- Listening ----------
if (!Array.isArray(listening)) fail('listening.js: должен экспортировать массив');
else {
  const levelIds = new Set();
  const lessonIds = new Set();
  let lessonCount = 0, questionCount = 0;
  listening.forEach((lvl, i) => {
    const at = `listening[${i}] (${lvl && lvl.id})`;
    if (!lvl.id) fail(`${at}: нет id`);
    else if (levelIds.has(lvl.id)) fail(`${at}: дублирующийся id уровня`);
    else levelIds.add(lvl.id);
    if (!lvl.title) fail(`${at}: нет title`);
    if (!Array.isArray(lvl.lessons) || !lvl.lessons.length) fail(`${at}: нет уроков`);

    (lvl.lessons || []).forEach((l, j) => {
      lessonCount++;
      const lat = `${at}.lesson[${j}] (${l.id})`;
      if (!l.id) fail(`${lat}: нет id`);
      else if (lessonIds.has(l.id)) fail(`${lat}: дублирующийся id урока`);
      else lessonIds.add(l.id);

      if (!l.title) fail(`${lat}: нет title`);
      if (!l.textEn || l.textEn.length < 80) fail(`${lat}: слишком короткий текст для аудирования`);
      if (!l.textRu) fail(`${lat}: нет перевода textRu`);
      if (!l.duration) fail(`${lat}: нет duration`);
      if (!l.difficulty) fail(`${lat}: нет difficulty`);
      if (!l.scriptTips) fail(`${lat}: нет scriptTips`);

      if (!Array.isArray(l.questions) || l.questions.length < 2) {
        fail(`${lat}: нужно минимум 2 вопроса`);
      } else {
        l.questions.forEach((q, qi) => {
          questionCount++;
          if (!q.q) fail(`${lat}: вопрос ${qi} без текста`);
          if (!Array.isArray(q.options) || q.options.length < 2) fail(`${lat}: вопрос ${qi}: мало вариантов`);
          if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= (q.options || []).length) {
            fail(`${lat}: вопрос ${qi}: некорректный answer`);
          }
        });
      }
    });
  });
  console.log(`  listening: ${listening.length} уровня, ${lessonCount} уроков, ${questionCount} вопросов`);
}

// ---------- Vocabulary ----------
if (!Array.isArray(vocab)) fail('vocabulary.js: должен экспортировать массив');
else {
  const ids = new Set();
  let words = 0;
  vocab.forEach((set, i) => {
    const at = `vocabulary[${i}] (${set && set.id})`;
    if (!set.id) fail(`${at}: нет id`);
    else if (ids.has(set.id)) fail(`${at}: дублирующийся id`);
    else ids.add(set.id);
    if (!set.title) fail(`${at}: нет title`);
    if (!Array.isArray(set.words) || !set.words.length) fail(`${at}: нет слов`);
    (set.words || []).forEach((w, j) => {
      words++;
      if (!w.en) fail(`${at}: слово ${j} без en`);
      if (!w.ru) fail(`${at}: слово ${j} без перевода`);
      if (!w.ex) fail(`${at}: слово ${j} без примера`);
    });
  });
  console.log(`  vocabulary: ${vocab.length} наборов, ${words} слов`);
}

// ---------- Required files ----------
const required = [
  'src/main.js', 'src/preload.js', 'src/renderer/index.html',
  'src/renderer/app.js', 'src/renderer/styles.css',
  'electron-builder.yml', 'README.md',
  'docs/CHANGELOG.md', 'docs/AGENTS.md', 'docs/ARCHITECTURE.md'
];
required.forEach(f => { if (!fs.existsSync(path.join(ROOT, f))) fail(`Отсутствует обязательный файл: ${f}`); });

const iconIco = path.join(ROOT, 'resources', 'icon.ico');
if (!fs.existsSync(iconIco)) fail('Отсутствует resources/icon.ico (запустите npm run icon)');
else if (fs.statSync(iconIco).size < 1000) fail('resources/icon.ico подозрительно мал');

// ---------- Report ----------
if (warnings.length) {
  console.log('\n⚠ Предупреждения:');
  warnings.forEach(w => console.log('  • ' + w));
}
if (errors.length) {
  console.error('\n✗ Ошибки валидации:');
  errors.forEach(e => console.error('  • ' + e));
  process.exit(1);
}
console.log('\n✓ Валидация данных пройдена');
