# AGENTS.md

Точка входа для любого агента (Codex, Claude, Cursor, Copilot, CI-бот), который продолжает работу над **Guide English**.

## Прочитайте в первую очередь

1. [`docs/AGENTS.md`](docs/AGENTS.md) — протокол работы, чек-листы, правила коммитов.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — карта кода, IPC-контракт, модель прогресса.
3. [`docs/RELEASING.md`](docs/RELEASING.md) — как работает авто-версионирование и автообновление.
4. [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) — как добавлять темы, уроки и слова.
5. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — что уже сделано и почему.
6. [`docs/ROADMAP.md`](docs/ROADMAP.md) — что делать дальше.

## Быстрый старт

```bash
npm install
npm test                 # node:test + валидация контента
npm start                # запуск Electron-приложения
npm run preview          # интерфейс в браузере без Electron (http://localhost:5173)
npm run docs:generate    # обновить docs/CONTENT_INDEX.md и статистику README
```

## Инварианты (не нарушать)

- `npm test` и `npm run docs:check` должны быть зелёными перед коммитом.
- Любое изменение функциональности документируется в `docs/` в том же коммите.
- `docs/CONTENT_INDEX.md` генерируется, вручную не редактируется.
- Версия в `package.json` меняется только workflow Release (или `scripts/bump-version.js`).
- Коммиты — Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`.
- Весь пользовательский текст в рендерере проходит через `escapeHtml()`.

## Что уже реализовано

Electron-приложение для Windows в стиле Duolingo: путь из 5 разделов и 32 шагов, сердца, серия дней, XP и уровни, самоцветы, магазин, 12 достижений, движок урока с правилами и аудированием, словарь, тёмная тема, автообновления через GitHub Releases, CI и автоматические релизы.
