const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const grammar = require(path.join(ROOT, 'src/data/grammar.js'));
const listening = require(path.join(ROOT, 'src/data/listening.js'));
const vocabulary = require(path.join(ROOT, 'src/data/vocabulary.js'));

test('грамматика: не менее 8 тем, уникальные id', () => {
  assert.ok(grammar.length >= 8, `ожидалось ≥8 тем, получено ${grammar.length}`);
  const ids = grammar.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'id тем должны быть уникальны');
});

test('грамматика: у каждой темы есть объяснение, примеры и 3+ упражнения', () => {
  for (const topic of grammar) {
    assert.ok(topic.content.rule.length > 400, `${topic.id}: объяснение слишком короткое`);
    assert.ok(topic.content.examples.length >= 3, `${topic.id}: мало примеров`);
    assert.ok(topic.content.exercises.length >= 3, `${topic.id}: мало упражнений`);
    assert.ok(topic.content.pitfalls, `${topic.id}: нет блока «частая ошибка»`);
  }
});

test('грамматика: корректные ответы и варианты', () => {
  for (const topic of grammar) {
    topic.content.exercises.forEach((ex, i) => {
      assert.ok(ex.options.length >= 2, `${topic.id}#${i}: мало вариантов`);
      assert.ok(Number.isInteger(ex.answer), `${topic.id}#${i}: answer не число`);
      assert.ok(ex.answer >= 0 && ex.answer < ex.options.length, `${topic.id}#${i}: answer вне диапазона`);
      assert.equal(new Set(ex.options).size, ex.options.length, `${topic.id}#${i}: повторяющиеся варианты`);
    });
  }
});

test('грамматика: нет исполняемых тегов в HTML-контенте', () => {
  for (const topic of grammar) {
    const html = topic.content.rule + (topic.content.pitfalls || '');
    assert.ok(!/<script/i.test(html), `${topic.id}: <script> запрещён`);
    assert.ok(!/onerror=/i.test(html), `${topic.id}: обработчики событий запрещены`);
  }
});

test('аудирование: уникальные id, тексты достаточной длины', () => {
  const lessonIds = [];
  for (const level of listening) {
    assert.ok(level.lessons.length >= 1, `${level.id}: нет уроков`);
    for (const lesson of level.lessons) {
      lessonIds.push(lesson.id);
      assert.ok(lesson.textEn.length >= 150, `${lesson.id}: текст короче 150 символов`);
      assert.ok(lesson.textRu.length >= 40, `${lesson.id}: перевод слишком короткий`);
      assert.ok(lesson.questions.length >= 2, `${lesson.id}: нужно 2+ вопроса`);
      lesson.questions.forEach((q, i) => {
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${lesson.id}#${i}: answer вне диапазона`);
      });
    }
  }
  assert.equal(new Set(lessonIds).size, lessonIds.length, 'id уроков должны быть уникальны');
});

test('словарь: слова и переводы заполнены, нет дублей внутри набора', () => {
  assert.ok(vocabulary.length >= 3, 'нужно минимум 3 набора слов');
  for (const set of vocabulary) {
    const words = set.words.map(w => w.en.toLowerCase());
    assert.equal(new Set(words).size, words.length, `${set.id}: дубли слов`);
    set.words.forEach(w => {
      assert.ok(w.en && w.ru && w.ex, `${set.id}: неполная карточка ${JSON.stringify(w)}`);
    });
  }
});

test('данные содержат ожидаемые базовые темы', () => {
  const ids = grammar.map(t => t.id);
  ['present-simple', 'present-continuous', 'past-simple', 'articles'].forEach(id => {
    assert.ok(ids.includes(id), `отсутствует тема ${id}`);
  });
});
