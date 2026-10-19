# Guide English

> Тренажёр английского языка для Windows 10/11: грамматика с объяснениями на русском, аудирование с озвучкой, словарь и тренировка. Прогресс сохраняется локально, обновления приходят автоматически из GitHub Releases.

[![CI](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/ci.yml/badge.svg)](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/ci.yml)
[![Release](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/release.yml/badge.svg)](https://github.com/ignatus4405-glitch/guide_english/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/ignatus4405-glitch/guide_english)](https://github.com/ignatus4405-glitch/guide_english/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6)](https://github.com/ignatus4405-glitch/guide_english/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<!-- CONTENT_STATS:START -->
| Грамматика | Аудирование | Словарь | Версия |
|---|---|---|---|
| 10 тем / 30 упражнений | 9 уроков / 27 вопросов | 27 слов | v0.1.0 |
<!-- CONTENT_STATS:END -->

---

## Скачать

1. Откройте [последний релиз](https://github.com/ignatus4405-glitch/guide_english/releases/latest).
2. Скачайте **Guide-English-Setup-<версия>.exe** (установщик) или **Guide-English-Portable-<версия>.exe** (портативная версия без установки).
3. Запустите. Windows SmartScreen может показать предупреждение — нажмите «Подробнее» → «Выполнить в любом случае» (сборка не подписана платным сертификатом).

Установленная версия сама проверяет обновления на GitHub при запуске и каждые 4 часа, уведомляет о новой версии и обновляется в один клик.

## Возможности

- **📚 Грамматика** — 10 тем от A0 до B1: алфавит и чтение, Present Simple/Continuous, Past Simple, артикли, будущее, модальные глаголы, условные предложения, Present Perfect, степени сравнения. У каждой темы: правило на русском, таблица, живые примеры, блок «частая ошибка» и тест с разбором каждого ответа.
- **🎧 Аудирование** — 9 диалогов и текстов трёх уровней (A1, A2, B1–B2). Озвучка через Web Speech API: выбор английского голоса, скорость 0.5–1.4×, подсветка предложений, перевод-подсказка и вопросы на понимание.
- **🃏 Словарь** — карточки с транскрипцией, переводом, примером и озвучкой; отметка «знаю» и тренажёр слов.
- **🧩 Тренировка** — смешанный тест из грамматики, аудирования и словаря.
- **💾 Прогресс** — хранится локально (`electron-store`), сбрасывается одной кнопкой.
- **🔄 Автообновления** — `electron-updater` + GitHub Releases: фоновая проверка, уведомление, прогресс загрузки и установка после перезапуска.
- **🌗 Тёмная тема** и масштабирование интерфейса.

## Технологии

| Слой | Технология |
|---|---|
| Оболочка | Electron 30 (Windows x64) |
| Интерфейс | Vanilla JS + CSS, без сборщика — быстрый старт и прозрачная кодовая база |
| Состояние | `electron-store` (JSON в `%APPDATA%`), в браузере — `localStorage` |
| Озвучка | Web Speech API (`speechSynthesis`), системные голоса Windows |
| Сборка | `electron-builder` → NSIS-установщик + portable `.exe` |
| Обновления | `electron-updater` (провайдер GitHub) |
| CI/CD | GitHub Actions: тесты, версионирование, сборка, релиз |

## Разработка

```bash
git clone https://github.com/ignatus4405-glitch/guide_english.git
cd guide_english
npm ci               # зависимости Electron
npm run icon         # пересоздать иконку (опционально)
npm start            # запуск приложения
npm run dev          # запуск с DevTools
npm run preview      # интерфейс в браузере (http://localhost:5173)
npm test             # тесты контента + smoke-тест UI + валидация
npm run docs:generate  # обновить индекс контента и статистику в README
npm run build:win    # локальная сборка установщика (Windows)
```

Требования: Node.js ≥ 18, npm ≥ 9. Сборка `.exe` выполняется в CI на `windows-latest`.

- [Архитектура и карта кода](docs/ARCHITECTURE.md)
- [Инструкция для агентов и контрибьюторов](docs/AGENTS.md)
- [Как добавить учебный контент](docs/CONTENT_GUIDE.md)
- [Процесс релиза и автообновлений](docs/RELEASING.md)
- [История изменений](docs/CHANGELOG.md)
- [Индекс контента (генерируется)](docs/CONTENT_INDEX.md)

## Как устроены версии и обновления

1. Любой push в `main` запускает **CI** (тесты, валидация, проверка синхронности документации).
2. Workflow **Release** анализирует коммиты по [Conventional Commits](https://www.conventionalcommits.org/ru/):
   - `feat:` → minor (0.1.0 → 0.2.0);
   - `fix:`, `perf:`, `refactor:` → patch (0.1.0 → 0.1.1);
   - `BREAKING CHANGE` / `feat!:` → major (0.1.0 → 1.0.0);
   - только `docs:`, `chore:`, `ci:` → релиз не создаётся.
3. Если версия меняется, Actions сам повышает её в `package.json`, дописывает `docs/CHANGELOG.md`, ставит тег `vX.Y.Z`, собирает `.exe`, публикует GitHub Release с `latest.yml` и notes.
4. Установленный клиент читает `latest.yml`, показывает баннер и обновляется.

Ручной релиз: `Actions → Release → Run workflow` с типом `patch|minor|major`.

## Структура репозитория

```
src/
  main.js               главный процесс Electron: окно, IPC, автообновление
  preload.js            безопасный мост contextBridge
  renderer/
    index.html          разметка оболочки
    styles.css          светлая/тёмная тема
    app.js              роутинг, уроки, TTS, прогресс, updater UI
  data/
    grammar.js          10 тем грамматики с упражнениями
    listening.js        9 уроков аудирования с вопросами
    vocabulary.js       наборы слов
scripts/                иконка, валидация, версии, changelog, генерация docs
tests/                  unit-тесты данных (node:test)
docs/                   архитектура, гайды, changelog, индекс контента
.github/workflows/      ci.yml, release.yml
```

## Лицензия

[MIT](LICENSE) © 2026 Guide English
