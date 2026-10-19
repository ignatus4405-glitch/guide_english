# Релизы и автообновления

## Как это работает

```
push в main
   │
   ├─► CI (ci.yml): тесты, валидация контента, проверка документации
   │
   └─► Release (release.yml)
          1. npm install, тесты
          2. scripts/next-version.js → версия по Conventional Commits
          3. если версия выросла:
               package.json bump → docs/CHANGELOG.md → docs/CONTENT_INDEX.md → README stats
               commit "chore(release): vX.Y.Z [skip ci]" → tag vX.Y.Z → push
          4. windows-latest: electron-builder --win --publish always
          5. GitHub Release: Setup .exe, Portable .exe, latest.yml, blockmap, notes
   │
   └─► Установленный клиент: electron-updater видит latest.yml → уведомление → обновление
```

## Семантическое версионирование по коммитам

| Коммит с момента последнего тега | Новая версия | Пример |
|---|---|---|
| `feat!:` или `BREAKING CHANGE` в теле | major | 0.4.1 → 1.0.0 |
| `feat:` | minor | 0.4.1 → 0.5.0 |
| `fix:`, `perf:`, `refactor:`, `revert:` | patch | 0.4.1 → 0.4.2 |
| только `docs:`, `chore:`, `ci:`, `test:`, `style:`, `build:` | релиз не создаётся | — |
| первый запуск без тегов | берётся версия из `package.json` | 0.1.0 |

Проверить локально, что получится:

```bash
npm run next-version
```

## Ручной запуск

`Actions → Release → Run workflow`:

- `patch` — принудительно patch;
- `minor` — принудительно minor;
- `major` — принудительно major;
- `auto` — по коммитам (по умолчанию).

## Ручной релиз из CLI (аварийный)

```bash
npm run version:patch        # или version:minor / version:major
npm run docs:generate
npm run docs:changelog -- 0.1.1 v0.1.0   # опционально
git add -A
git commit -m "chore(release): v0.1.1"
git tag v0.1.1
git push --follow-tags
```

Тег `v*` запускает `release.yml` (сборка и публикация). Повышать версию дважды не нужно: workflow увидит, что `package.json` уже равен тегу.

## Проверка артефактов автообновления

После сборки workflow проверяет, что в `dist/` есть `latest.yml` с правильной версией,
а в `win-unpacked/resources` — `app-update.yml` и `app.asar`. Если проверка падает, релиз не будет
корректно обновлять клиентов, даже если установщик собрался.

## Оформление релиза

`electron-builder` создаёт релиз с тегом `vX.Y.Z`. Заголовок и текст релиза формирует отдельный шаг workflow:
`gh release edit` подставляет имя «Guide English X.Y.Z» и содержимое `build/release-notes.md`
(генерируется из секции `docs/CHANGELOG.md` для этой версии скриптом `scripts/extract-release-notes.js`).
Merge-коммиты и служебные `chore(release)` в changelog не попадают.
Если нужно поменять текст уже опубликованного релиза — отредактируйте его на GitHub или перезапустите workflow.

## Где взять сборки

- GitHub Releases: `https://github.com/ignatus4405-glitch/guide_english/releases`
- Артефакты Actions (временные, 90 дней): вкладка Actions → нужный run → Artifacts.

## Как клиент узнаёт об обновлении

1. `src/main.js` через 5 секунд после старта и далее каждые 4 часа вызывает `autoUpdater.checkForUpdates()` (автозагрузка включена, установку подтверждает пользователь).
2. `electron-updater` читает `https://github.com/ignatus4405-glitch/guide_english/releases/latest/download/latest.yml`.
3. Если `version` больше установленной → `update-available` → рендерер показывает баннер, main — системное уведомление (собственное, без дублей от `checkForUpdatesAndNotify`).
4. Файл скачивается в фоне, `download-progress` обновляет полосу прогресса.
5. По `update-downloaded` появляется диалог: «Установить и перезапустить» → `quitAndInstall()`.

Проверить вручную в приложении: `Помощь → Проверить обновления` или кнопка в сайдбаре.

## Требования и нюансы

- В релизе обязательно должен быть файл `latest.yml` — его создаёт `electron-builder` при `--publish always`.
- `publish` в `electron-builder.yml` должен указывать на этот репозиторий (`owner: ignatus4405-glitch`, `repo: guide_english`).
- Нельзя удалять/перезаписывать старые релизы: `latest.yml` привязан к последнему.
- Portable-версия не обновляется автоматически — её скачивают заново.
- Сборка не подписана: Windows SmartScreen может предупреждать. Если появится сертификат, добавьте `win.signingHashAlgorithms`/секреты и включите проверку подписи.
- Пуш, сделанный в workflow через `GITHUB_TOKEN`, **не запускает** следующие workflow — поэтому bump-коммит не создаёт бесконечный цикл.
- Если включена защита ветки `main`, разрешите Actions писать в неё (Settings → Actions → General → Workflow permissions → Read and write) или используйте отдельного бота.

## Переменные и секреты

| Имя | Где задаётся | Назначение |
|---|---|---|
| `GITHUB_TOKEN` | автоматически | пуш тега, создание релиза, загрузка ассетов |
| `GH_TOKEN` | из `GITHUB_TOKEN` в job сборки | `electron-builder --publish always` |
| `npm_config_cache` | workflow | кэш npm |

Отдельный PAT не требуется.

## Troubleshooting

| Проблема | Причина / решение |
|---|---|
| Release workflow зелёный, но релиза нет | Не было `feat`/`fix`/`breaking` коммитов. Запустите вручную с типом `patch`. |
| `npm ERR! 403` при публикации | Нет прав `contents: write`. Проверьте блок `permissions` в workflow. |
| Клиент пишет «Не удалось проверить обновления» | Нет интернета, приватный/удалённый релиз или отсутствует `latest.yml`. |
| Обновление скачалось, но не устанавливается | Запущена portable-версия или нет прав на папку установки (Program Files требует elevation). |
| После обновления пропал прогресс | Данные лежат в `%APPDATA%/Guide English/` и не удаляются установщиком; проверьте, не изменился ли `appId`/`productName`. |
