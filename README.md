# Guide English

> Изучение английского в формате игры: путь из уроков, сердца, серия дней, XP, самоцветы и магазин — плюс настоящие правила с объяснениями на русском и аудирование с озвучкой. Windows 10/11, автообновления из GitHub Releases.

[![CI](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/ci.yml/badge.svg)](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/ci.yml)
[![Release](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/release.yml/badge.svg)](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/ignatus4405-glitch/guide_english)](https://github.com/ignatus4405-glitch/guide_english/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6)](https://github.com/ignatus4405-glitch/guide_english/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<!-- CONTENT_STATS:START -->
| Путь | Грамматика | Аудирование | Словарь | Версия |
|---|---|---|---|---|
| 5 разделов / 32 шагов | 10 тем / 30 упражнений | 9 уроков / 27 вопросов | 27 слов | v0.3.0 |
<!-- CONTENT_STATS:END -->

---

## Скачать

1. Откройте [последний релиз](https://github.com/ignatus4405-glitch/guide_english/releases/latest).
2. Скачайте **Guide-English-Setup-<версия>.exe** (установщик) или **Guide-English-Portable-<версия>.exe** (портативная версия).
3. Запустите. SmartScreen может предупредить — «Подробнее» → «Выполнить в любом случае» (сборка не подписана платным сертификатом).

Установленная версия сама проверяет обновления на GitHub при запуске и каждые 4 часа, показывает баннер с прогрессом и обновляется в один клик.

## Как это выглядит

- **Дорожка обучения** из 5 разделов и 32 шагов: грамматика, аудирование, словарь, тренировки, сундуки и финалы разделов. Уроки открываются последовательно; текущий шаг подсвечен и подпрыгивает.
- **Полноэкранный урок как в Duolingo**: полоса прогресса, сердца, крупные варианты ответов, зелёная/красная панель разбора и экран результата с конфетти.
- **Геймификация**: ❤️ 5 сердец (минус за ошибку, восстановление раз в 30 минут), 🔥 серия дней, ⚡ XP и уровни, 💎 самоцветы, 🛍️ магазин (сердца, двойной XP, заморозка серии), 12 достижений.
- **Правила никуда не делись**: перед упражнениями по теме показывается карточка правила с таблицей и примерами; всё это доступно и в «Справочнике» с озвучкой.
- **Аудирование**: 9 уроков A1–B2, озвучка системным голосом Windows, скорость 0.5–1.4×, подсветка и перевод, вопросы на понимание.
- **Словарь**: 27 слов с транскрипцией, примерами и озвучкой, отметка «знаю» и викторина.
- **Тёмная тема**, поиск по всему курсу и горячие клавиши.

## Возможности

| Раздел | Что внутри |
|---|---|
| 🏠 Учиться | Дорожка с узлами, дневная цель, серия, сердца и прогресс |
| 🎯 Практика | Смешанная тренировка, работа над ошибками, аудирование, слова, грамматика |
| 📖 Справочник | 10 тем с правилами, таблицами, примерами и кнопкой «Потренировать» |
| 🃏 Словарь | Наборы слов, карточки и викторина |
| 🦉 Профиль | Уровень, XP, серия, статистика, 12 достижений |
| 🛍️ Магазин | Сердца, двойной XP, заморозка серии |
| ⚙️ Настройки | Голос, скорость, громкость, звуки, тема, дневная цель, обновления, сброс |

## Технологии

| Слой | Технология |
|---|---|
| Оболочка | Electron 30 (Windows x64) |
| Интерфейс | Vanilla JS + CSS без сборщика; собственный «движок урока» |
| Состояние | `electron-store`, в браузере — `localStorage` |
| Озвучка | Web Speech API (`speechSynthesis`), голоса Windows |
| Звуки | Web Audio API (осцилляторы, без аудиофайлов) |
| Сборка | `electron-builder` → NSIS + portable `.exe` |
| Обновления | `electron-updater` (GitHub Releases) |
| CI/CD | GitHub Actions: тесты, версии, changelog, релиз |

## Разработка

```bash
git clone https://github.com/ignatus4405-glitch/guide_english.git
cd guide_english
npm ci               # зависимости Electron
npm start            # запуск приложения
npm run dev          # запуск с DevTools
npm run preview      # интерфейс в браузере (http://localhost:5173)
npm test             # тесты данных, курса и smoke-тест UI (jsdom)
npm run docs:generate  # индекс контента и статистика README
npm run build:win    # локальная сборка установщика (Windows)
```

Требования: Node.js ≥ 22 (CI использует Node 22), npm ≥ 10. Сборка `.exe` выполняется в CI на `windows-latest`.

- [Руководство пользователя](docs/USER_GUIDE.md)
- [План развития](docs/ROADMAP.md)
- [Архитектура и карта кода](docs/ARCHITECTURE.md)
- [Инструкция для агентов и контрибьюторов](docs/AGENTS.md)
- [Как добавить учебный контент](docs/CONTENT_GUIDE.md)
- [Процесс релиза и автообновлений](docs/RELEASING.md)
- [История изменений](docs/CHANGELOG.md)
- [Индекс контента (генерируется)](docs/CONTENT_INDEX.md)

## Как устроены версии и обновления

1. Push в `main` и каждый pull request запускают **CI** (тесты данных, курса и интерфейса, проверка документации).
2. Workflow **Release** анализирует коммиты по [Conventional Commits](https://www.conventionalcommits.org/ru/):
   - `feat:` → minor (0.2.0 → 0.3.0);
   - `fix:`, `perf:`, `refactor:` → patch;
   - `BREAKING CHANGE` / `feat!:` → major;
   - только `docs:`, `chore:`, `ci:` → релиз не создаётся.
3. Actions сам повышает версию, дописывает `docs/CHANGELOG.md`, ставит тег `vX.Y.Z`, собирает `.exe` и публикует GitHub Release с `latest.yml`.
4. Установленный клиент читает `latest.yml`, показывает баннер и обновляется.

Ручной релиз: `Actions → Release → Run workflow` (`auto|patch|minor|major`).

## Структура репозитория

```
src/
  main.js               главный процесс Electron: окно, IPC, автообновление
  preload.js            безопасный мост contextBridge
  renderer/
    index.html          оболочка: сайдбар, топбар, контейнеры
    styles.css          Duolingo-стиль: 3D-кнопки, путь, урок, тёмная тема
    core.js             состояние, хранилище, TTS, звуки, сердца, XP, серия
    lesson.js           движок урока: правило → вопросы → результат
    app.js              экраны, роутер, путь, магазин, профиль, поиск
  data/
    course.js           путь: 5 разделов, 32 шага, достижения, магазин
    grammar.js          10 тем грамматики с упражнениями
    listening.js        9 уроков аудирования с вопросами
    vocabulary.js       наборы слов
scripts/                иконка, валидация, версии, changelog, docs
tests/                  данные, курс и smoke-тест интерфейса (node:test + jsdom)
docs/                   архитектура, гайды, changelog, индекс контента
.github/workflows/      ci.yml, release.yml
```

## Известные ограничения

- Озвучка использует голоса Windows: набор и качество зависят от речевых пакетов.
- Установщик не подписан сертификатом — SmartScreen может предупредить.
- Портативная версия обновляется вручную; автообновление работает для Setup-версии.
- Для сборки и тестов нужен Node.js 22+.

## Лицензия

[MIT](LICENSE) © 2026 Guide English
