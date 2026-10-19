/**
 * Smoke-тест интерфейса без Electron: загружаем index.html в jsdom,
 * проверяем, что приложение стартует без ошибок и основные сценарии работают.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const RENDERER_DIR = path.join(__dirname, '..', 'src', 'renderer');
const INDEX = path.join(RENDERER_DIR, 'index.html');

/**
 * Инлайнит локальные <script src="..."> в HTML, чтобы jsdom не тянул ресурсы.
 */
function buildInlineHtml() {
  let html = fs.readFileSync(INDEX, 'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    const file = path.resolve(RENDERER_DIR, src);
    const code = fs.readFileSync(file, 'utf8');
    return `<script>${code}</script>`;
  });
  html = html.replace(/<link rel="stylesheet"[^>]*>/g, '');
  return html;
}

async function bootApp() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    // jsdom не реализует scrollTo — это ожидаемо
    if (/Not implemented: window.scrollTo/.test(e.message)) return;
    errors.push(e.message);
  });
  virtualConsole.on('error', (msg) => errors.push(String(msg)));

  const html = buildInlineHtml();
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole
  });

  const { window } = dom;
  window.scrollTo = () => {};
  window.confirm = () => true;

  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') return resolve();
    window.addEventListener('load', resolve);
  });
  // boot() асинхронный: ждём появления контента
  for (let i = 0; i < 50; i++) {
    if (window.document.querySelector('#content')?.children.length) break;
    await new Promise(r => setTimeout(r, 20));
  }
  return { dom, window, errors };
}

test('приложение стартует и рендерит главный экран', async () => {
  const { window, errors } = await bootApp();
  try {
  const content = window.document.querySelector('#content');
  assert.ok(content, 'нет #content');
  assert.match(content.textContent, /Английский/i);
  assert.ok(window.document.querySelectorAll('.topic-card').length >= 3, 'на главной нет карточек грамматики');
  assert.equal(errors.length, 0, 'ошибки при загрузке: ' + errors.join(' | '));
  } finally { window.close(); }
});

test('навигация переключает разделы, включая детальную тему', async () => {
  const { window, errors } = await bootApp();
  try {

  const grammarNav = window.document.querySelector('.nav__item[data-route="grammar"]');
  grammarNav.click();
  await new Promise(r => setTimeout(r, 30));
  assert.match(window.document.querySelector('#content').textContent, /Грамматика/);

  const card = window.document.querySelector('.topic-card');
  assert.ok(card, 'нет карточки темы');
  card.click();
  await new Promise(r => setTimeout(r, 30));
  assert.ok(window.document.querySelector('.detail'), 'не открылся экран темы');
  assert.ok(window.document.querySelectorAll('.exercise').length >= 3, 'нет упражнений');

  assert.equal(errors.length, 0, 'ошибки навигации: ' + errors.join(' | '));
  } finally { window.close(); }
});

test('ответ на упражнение сохраняется и помечается', async () => {
  const { window } = await bootApp();
  try {
  const grammarNav = window.document.querySelector('.nav__item[data-route="grammar"]');
  grammarNav.click();
  await new Promise(r => setTimeout(r, 30));
  window.document.querySelector('.topic-card').click();
  await new Promise(r => setTimeout(r, 30));

  const firstExercise = window.document.querySelector('.exercise');
  const option = firstExercise.querySelector('.exercise__opt');
  option.click();

  assert.ok(
    firstExercise.querySelector('.exercise__opt.correct'),
    'правильный вариант не подсвечен'
  );
  const progress = window.__guideEnglish.state.progress;
  assert.ok(Object.keys(progress).length > 0, 'прогресс не записан');
  } finally { window.close(); }
});

test('раздел аудирования показывает уроки и открывает текст', async () => {
  const { window, errors } = await bootApp();
  try {
  window.document.querySelector('.nav__item[data-route="listening"]').click();
  await new Promise(r => setTimeout(r, 30));
  const lessonButton = window.document.querySelector('[data-open]');
  assert.ok(lessonButton, 'нет кнопок открытия урока');
  lessonButton.click();
  await new Promise(r => setTimeout(r, 30));
  assert.ok(window.document.querySelector('#transcript'), 'нет транскрипта');
  assert.ok(window.document.querySelectorAll('#transcript [data-sent]').length >= 3, 'мало предложений');
  assert.ok(window.document.querySelector('#listeningQuiz'), 'нет вопросов');
  assert.equal(errors.length, 0, 'ошибки аудирования: ' + errors.join(' | '));
  } finally { window.close(); }
});

test('словарь и тренировка открываются, поиск находит тему', async () => {
  const { window, errors } = await bootApp();
  try {

  window.document.querySelector('.nav__item[data-route="vocabulary"]').click();
  await new Promise(r => setTimeout(r, 30));
  assert.ok(window.document.querySelectorAll('.word-card').length >= 10, 'мало карточек слов');

  window.document.querySelector('.nav__item[data-route="practice"]').click();
  await new Promise(r => setTimeout(r, 30));
  const start = window.document.querySelector('#startPractice');
  assert.ok(start, 'нет кнопки тренировки');
  start.click();
  await new Promise(r => setTimeout(r, 30));
  assert.ok(window.document.querySelectorAll('#practiceBody .exercise__opt').length >= 2, 'не началась тренировка');

  const search = window.document.querySelector('#globalSearch');
  search.value = 'артикл';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  assert.match(window.document.querySelector('#content').textContent, /Результаты/i);
  assert.match(window.document.querySelector('#content').textContent, /Артикли/i);

  assert.equal(errors.length, 0, 'ошибки: ' + errors.join(' | '));
  } finally { window.close(); }
});

test('настройки сохраняют скорость и тему', async () => {
  const { window } = await bootApp();
  try {
  window.document.querySelector('.nav__item[data-route="settings"]').click();
  await new Promise(r => setTimeout(r, 30));

  const rate = window.document.querySelector('#rateRange');
  assert.ok(rate, 'нет ползунка скорости');
  rate.value = '1.2';
  rate.dispatchEvent(new window.Event('input', { bubbles: true }));

  const theme = window.document.querySelector('#themeSelect');
  theme.value = 'dark';
  theme.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.documentElement.dataset.theme, 'dark');

  await new Promise(r => setTimeout(r, 400));
  assert.equal(window.__guideEnglish.state.settings.rate, 1.2);
  } finally { window.close(); }
});
