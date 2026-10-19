# Как добавить учебный контент

Весь контент лежит в `src/data/*.js` как обычные JS-объекты. После правки обязательно выполните:

```bash
npm test
npm run docs:generate
```

## 1. Новая тема грамматики

Добавьте объект в массив `GRAMMAR_TOPICS` в `src/data/grammar.js`:

```js
{
  id: 'present-perfect',              // уникальный, kebab-case
  title: 'Present Perfect',
  level: 'B1',
  icon: '✅',
  estMinutes: 40,
  summary: 'Опыт к настоящему моменту: have/has + V3.',
  content: {
    rule: `<p><b>Формула:</b> <code>have/has + V3</code></p>
           <p>Используем для результата и опыта. Маркеры: ever, never, just, already, yet, since, for.</p>`,
    examples: [
      { en: 'I have visited London twice.', ru: 'Я был в Лондоне дважды.' },
      { en: 'She has just finished.', ru: 'Она только что закончила.' },
      { en: 'Have you ever tried sushi?', ru: 'Ты когда-нибудь пробовал суши?' }
    ],
    table: {
      headers: ['Форма', 'Пример'],
      rows: [['Утверждение', 'I have worked'], ['Отрицание', "I haven't worked"], ['Вопрос', 'Have you worked?']]
    },
    pitfalls: 'Не путайте с Past Simple: конкретное время в прошлом → Past Simple (I saw him yesterday).',
    exercises: [
      { q: 'I ___ (never / be) to Japan.', options: ['never was', 'have never been', 'has never been'], answer: 1, explain: 'Опыт → have + V3, never перед глаголом.' },
      { q: 'She ___ (just / finish) her homework.', options: ['just finished', 'has just finished', 'have just finished'], answer: 1, explain: 'She → has, just после have/has.' },
      { q: '___ you ever ___ (eat) Thai food?', options: ['Did / eat', 'Have / eaten', 'Has / ate'], answer: 1, explain: 'Have you ever eaten…?' }
    ]
  }
}
```

Требования (проверяются тестами):

- `id` уникален;
- `content.rule` — HTML без `<script>` и inline-обработчиков, не короче 400 символов;
- ≥ 3 примера с `en` и `ru`;
- ≥ 3 упражнения, `answer` — индекс правильного варианта, `explain` обязателен;
- `estMinutes` — положительное число.

## 2. Новый урок аудирования

В `src/data/listening.js` добавьте урок в `lessons` нужного уровня:

```js
{
  id: 'e4-airport',                 // уникален среди всех уровней
  title: 'В аэропорту',
  duration: '2:20',
  difficulty: '★★☆',
  textEn: `Good morning. May I see your passport, please? ...`,  // ≥ 150 символов
  textRu: 'Доброе утро. Покажите паспорт, пожалуйста…',
  questions: [
    { q: 'What does the officer ask for?', options: ['Ticket', 'Passport', 'Luggage'], answer: 1 }
  ],
  scriptTips: 'May I see…?, gate, boarding pass'
}
```

Советы по качеству:

- 6–12 предложений, естественные паузы, без сложной лексики выше заявленного уровня;
- вопросы — на понимание фактов, а не на перевод;
- `scriptTips` — 2–4 ключевые фразы урока;
- текст озвучивается системным голосом Windows, поэтому избегайте неоднозначных сокращений (`St.`, `Dr.`) без расшифровки.

## 3. Новые слова

В `src/data/vocabulary.js`:

```js
{
  en: 'commute',
  ru: 'ездить на работу',
  ipa: '[kəˈmjuːt]',
  ex: 'I commute by bike every day.'
}
```

`en` уникален внутри набора. Наборы участвуют в тренажёре слов, поэтому нужны минимум 4 разных перевода в пуле.

## 4. Новый шаг на пути

Учебный материал попадает в игру только если на него ссылается шаг в `src/data/course.js`:

```js
{
  id: 's3-listening-doctor',          // уникальный id шага
  type: 'listening',                   // grammar | listening | vocab | practice | chest | trophy
  ref: 'b4-doctor',                    // id темы/урока/набора из соответствующего файла
  title: 'У врача',                    // подпись под кружком
  icon: '🩺'                           // эмодзи на узле
}
```

Правила:

- порядок шагов в массиве = порядок прохождения; шаг открывается после предыдущего;
- `id` шага уникален среди всех разделов;
- `ref` обязателен для `grammar`, `listening`, `vocab`; для `practice/chest/trophy` не нужен;
- в каждом разделе должна быть хотя бы одна `practice`;
- тесты `npm test` проверяют, что каждый материал из `grammar.js`, `listening.js`, `vocabulary.js` присутствует на пути (иначе контент недоступен игроку).

Ветку с наградой (`chest`, `trophy`) можно ставить в конец раздела — она выдаёт самоцветы и не содержит вопросов.

## 5. После правки

```bash
npm test                  # инварианты, курс и UI
npm run docs:generate     # обновит CONTENT_INDEX.md и статистику README
git add src/data docs/CONTENT_INDEX.md README.md
git commit -m "feat(grammar): добавить Present Perfect"
```

Коммит с типом `feat` приведёт к автоматическому minor-релизу после пуша в `main`.
