/**
 * Smoke-тесты интерфейса в стиле Duolingo без Electron: jsdom + инлайн-скрипты.
 * Проверяют путь, полноэкранный урок, hearts/XP, разделы и настройки.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const RENDERER_DIR = path.join(__dirname, '..', 'src', 'renderer');
const INDEX = path.join(RENDERER_DIR, 'index.html');

function buildInlineHtml() {
  let html = fs.readFileSync(INDEX, 'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    const file = path.resolve(RENDERER_DIR, src);
    return `<script>${fs.readFileSync(file, 'utf8')}</script>`;
  });
  html = html.replace(/<link rel="stylesheet"[^>]*>/g, '');
  return html;
}

async function bootApp() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (/Not implemented: window.scrollTo/.test(e.message)) return;
    errors.push(e.message);
  });
  virtualConsole.on('error', (msg) => errors.push(String(msg)));

  const dom = new JSDOM(buildInlineHtml(), {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  window.scrollTo = () => {};

  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') return resolve();
    window.addEventListener('load', resolve);
  });
  for (let i = 0; i < 60; i++) {
    if (window.document.querySelector('#view')?.children.length) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  return { dom, window, errors };
}

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function clickNav(window, route) {
  const btn = window.document.querySelector(`.nav-item[data-route="${route}"]`);
  assert.ok(btn, `нет пункта навигации ${route}`);
  btn.click();
}

async function openFirstLesson(window) {
  await wait(30);
  const node = window.document.querySelector('.node--current');
  assert.ok(node, 'на пути нет активного узла');
  node.click();
  await wait(40);
  assert.ok(window.document.querySelector('.lesson-screen'), 'урок не открылся');
}

test('приложение стартует: путь, статистика, маскот', async () => {
  const { window, errors } = await bootApp();
  try {
    const view = window.document.querySelector('#view');
    assert.ok(view.children.length > 0, 'пустой экран');
    assert.match(view.textContent, /Продолжаем учиться|Курс пройден/);
    assert.ok(window.document.querySelectorAll('.unit').length >= 5, 'должно быть 5 разделов');
    assert.ok(window.document.querySelectorAll('.node').length >= 30, 'мало узлов пути');
    assert.ok(window.document.querySelector('.node--current'), 'нет текущего узла');
    assert.ok(window.document.querySelector('.start-bubble'), 'нет подсказки «НАЧАТЬ»');
    assert.ok(window.document.querySelector('#brand-owl svg'), 'не отрисован маскот');
    assert.match(window.document.querySelector('#goal-text').textContent, /XP/);
    assert.equal(errors.length, 0, 'ошибки: ' + errors.join(' | '));
  } finally {
    window.close();
  }
});

test('урок: правило, вопрос, проверка и завершение с XP', async () => {
  const { window, errors } = await bootApp();
  try {
    await openFirstLesson(window);

    // первый шаг грамматики — карточка правила
    const content = window.document.querySelector('#lesson-content');
    assert.match(content.textContent, /Правило/);
    assert.ok(content.querySelector('.rule-card'), 'нет карточки правила');
    window.document.querySelector('[data-continue]').click();
    await wait(30);

    // отвечаем на все вопросы, выбирая вариант с классом правильного после проверки
    let guard = 0;
    while (window.document.querySelector('.lesson-screen') && !window.document.querySelector('.result') && guard < 20) {
      guard++;
      const options = window.document.querySelectorAll('#lesson-content .option');
      if (!options.length) break;
      options[0].click();
      const check = window.document.querySelector('.btn--check');
      check.click();
      await wait(10);
      window.document.querySelector('.btn--check').click();
      await wait(20);
    }

    const result = window.document.querySelector('.result');
    assert.ok(result, 'нет экрана результата');
    assert.match(result.textContent, /XP/);
    window.document.querySelector('[data-finish]').click();
    await wait(40);

    const state = window.__guideEnglish.state;
    assert.ok(state.game.completedNodes.length >= 1, 'урок не отмечен пройденным');
    assert.ok(state.game.xp >= 10, 'не начислен XP');
    assert.equal(window.document.querySelector('.lesson-screen'), null, 'урок не закрылся');
    assert.equal(errors.length, 0, 'ошибки: ' + errors.join(' | '));
  } finally {
    window.close();
  }
});

test('неправильный ответ снимает сердце и показывает разбор', async () => {
  const { window } = await bootApp();
  try {
    await openFirstLesson(window);
    window.document.querySelector('[data-continue]').click(); // правило
    await wait(30);

    const content = window.document.querySelector('#lesson-content');
    const options = Array.from(content.querySelectorAll('.option'));
    // выбираем вариант, который НЕ является правильным: кликаем последний
    const question = content.querySelector('.lesson-kicker').textContent;
    options[options.length - 1].click();
    window.document.querySelector('.btn--check').click();
    await wait(20);

    const feedback = window.document.querySelector('.feedback');
    assert.ok(feedback, 'нет панели разбора');
    assert.ok(!feedback.hidden, 'разбор скрыт');
    const state = window.__guideEnglish.state;
    assert.ok(state.game.hearts.count <= 4, 'сердце не снялось');
    assert.ok(question.length > 0);
  } finally {
    window.close();
  }
});

test('навигация: практика, справочник, словарь, профиль, магазин, настройки', async () => {
  const { window, errors } = await bootApp();
  try {
    clickNav(window, 'practice');
    await wait(30);
    assert.ok(window.document.querySelectorAll('.tile').length >= 5, 'нет карточек практики');

    clickNav(window, 'reference');
    await wait(30);
    assert.ok(window.document.querySelectorAll('.topic-card').length >= 9, 'нет тем справочника');
    window.document.querySelector('.topic-card').click();
    await wait(30);
    assert.ok(window.document.querySelector('.modal-card')?.textContent.includes('Частая ошибка'), 'не открылся разбор темы');
    window.document.querySelector('.modal-backdrop').remove();

    clickNav(window, 'vocab');
    await wait(30);
    assert.ok(window.document.querySelectorAll('.word-card').length >= 20, 'мало карточек слов');

    clickNav(window, 'profile');
    await wait(30);
    assert.match(window.document.querySelector('#view').textContent, /Достижения/);
    assert.ok(window.document.querySelectorAll('.achievement').length >= 10, 'нет достижений');

    clickNav(window, 'shop');
    await wait(30);
    assert.ok(window.document.querySelectorAll('.shop-item').length >= 3, 'нет товаров');

    clickNav(window, 'settings');
    await wait(30);
    assert.ok(window.document.querySelector('#voiceSelect'), 'нет выбора голоса');
    assert.ok(window.document.querySelector('#themeSelect'), 'нет выбора темы');

    assert.equal(errors.length, 0, 'ошибки: ' + errors.join(' | '));
  } finally {
    window.close();
  }
});

test('настройки: скорость, тема и звук сохраняются', async () => {
  const { window } = await bootApp();
  try {
    clickNav(window, 'settings');
    await wait(30);

    const rate = window.document.querySelector('#rateRange');
    rate.value = '1.2';
    rate.dispatchEvent(new window.Event('input', { bubbles: true }));

    const theme = window.document.querySelector('#themeSelect');
    theme.value = 'dark';
    theme.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(window.document.documentElement.dataset.theme, 'dark');

    const sound = window.document.querySelector('#soundToggle');
    const before = window.__guideEnglish.state.settings.sound;
    sound.click();
    assert.equal(window.__guideEnglish.state.settings.sound, !before);

    await wait(350);
    assert.equal(window.__guideEnglish.state.settings.rate, 1.2);
    assert.equal(window.__guideEnglish.state.settings.theme, 'dark');
  } finally {
    window.close();
  }
});

test('магазин восстанавливает сердца за самоцветы', async () => {
  const { window } = await bootApp();
  try {
    const state = window.__guideEnglish.state;
    state.game.hearts.count = 1;
    state.game.gems = 500;

    clickNav(window, 'shop');
    await wait(30);
    const buy = window.document.querySelector('[data-buy="refill-hearts"]');
    assert.ok(buy, 'нет товара с сердцами');
    buy.click();
    await wait(30);
    assert.equal(state.game.hearts.count, 5, 'сердца не восстановились');
    assert.equal(state.game.gems, 450, 'не списались самоцветы');
  } finally {
    window.close();
  }
});

test('аудирование: карточка прослушивания, текст и вопросы', async () => {
  const { window, errors } = await bootApp();
  try {
    const GE = window.__guideEnglish.GE;
    const target = 's1-listen-intro';
    const idx = GE.STEPS.findIndex((s) => s.id === target);
    assert.ok(idx > 0, 'шаг аудирования не найден');
    window.__guideEnglish.state.game.completedNodes = GE.STEPS.slice(0, idx).map((s) => s.id);
    window.__guideEnglish.render();
    await wait(30);

    const node = window.document.querySelector(`[data-step="${target}"]`);
    assert.ok(node, 'нет узла аудирования');
    node.click();
    await wait(30);

    assert.ok(window.document.querySelector('.listen-card'), 'нет карточки аудирования');
    const toggle = window.document.querySelector('[data-toggle]');
    toggle.click();
    assert.equal(window.document.querySelector('#listenText').hidden, false, 'текст не раскрылся');
    const toggleRu = window.document.querySelector('[data-toggle-ru]');
    assert.ok(toggleRu, 'нет переключателя перевода');
    toggleRu.click();
    const ru = window.document.querySelector('#listenRu');
    assert.equal(ru.hidden, false, 'перевод не раскрылся');
    assert.ok(ru.textContent.trim().length > 10, 'перевод пуст');
    window.document.querySelector('[data-continue]').click();
    await wait(30);

    assert.ok(window.document.querySelectorAll('#lesson-content .option').length >= 2, 'нет вопросов аудирования');
    let guard = 0;
    while (window.document.querySelector('.lesson-screen') && !window.document.querySelector('.result') && guard < 20) {
      guard++;
      const options = window.document.querySelectorAll('#lesson-content .option');
      if (!options.length) break;
      options[0].click();
      window.document.querySelector('.btn--check').click();
      await wait(10);
      window.document.querySelector('.btn--check').click();
      await wait(20);
    }
    assert.ok(window.document.querySelector('.result'), 'аудирование не завершилось');
    assert.equal(errors.length, 0, 'ошибки: ' + errors.join(' | '));
  } finally {
    window.close();
  }
});

test('практика запускает смешанный урок', async () => {
  const { window } = await bootApp();
  try {
    clickNav(window, 'practice');
    await wait(30);
    window.document.querySelector('[data-do="mixed"]').click();
    await wait(40);
    assert.ok(window.document.querySelector('.lesson-screen'), 'практика не открылась');
    assert.ok(window.document.querySelectorAll('.option').length >= 2, 'нет вопросов практики');
  } finally {
    window.close();
  }
});

test('заблокированный узел не открывает урок', async () => {
  const { window } = await bootApp();
  try {
    const locked = window.document.querySelector('.node--locked');
    assert.ok(locked, 'нет заблокированных узлов');
    locked.click();
    await wait(30);
    assert.equal(window.document.querySelector('.lesson-screen'), null, 'заблокированный урок открылся');
    assert.ok(window.document.querySelector('#toast-root').textContent.length > 0, 'нет предупреждения');
  } finally {
    window.close();
  }
});
