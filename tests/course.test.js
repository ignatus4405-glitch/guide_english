const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { COURSE_UNITS, ACHIEVEMENTS, SHOP_ITEMS } = require(path.join(ROOT, 'src/data/course.js'));
const grammar = require(path.join(ROOT, 'src/data/grammar.js'));
const listening = require(path.join(ROOT, 'src/data/listening.js'));
const vocabulary = require(path.join(ROOT, 'src/data/vocabulary.js'));

const topicIds = new Set(grammar.map((t) => t.id));
const lessonIds = new Set(listening.flatMap((l) => l.lessons.map((x) => x.id)));
const setIds = new Set(vocabulary.map((s) => s.id));

const allSteps = COURSE_UNITS.flatMap((u) => u.steps);

test('курс: разделы и шаги корректны', () => {
  assert.ok(COURSE_UNITS.length >= 5, 'нужно минимум 5 разделов');
  const unitIds = COURSE_UNITS.map((u) => u.id);
  assert.equal(new Set(unitIds).size, unitIds.length, 'id разделов должны быть уникальны');

  const allowedColors = ['green', 'blue', 'purple', 'orange', 'red'];
  for (const unit of COURSE_UNITS) {
    assert.ok(unit.title && unit.subtitle, `${unit.id}: нужны title и subtitle`);
    assert.ok(allowedColors.includes(unit.color), `${unit.id}: неизвестный цвет ${unit.color}`);
    assert.ok(unit.steps.length >= 4, `${unit.id}: слишком мало шагов`);
  }
});

test('курс: id шагов уникальны и типы допустимы', () => {
  const ids = allSteps.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'id шагов должны быть уникальны');
  const allowed = ['grammar', 'listening', 'vocab', 'practice', 'chest', 'trophy'];
  for (const step of allSteps) {
    assert.ok(allowed.includes(step.type), `${step.id}: неизвестный тип ${step.type}`);
    assert.ok(step.title, `${step.id}: нет title`);
    assert.ok(step.icon, `${step.id}: нет icon`);
  }
});

test('курс: все ссылки на контент существуют', () => {
  for (const step of allSteps) {
    if (step.type === 'grammar') assert.ok(topicIds.has(step.ref), `${step.id}: нет темы ${step.ref}`);
    if (step.type === 'listening') assert.ok(lessonIds.has(step.ref), `${step.id}: нет урока ${step.ref}`);
    if (step.type === 'vocab') assert.ok(setIds.has(step.ref), `${step.id}: нет набора ${step.ref}`);
  }
});

test('курс: каждый учебный материал доступен на пути', () => {
  const usedTopics = new Set(allSteps.filter((s) => s.type === 'grammar').map((s) => s.ref));
  const usedLessons = new Set(allSteps.filter((s) => s.type === 'listening').map((s) => s.ref));
  const usedSets = new Set(allSteps.filter((s) => s.type === 'vocab').map((s) => s.ref));

  for (const id of topicIds) assert.ok(usedTopics.has(id), `тема ${id} не встречается в пути`);
  for (const id of lessonIds) assert.ok(usedLessons.has(id), `урок ${id} не встречается в пути`);
  for (const id of setIds) assert.ok(usedSets.has(id), `набор слов ${id} не встречается в пути`);
});

test('курс: в каждом разделе есть практика', () => {
  for (const unit of COURSE_UNITS) {
    assert.ok(unit.steps.some((s) => s.type === 'practice'), `${unit.id}: нет практики`);
  }
});

test('достижения и магазин описаны полностью', () => {
  assert.ok(ACHIEVEMENTS.length >= 10, 'мало достижений');
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'id достижений уникальны');
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.icon && a.title && a.desc, `${a.id}: неполное описание`);
    assert.equal(typeof a.check, 'function', `${a.id}: нет функции проверки`);
  }

  assert.ok(SHOP_ITEMS.length >= 3, 'мало товаров');
  for (const item of SHOP_ITEMS) {
    assert.ok(item.icon && item.title && item.desc, `${item.id}: неполное описание`);
    assert.ok(Number.isFinite(item.price) && item.price > 0, `${item.id}: некорректная цена`);
  }
});
