# Архитектура Guide English

Документ описывает устройство приложения и точку входа для изменений. Обновляйте его при изменении структуры.

## Общая схема

```
┌──────────────────────────── Electron (main process) ────────────────────────────┐
│  src/main.js                                                                     │
│   • BrowserWindow (contextIsolation: true, nodeIntegration: false)               │
│   • AppUserModelID com.guideenglish.app для уведомлений Windows                  │
│   • IPC: версия, store, диалоги, ссылки, updater                                  │
│   • electron-updater: проверка через 5 с после старта и каждые 4 часа             │
│   • события updater → webContents.send('updater:*')                              │
│   • меню: «Проверить обновления», GitHub Releases, «О программе»                 │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ preload.js → window.guideEnglish
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│  Renderer (src/renderer)                                                        │
│   index.html — оболочка: сайдбар, топбар, #view, #lesson-root, #modal-root       │
│   core.js    — состояние, хранилище, TTS, звуки, сердца, XP, серия, достижения   │
│   lesson.js  — движок урока: правило → вопросы → проверка → результат            │
│   app.js     — экраны и роутер: путь, практика, справочник, словарь, профиль,    │
│                магазин, настройки, поиск, UI автообновлений                      │
│   styles.css — дизайн-система в стиле Duolingo + тёмная тема                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Ключевые решения

| Решение | Причина |
|---|---|
| Нет React/сборщика | Статичный контент и небольшая логика; меньше зависимостей, быстрые CI и правки агентами. |
| Данные в `src/data/*.js` | Один файл работает как CommonJS-модуль (тесты, docs) и как глобальный объект (`window.GRAMMAR_TOPICS`) для рендерера. |
| `course.js` как отдельный слой | Путь, достижения и магазин отделены от учебного контента: шаги ссылаются на темы/уроки/наборы по `ref`. |
| `core.js` / `lesson.js` / `app.js` | Чёткое разделение: состояние и правила игры → прохождение урока → экраны. |
| `contextIsolation: true`, `nodeIntegration: false` | Безопасность: рендерер не имеет Node, только явное API из `preload.js`. |
| `electron-store` | Прогресс переживает перезапуск и обновления; файл в `%APPDATA%/Guide English/guide-english-store.json`. |
| Web Speech API | Озвучка без ключей и интернета, голоса Windows (SAPI). |
| Web Audio API | Короткие звуки правильных/неправильных ответов генерируются осцилляторами — не нужны аудиофайлы. |
| `electron-updater` + GitHub | Бесплатные релизы, `latest.yml` создаёт electron-builder, клиент обновляется без сервера. |
| NSIS + portable | Установщик для обычных пользователей, portable — без прав администратора. |

## Модель состояния

Всё игровое состояние хранится под одним ключом `game` (атомарно и просто мигрировать):

```js
state.game = {
  completedNodes: ['s1-alphabet', 's1-articles'],  // id шагов пути
  xp: 120,
  gems: 250,
  hearts: { count: 4, updatedAt: 1729360000000 },  // 1 сердце / 30 минут
  streak: { count: 3, last: '2026-10-19' },
  shield: 0,                                       // заморозки серии (макс. 2)
  boostUntil: 0,                                   // двойной XP до timestamp
  daily: { date: '2026-10-19', xp: 30 },           // дневная цель
  perfectLessons: 2,
  mistakes: [{ prompt, options, answer, explain, source }],  // до 30 вопросов для «Работы над ошибками»
  activeDays: ['2026-10-17', '2026-10-19'],        // дни с занятиями, последние 60 — для недели в профиле
  legacyLessons: []
};
state.vocabKnown = { everyday-100: ['time', 'work'] };  // ключ — набор, значения — слова
state.progress = { ... };                               // старый формат, только для миграции
state.settings = { voice, rate, volume, theme, sound, dailyGoal };
```

Дополнительно сохраняются ключи `progress`, `completedLessons`, `vocabularyProgress` — их использует миграция прогресса из версии 0.2.x.

### Производные величины (не хранятся)

- `level = 1 + floor(xp / 100)`, прогресс уровня — `xp % 100`.
- Пройденные уроки и прогресс курса — по `completedNodes` и `STEPS` (`courseProgress()`).
- Достижения — функции `check(stats)` из `course.js` (`unlockedAchievements()`).
- Заблокированность шага: шаг открыт, если предыдущий шаг в `STEPS` пройден (`isNodeUnlocked`).
- Дневная цель сбрасывается при смене локальной даты (`resetDailyIfNeeded`).

## Учебный путь

`src/data/course.js` содержит `COURSE_UNITS` — 5 разделов по 5–8 шагов. Типы шагов:

| Тип | Источник вопросов | Поведение |
|---|---|---|
| `grammar` | `grammar.js` | карточка правила → упражнения |
| `listening` | `listening.js` | карточка аудирования → вопросы |
| `vocab` | `vocabulary.js` | 8 вопросов «что означает слово» |
| `practice` | все данные | 8 случайных вопросов |
| `chest` | — | мгновенно +30 💎 |
| `trophy` | — | мгновенно +60 💎, финал раздела |

`buildLessonItems(step)` в `core.js` — единственная точка сборки вопросов. Для практики из хаба используются псевдо-шаги (`practice-*`, `mistakes`) — они дают XP, но не отмечаются в пути (`STEP_BY_ID.has` в `lesson.js`).

## Движок урока (`lesson.js`)

```
open(step) → buildLessonItems → полноэкранный .lesson-screen
  шаг rule/listen  → кнопка «Понятно»
  шаг choice       → выбор варианта → «Проверить»
                      ├─ верно: звук, +1 correct, зелёный разбор
                      └─ ошибка: −1 сердце, красный разбор с правильным ответом, запись в mistakes
  конец → finish(): XP (+10, +5 за идеальный), +5 💎, серия, completedNodes
        → экран результата с конфетти → onDone() → перерисовка пути
```

Особенности:

- 0 сердец → экран «Сердца закончились» с покупкой за 50 💎 и продолжением с того же вопроса.
- XP начисляется `grantXp()` с учётом буста ×2.
- Серия обновляется в `touchStreak()`: сегодня → без изменений, вчера → +1, иначе заморозка или сброс.
- Закрытие урока (✕ или Esc) требует подтверждения и не сохраняет прогресс урока.

## Экраны (`app.js`)

| Route | Функция | Содержимое |
|---|---|---|
| `learn` | `routes.learn` | hero-карточка, 5 разделов с дорожкой, дневная цель и прогресс |
| `practice` | `routes.practice` | 5 плиток: смешанная, ошибки, аудирование, слова, грамматика |
| `reference` | `routes.reference` | все темы; модалка-читалка с правилом и кнопкой «Потренировать» |
| `vocab` | `routes.vocab` | наборы слов, озвучка, отметка «знаю», тренажёр |
| `profile` | `routes.profile` | уровень, статистика, серия, достижения |
| `shop` | `routes.shop` | баланс, сердца с таймером, товары |
| `settings` | `routes.settings` | голос/скорость/громкость/звук, тема, цель, обновления, сброс |

Роутинг — hash (`#learn`, `#shop`) + `history.pushState` с fallback на `location.hash`.

## IPC-контракт (`preload.js`)

| Канал | Направление | Назначение |
|---|---|---|
| `app:getVersion` | renderer → main | версия из `package.json` |
| `app:isPackaged` | renderer → main | dev или установленное приложение |
| `app:checkForUpdates` | renderer → main | ручная проверка обновлений |
| `app:quitAndInstall` | renderer → main | установить скачанное обновление |
| `app:openExternal` | renderer → main | открыть ссылку в браузере |
| `store:get` / `store:set` / `store:delete` | renderer → main | `electron-store` |
| `store:clearProgress` | renderer → main | сброс `game`, `vocabKnown`, старого прогресса (настройки сохраняются) |
| `dialog:showMessage` | renderer → main | нативные диалоги |
| `updater:checking` / `available` / `progress` / `downloaded` / `not-available` / `error` | main → renderer | события автообновления |

При добавлении канала обновляйте `src/preload.js`, `src/main.js` и эту таблицу.

## Файлы и ответственность

| Файл | Менять когда |
|---|---|
| `src/data/course.js` | структура пути, достижения, магазин |
| `src/data/grammar.js` | темы грамматики и упражнения |
| `src/data/listening.js` | уроки аудирования |
| `src/data/vocabulary.js` | наборы слов |
| `src/renderer/core.js` | состояние, сердца, XP, серия, TTS, звуки, сборка вопросов |
| `src/renderer/lesson.js` | прохождение урока, проверка ответов, результат |
| `src/renderer/app.js` | экраны, роутер, поиск, UI обновлений |
| `src/renderer/styles.css` | оформление и темы |
| `src/main.js` / `src/preload.js` | окно, IPC, updater |
| `scripts/*` | иконка, валидация, версии, changelog, docs |
| `tests/*` | данные, курс, jsdom smoke-тест |

## Ограничения и известные особенности

- Озвучка зависит от установленных в Windows голосов; при их отсутствии в уроке показывается подсказка, текст доступен всегда.
- Сборка не подписана сертификатом EV — SmartScreen может предупреждать.
- Автообновление работает только в установленной версии (`app.isPackaged === true`).
- Portable-версия обновляется вручную.
- `package-lock.json` коммитится: CI и релиз используют `npm ci` для воспроизводимости.
- Максимальное число заморозок серии — 2; сердца восстанавливаются 1 за 30 минут до 5.
