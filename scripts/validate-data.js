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
const course = load('src/data/course.js');

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

// ---------- Course ----------
const topicIds = new Set((grammar || []).map((t) => t.id));
const lessonIds = new Set((listening || []).flatMap((l) => (l.lessons || []).map((x) => x.id)));
const setIds = new Set((vocab || []).map((s) => s.id));

if (!course) {
  fail('course.js: не загрузился');
} else {
  const units = course.COURSE_UNITS || [];
  const achievements = course.ACHIEVEMENTS || [];
  const shop = course.SHOP_ITEMS || [];
  if (!units.length) fail('course.js: нет разделов');

  const stepIds = new Set();
  const types = ['grammar', 'listening', 'vocab', 'practice', 'chest', 'trophy'];
  const usedTopics = new Set();
  const usedLessons = new Set();
  const usedSets = new Set();
  let stepCount = 0;

  units.forEach((unit, ui) => {
    const at = `course.unit[${ui}] (${unit && unit.id})`;
    if (!unit.id) fail(`${at}: нет id`);
    if (!unit.title) fail(`${at}: нет title`);
    if (!unit.color) fail(`${at}: нет color`);
    if (!Array.isArray(unit.steps) || unit.steps.length < 4) fail(`${at}: мало шагов`);
    if (!(unit.steps || []).some((s) => s.type === 'practice')) warn(`${at}: нет практики`);

    (unit.steps || []).forEach((step, si) => {
      stepCount++;
      const sat = `${at}.step[${si}] (${step && step.id})`;
      if (!step.id) return fail(`${sat}: нет id`);
      if (stepIds.has(step.id)) fail(`${sat}: дублирующийся id шага`);
      stepIds.add(step.id);
      if (!types.includes(step.type)) fail(`${sat}: неизвестный тип ${step.type}`);
      if (!step.title) fail(`${sat}: нет title`);
      if (!step.icon) fail(`${sat}: нет icon`);

      if (step.type === 'grammar') {
        if (!topicIds.has(step.ref)) fail(`${sat}: нет темы ${step.ref}`);
        else usedTopics.add(step.ref);
      }
      if (step.type === 'listening') {
        if (!lessonIds.has(step.ref)) fail(`${sat}: нет урока ${step.ref}`);
        else usedLessons.add(step.ref);
      }
      if (step.type === 'vocab') {
        if (!setIds.has(step.ref)) fail(`${sat}: нет набора ${step.ref}`);
        else usedSets.add(step.ref);
      }
    });
  });

  if (grammar) {
    grammar.forEach((t) => {
      if (!usedTopics.has(t.id)) warn(`тема ${t.id} не входит в путь обучения`);
    });
  }
  if (listening) {
    listening.forEach((lvl) => (lvl.lessons || []).forEach((l) => {
      if (!usedLessons.has(l.id)) warn(`урок ${l.id} не входит в путь обучения`);
    }));
  }
  if (vocab) {
    vocab.forEach((s) => {
      if (!usedSets.has(s.id)) warn(`набор ${s.id} не входит в путь обучения`);
    });
  }

  if (achievements.length < 8) fail('course.js: мало достижений');
  achievements.forEach((a, i) => {
    if (!a.id || !a.title || !a.desc) fail(`achievements[${i}]: неполное описание`);
    if (typeof a.check !== 'function') fail(`achievements[${i}]: нет функции check`);
  });

  if (shop.length < 3) fail('course.js: мало товаров магазина');
  shop.forEach((item, i) => {
    if (!item.id || !item.title) fail(`shop[${i}]: неполное описание`);
    if (!(Number(item.price) > 0)) fail(`shop[${i}]: некорректная цена`);
  });

  console.log(`  course: ${units.length} разделов, ${stepCount} шагов, ${achievements.length} достижений`);
}

// ---------- Required files ----------
const required = [
  'src/main.js', 'src/preload.js', 'src/renderer/index.html',
  'src/renderer/app.js', 'src/renderer/core.js', 'src/renderer/lesson.js',
  'src/renderer/styles.css', 'src/data/course.js',
  'electron-builder.yml', 'README.md',
  'docs/CHANGELOG.md', 'docs/AGENTS.md', 'docs/ARCHITECTURE.md',
  'docs/CONTENT_INDEX.md', 'docs/USER_GUIDE.md'
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
