# Архитектура Guide English

Документ описывает, из чего состоит приложение и где что менять. Обновляйте его при изменении структуры.

## Общая схема

```
┌──────────────────────────── Electron (main process) ────────────────────────────┐
│  src/main.js                                                                     │
│   • создание BrowserWindow (contextIsolation: true, nodeIntegration: false)      │
│   • IPC: версия, store, диалоги, открытие ссылок, updater                         │
│   • electron-updater: проверка при старте (через 5 с) и каждые 4 часа             │
│   • события updater → webContents.send('updater:*')                              │
│   • меню: «Проверить обновления», «Открыть GitHub Releases», «О программе»       │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ preload.js (contextBridge → window.guideEnglish)
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│  Renderer (src/renderer)                                                        │
│   index.html ── подключает data/*.js и app.js                                   │
│   app.js                                                                        │
│     • Store-абстракция: electron-store ↔ localStorage                            │
│     • роутер на hash (#grammar/present-simple)                                   │
│     • разделы: dashboard, grammar, listening, vocabulary, practice, settings     │
│     • TTS-движок поверх speechSynthesis                                          │
│     • прогресс: state.progress / completedLessons / vocabularyProgress           │
│     • UI автообновлений: баннер, прогресс, кнопка «Перезапустить и обновить»     │
│   styles.css — дизайн-система на CSS-переменных + dark theme                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Ключевые решения

| Решение | Причина |
|---|---|
| Нет React/сборщика | Приложение целиком статичное, данные — JS-объекты. Меньше зависимостей → быстрее CI и проще поддержка агентами. |
| Данные в `src/data/*.js` | Файлы одновременно работают как CommonJS-модуль (для тестов и генерации docs) и как глобальные объекты (`window.GRAMMAR_TOPICS`) для рендерера. |
| `contextIsolation: true`, `nodeIntegration: false` | Безопасность: рендерер не имеет доступа к Node, только к явному API из `preload.js`. |
| `electron-store` | Переживает перезапуск и обновления; данные лежат в `%APPDATA%/Guide English/guide-english-store.json` (путь зависит от `productName`). |
| Web Speech API | Не требует ключей, работает офлайн с голосами Windows (SAPI). Голоса перечисляются динамически. |
| `electron-updater` + GitHub provider | Бесплатные релизы, `latest.yml` генерируется electron-builder, клиент обновляется без сервера. |
| NSIS + portable | Установщик для обычных пользователей, portable — для запуска без прав администратора. |

## Поток данных

1. **Загрузка.** `app.js → boot()`: читает состояние из store, инициализирует навигацию, поиск, подписки updater, рендерит раздел из `location.hash`.
2. **Ответ на упражнение.** Клик → запись в `state.progress[topicId].answers[i]` (`'correct' | 'wrong'`) → `scheduleSave()` (debounce 250 мс) → `Store.set` → IPC `store:set`.
3. **Аудирование.** Текст разбивается на предложения → TTS говорит по одному, подсвечивая строку. По завершении всех вопросов, если верно ≥ 66 %, урок попадает в `completedLessons`.
4. **Аудирование (скорость/голос).** Значения хранятся в `settings` и применяются к каждому `SpeechSynthesisUtterance`.
5. **Обновление.** `autoUpdater.checkForUpdates()` → события `update-available` / `download-progress` / `update-downloaded` → IPC → баннер в рендерере и системное уведомление → `autoUpdater.quitAndInstall()`.

## IPC-контракт (`preload.js`)

| Канал | Направление | Назначение |
|---|---|---|
| `app:getVersion` | renderer → main | версия из `package.json` |
| `app:isPackaged` | renderer → main | dev или установленное приложение |
| `app:checkForUpdates` | renderer → main | ручная проверка обновлений |
| `app:quitAndInstall` | renderer → main | установить скачанное обновление |
| `app:openExternal` | renderer → main | открыть ссылку в браузере |
| `store:get` / `store:set` / `store:delete` / `store:clearProgress` | renderer → main | доступ к `electron-store` |
| `dialog:showMessage` | renderer → main | нативные диалоги |
| `updater:checking` | main → renderer | началась проверка |
| `updater:available` | main → renderer | есть новая версия |
| `updater:progress` | main → renderer | процент загрузки |
| `updater:downloaded` | main → renderer | обновление готово к установке |
| `updater:not-available` | main → renderer | версия актуальна |
| `updater:error` | main → renderer | ошибка проверки/загрузки |

При добавлении канала обновляйте `src/preload.js`, `src/main.js` и эту таблицу.

## Модель прогресса

```js
state.progress = {
  "present-simple": { answers: { 0: "correct", 1: "wrong" }, lastPick: { 0: 1, 1: 2 } }
};
state.completedLessons = ["b1-introductions"];
state.vocabularyProgress = { "travel": ["flight", "booking"] };
state.settings = { voice, rate, volume, theme, lastSection };
```

`overallPercent()` в `app.js` считает общий прогресс: тема грамматики = 1 балл за начатый тест + 1 балл за 100 %, урок аудирования = 1 балл, каждые 10 известных слов = 1 балл.

## Файлы и ответственность

| Файл | Менять когда |
|---|---|
| `src/data/grammar.js` | добавление/правка грамматических тем |
| `src/data/listening.js` | добавление уроков аудирования |
| `src/data/vocabulary.js` | наборы слов |
| `src/renderer/app.js` | логика разделов, роутинг, TTS, UI обновлений |
| `src/renderer/styles.css` | оформление, темы |
| `src/main.js` | окно, IPC, updater, меню |
| `src/preload.js` | новые IPC-каналы |
| `tests/*.test.js` | тесты данных и jsdom-smoke-тест интерфейса |
| `scripts/*` | инструменты сборки и документации |
| `.github/workflows/*` | CI и релизный процесс |

## Ограничения и известные особенности

- Озвучка зависит от установленных в Windows голосов. Если английских голосов нет, Windows предложит установить их в «Параметры → Время и язык → Речь».
- Сборка не подписана сертификатом EV, поэтому SmartScreen может предупреждать при первом запуске.
- Автообновление работает только в установленной версии (`app.isPackaged === true`); в dev-режиме проверка отключена.
- Portable-версия обновляется вручную (скачать новый файл), автообновление рассчитано на NSIS-установку.
- `package-lock.json` коммитится: CI и релиз используют `npm ci`, чтобы сборки были воспроизводимыми. Dependabot обновляет зависимости отдельными PR.
