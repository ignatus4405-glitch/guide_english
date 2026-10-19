/**
 * Учебный путь в стиле Duolingo.
 *
 * Курс состоит из разделов (units), раздел — из шагов (steps).
 * Шаг ссылается на существующий контент:
 *   grammar   → ref = id темы из grammar.js
 *   listening → ref = id урока из listening.js
 *   vocab     → ref = id набора из vocabulary.js
 *   practice  → смешанная тренировка (ref не нужен)
 *   chest     → сундук с самоцветами, проходится мгновенно
 *   trophy    → финал раздела, награда и поздравление
 *
 * Порядок шагов = порядок прохождения. Шаг открыт, если предыдущий завершён.
 */

const COURSE_UNITS = [
  {
    id: 'unit-1',
    title: 'Первые шаги',
    subtitle: 'Алфавит, артикли и знакомство',
    color: 'green',
    icon: '🌱',
    steps: [
      { id: 's1-alphabet', type: 'grammar', ref: 'alphabet-pronunciation', title: 'Алфавит и чтение', icon: '🔤' },
      { id: 's1-articles', type: 'grammar', ref: 'articles', title: 'Артикли', icon: '📝' },
      { id: 's1-listen-intro', type: 'listening', ref: 'b1-introductions', title: 'Знакомство', icon: '🎧' },
      { id: 's1-vocab-100', type: 'vocab', ref: 'everyday-100', title: '100 частых слов', icon: '💬' },
      { id: 's1-practice', type: 'practice', title: 'Тренировка', icon: '🧩' },
      { id: 's1-trophy', type: 'trophy', title: 'Раздел пройден', icon: '🏆' }
    ]
  },
  {
    id: 'unit-2',
    title: 'Настоящее время',
    subtitle: 'Что происходит сейчас и обычно',
    color: 'blue',
    icon: '🌊',
    steps: [
      { id: 's2-present-simple', type: 'grammar', ref: 'present-simple', title: 'Present Simple', icon: '🕒' },
      { id: 's2-present-continuous', type: 'grammar', ref: 'present-continuous', title: 'Present Continuous', icon: '⏳' },
      { id: 's2-listen-cafe', type: 'listening', ref: 'b2-cafe', title: 'В кафе', icon: '☕' },
      { id: 's2-comparatives', type: 'grammar', ref: 'comparatives', title: 'Степени сравнения', icon: '📊' },
      { id: 's2-chest', type: 'chest', title: 'Сундук', icon: '🎁' },
      { id: 's2-practice', type: 'practice', title: 'Тренировка', icon: '🧩' }
    ]
  },
  {
    id: 'unit-3',
    title: 'Прошлое и будущее',
    subtitle: 'Рассказываем о событиях',
    color: 'purple',
    icon: '🕰️',
    steps: [
      { id: 's3-past-simple', type: 'grammar', ref: 'past-simple', title: 'Past Simple', icon: '📅' },
      { id: 's3-future', type: 'grammar', ref: 'future-forms', title: 'Будущее', icon: '🔮' },
      { id: 's3-listen-hotel', type: 'listening', ref: 'b3-hotel', title: 'Отель', icon: '🏨' },
      { id: 's3-present-perfect', type: 'grammar', ref: 'present-perfect', title: 'Present Perfect', icon: '✅' },
      { id: 's3-practice', type: 'practice', title: 'Тренировка', icon: '🧩' },
      { id: 's3-trophy', type: 'trophy', title: 'Раздел пройден', icon: '🏆' }
    ]
  },
  {
    id: 'unit-4',
    title: 'Общение и покупки',
    subtitle: 'Вежливые просьбы и повседневные ситуации',
    color: 'orange',
    icon: '🛍️',
    steps: [
      { id: 's4-modals', type: 'grammar', ref: 'modals', title: 'Модальные глаголы', icon: '💡' },
      { id: 's4-listen-shopping', type: 'listening', ref: 'e1-shopping', title: 'Покупки', icon: '👕' },
      { id: 's4-listen-directions', type: 'listening', ref: 'e2-directions', title: 'Как пройти', icon: '🗺️' },
      { id: 's4-vocab-travel', type: 'vocab', ref: 'travel', title: 'Путешествия', icon: '✈️' },
      { id: 's4-chest', type: 'chest', title: 'Сундук', icon: '🎁' },
      { id: 's4-practice', type: 'practice', title: 'Тренировка', icon: '🧩' }
    ]
  },
  {
    id: 'unit-5',
    title: 'Уверенный уровень',
    subtitle: 'Сложные темы, истории и мнения',
    color: 'red',
    icon: '🚀',
    steps: [
      { id: 's5-conditionals', type: 'grammar', ref: 'conditionals', title: 'Условные предложения', icon: '🔀' },
      { id: 's5-listen-job', type: 'listening', ref: 'e3-job', title: 'Собеседование', icon: '💼' },
      { id: 's5-listen-travel', type: 'listening', ref: 'i1-travel', title: 'Шотландия', icon: '🏴' },
      { id: 's5-listen-news', type: 'listening', ref: 'i2-news', title: 'Новости', icon: '📰' },
      { id: 's5-listen-opinion', type: 'listening', ref: 'i3-opinion', title: 'Соцсети', icon: '💭' },
      { id: 's5-vocab-business', type: 'vocab', ref: 'business', title: 'Работа', icon: '💼' },
      { id: 's5-practice', type: 'practice', title: 'Финал', icon: '🧩' },
      { id: 's5-trophy', type: 'trophy', title: 'Курс пройден', icon: '🏆' }
    ]
  }
];

/** Достижения (вычисляются из состояния, не хранятся отдельно). */
const ACHIEVEMENTS = [
  { id: 'first-step', icon: '👣', title: 'Первый шаг', desc: 'Пройдите первый урок', check: (s) => s.lessonsDone >= 1 },
  { id: 'five-lessons', icon: '⭐', title: 'Пятёрка', desc: 'Пройдите 5 уроков', check: (s) => s.lessonsDone >= 5 },
  { id: 'ten-lessons', icon: '🌟', title: 'Десятка', desc: 'Пройдите 10 уроков', check: (s) => s.lessonsDone >= 10 },
  { id: 'perfect', icon: '💯', title: 'Перфекционист', desc: 'Завершите урок без ошибок', check: (s) => s.perfectLessons >= 1 },
  { id: 'streak-3', icon: '🔥', title: 'Три дня подряд', desc: 'Серия 3 дня', check: (s) => s.streak >= 3 },
  { id: 'streak-7', icon: '☄️', title: 'Неделя силы', desc: 'Серия 7 дней', check: (s) => s.streak >= 7 },
  { id: 'words-20', icon: '🃏', title: 'Словарный запас', desc: '20 слов отмечено как «знаю»', check: (s) => s.wordsKnown >= 20 },
  { id: 'listener-5', icon: '🎧', title: 'Слушатель', desc: 'Пройдите 5 уроков аудирования', check: (s) => s.listeningDone >= 5 },
  { id: 'gems-300', icon: '💎', title: 'Копилка', desc: 'Накопите 300 самоцветов', check: (s) => s.gems >= 300 },
  { id: 'level-5', icon: '🎖️', title: 'Уровень 5', desc: 'Достигните 5 уровня', check: (s) => s.level >= 5 },
  { id: 'half-course', icon: '🗺️', title: 'Половина пути', desc: 'Пройдите половину уроков курса', check: (s) => s.progressRatio >= 0.5 },
  { id: 'course-done', icon: '🏆', title: 'Выпускник', desc: 'Пройдите все уроки курса', check: (s) => s.progressRatio >= 1 }
];

/** Товары магазина. */
const SHOP_ITEMS = [
  {
    id: 'refill-hearts',
    icon: '❤️',
    title: 'Полный запас сердец',
    desc: 'Мгновенно восстановить все 5 сердец',
    price: 50,
    type: 'hearts'
  },
  {
    id: 'double-xp',
    icon: '⚡',
    title: 'Двойной XP на 15 минут',
    desc: 'Следующие уроки приносят в 2 раза больше опыта',
    price: 100,
    type: 'boost'
  },
  {
    id: 'streak-shield',
    icon: '🛡️',
    title: 'Заморозка серии',
    desc: 'Один пропущенный день не сбросит серию',
    price: 150,
    type: 'shield'
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COURSE_UNITS, ACHIEVEMENTS, SHOP_ITEMS };
}
if (typeof window !== 'undefined') {
  window.COURSE_UNITS = COURSE_UNITS;
  window.ACHIEVEMENTS = ACHIEVEMENTS;
  window.SHOP_ITEMS = SHOP_ITEMS;
}
