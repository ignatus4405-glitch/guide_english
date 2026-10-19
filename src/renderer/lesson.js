/* Guide English — движок урока в стиле Duolingo.
   Полноэкранный поток: правило/аудио → вопросы → проверка → результат. */
(function () {
  'use strict';

  const {
    $, escapeHtml, formatInline, shuffle, tts, Sfx, state, owlSvg,
    findTopic, findListening, findVocabSet, buildLessonItems,
    spendHeart, addHearts, grantXp, touchStreak, save, HEART_MAX
  } = window.GE;

  let root = null;        // #lesson-root
  let session = null;     // текущая сессия урока
  let keyHandler = null;

  // ---------- helpers ----------
  function heartsHtml() {
    const n = state.game.hearts.count;
    return `<span class="lesson-hearts" title="Сердца">${'❤️'.repeat(Math.max(0, n))}${'🤍'.repeat(Math.max(0, HEART_MAX - n))}</span>`;
  }

  function updateHearts() {
    const el = $('.lesson-hearts', root);
    if (!el) return;
    el.textContent = '❤️'.repeat(Math.max(0, state.game.hearts.count)) +
      '🤍'.repeat(Math.max(0, HEART_MAX - state.game.hearts.count));
  }

  function fmtTime(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function setProgress(percent) {
    const fill = $('.lesson-bar__fill', root);
    if (fill) fill.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }

  function close() {
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    tts.stop();
    if (root) {
      root.innerHTML = '';
      root.classList.remove('is-open');
    }
    document.body.classList.remove('lesson-open');
    const cb = session && session.onClose;
    session = null;
    if (cb) cb();
  }

  function confirmExit() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-card__owl">${owlSvg(84, 'sad')}</div>
        <h2>Выйти из урока?</h2>
        <p>Текущий прогресс урока не сохранится. Вы уверены?</p>
        <div class="modal-card__actions">
          <button class="btn btn-3d btn--gray" data-stay>ПРОДОЛЖИТЬ УРОК</button>
          <button class="btn btn-3d btn--red" data-leave>ВЫЙТИ</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-stay]').onclick = () => modal.remove();
    modal.querySelector('[data-leave]').onclick = () => {
      modal.remove();
      close();
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  // ---------- запуск ----------
  function open(step, opts = {}) {
    if (!root) root = $('#lesson-root');
    if (!root) return;

    if (step.type === 'chest' || step.type === 'trophy') {
      openReward(step, opts);
      return;
    }

    const items = buildLessonItems(step);
    if (!items.length) {
      opts.onClose && opts.onClose();
      return;
    }

    // нет сердец — предлагаем восстановить
    if (state.game.hearts.count <= 0) {
      showOutOfHearts(step, opts);
      return;
    }

    session = {
      step,
      items,
      index: 0,
      selected: null,
      checked: false,
      correct: 0,
      wrong: 0,
      start: Date.now(),
      onClose: opts.onClose || null,
      onDone: opts.onDone || null
    };

    root.classList.add('is-open');
    document.body.classList.add('lesson-open');
    renderFrame();
    renderItem();
    bindKeys();
  }

  function bindKeys() {
    keyHandler = (e) => {
      if (!session) return;
      if (e.key === 'Escape') { confirmExit(); return; }
      if (e.key === 'Enter') {
        const btn = $('.lesson-footer .btn--check, .lesson-footer [data-continue]', root);
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        return;
      }
      if (/^[1-4]$/.test(e.key) && !session.checked) {
        const idx = Number(e.key) - 1;
        const opt = $(`.option[data-opt="${idx}"]`, root);
        if (opt) opt.click();
      }
    };
    document.addEventListener('keydown', keyHandler);
  }

  function renderFrame() {
    root.innerHTML = `
      <div class="lesson-screen">
        <header class="lesson-top">
          <button class="icon-btn" data-exit aria-label="Выйти из урока">✕</button>
          <div class="lesson-bar"><div class="lesson-bar__fill" style="width:4%"><span></span></div></div>
          ${heartsHtml()}
        </header>
        <div class="lesson-content" id="lesson-content"></div>
        <footer class="lesson-footer" id="lesson-footer"></footer>
      </div>`;
    $('[data-exit]', root).onclick = confirmExit;
    setProgress((session.index / session.items.length) * 100);
  }

  function currentItem() {
    return session ? session.items[session.index] : null;
  }

  // ---------- рендер шага ----------
  function renderItem() {
    if (!session) return;
    const item = currentItem();
    if (!item) return finish();

    session.selected = null;
    session.checked = false;
    setProgress((session.index / session.items.length) * 100);
    updateHearts();

    if (item.type === 'rule') return renderRule(item);
    if (item.type === 'listen') return renderListen(item);
    return renderChoice(item);
  }

  function renderRule(item) {
    const topic = item.topic;
    const c = topic.content;
    const content = $('#lesson-content');
    content.className = 'lesson-content lesson-content--scroll';
    content.innerHTML = `
      <div class="lesson-kicker">Правило · ${escapeHtml(topic.level)}</div>
      <h1 class="lesson-title">${escapeHtml(topic.title)}</h1>
      <div class="rule-card">
        <div class="rule-card__body">${c.rule}</div>
        ${c.table ? `
          <div class="table-wrap">
            <table>
              <thead><tr>${c.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
              <tbody>${c.table.rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>` : ''}
      </div>
      <div class="example-list">
        ${c.examples.map((ex) => `
          <div class="example-row">
            <button class="icon-btn icon-btn--audio" data-say="${escapeHtml(ex.en.split(' — ')[0])}" aria-label="Прослушать">🔊</button>
            <div>
              <div class="example-row__en">${escapeHtml(ex.en)}</div>
              <div class="example-row__ru">${escapeHtml(ex.ru)}</div>
            </div>
          </div>`).join('')}
      </div>
      ${c.pitfalls ? `<div class="tip-card tip-card--warn"><b>⚠️ Частая ошибка.</b> ${formatInline(c.pitfalls)}</div>` : ''}
    `;

    content.querySelectorAll('[data-say]').forEach((btn) => {
      btn.onclick = () => tts.speak(btn.dataset.say);
    });

    $('#lesson-footer').innerHTML = `
      <div class="lesson-footer__actions">
        <button class="btn btn-3d btn--green btn--wide" data-continue>ПОНЯТНО</button>
      </div>`;
    $('[data-continue]', root).onclick = () => {
      Sfx.click();
      session.index++;
      renderItem();
    };
  }

  function renderListen(item) {
    const lesson = item.lesson;
    const content = $('#lesson-content');
    content.className = 'lesson-content lesson-content--scroll';
    content.innerHTML = `
      <div class="lesson-kicker">Аудирование · ${escapeHtml(lesson.levelTitle || '')}</div>
      <h1 class="lesson-title">${escapeHtml(lesson.title)}</h1>
      <div class="listen-card">
        <button class="speaker-btn speaker-btn--xl" data-play aria-label="Прослушать текст">🔊</button>
        <div class="listen-card__hint">Нажмите, чтобы прослушать текст</div>
        <div class="listen-card__tips">${escapeHtml(lesson.scriptTips || '')}</div>
      </div>
      <div class="listen-text" id="listenText" hidden>
        <p>${escapeHtml(lesson.textEn)}</p>
      </div>
      <div class="listen-text" id="listenRu" hidden>
        <p class="listen-text__ru">${escapeHtml(lesson.textRu || '')}</p>
      </div>
      <div class="listen-actions">
        <button class="btn btn-3d btn--blue" data-toggle>ПОКАЗАТЬ ТЕКСТ</button>
        <button class="btn btn-3d btn--gray" data-toggle-ru>ПЕРЕВОД</button>
      </div>
      <div class="tip-card" style="margin-top:14px">
        <b>🎯 Задание.</b> Прослушайте текст и ответьте на вопросы. Текст можно открыть, если что-то непонятно.
      </div>
    `;
    $('[data-play]', root).onclick = () => {
      tts.speak(lesson.textEn, { rate: Math.min(Number(state.settings.rate) || 1, 0.9) });
    };
    $('[data-toggle]', root).onclick = (e) => {
      const box = $('#listenText');
      const show = box.hidden;
      box.hidden = !show;
      e.currentTarget.textContent = show ? 'СКРЫТЬ ТЕКСТ' : 'ПОКАЗАТЬ ТЕКСТ';
    };
    $('[data-toggle-ru]', root).onclick = (e) => {
      const box = $('#listenRu');
      const show = box.hidden;
      box.hidden = !show;
      e.currentTarget.textContent = show ? 'СКРЫТЬ ПЕРЕВОД' : 'ПЕРЕВОД';
    };
    $('#lesson-footer').innerHTML = `
      <div class="lesson-footer__actions">
        <button class="btn btn-3d btn--green btn--wide" data-continue>К ВОПРОСАМ</button>
      </div>`;
    $('[data-continue]', root).onclick = () => {
      tts.stop();
      Sfx.click();
      session.index++;
      renderItem();
    };
  }

  function renderChoice(item) {
    const content = $('#lesson-content');
    content.className = 'lesson-content';
    content.innerHTML = `
      <div class="lesson-kicker">${escapeHtml(item.source || 'Вопрос')}</div>
      <h1 class="lesson-title lesson-title--question">
        ${item.speak ? `<button class="speaker-btn" data-say aria-label="Прослушать">🔊</button>` : ''}
        <span>${formatInline(item.prompt)}</span>
      </h1>
      ${item.listenText ? `<button class="btn btn-3d btn--blue btn--small" data-play-text>🔊 ПРОСЛУШАТЬ ТЕКСТ</button>` : ''}
      ${item.hint ? `<div class="question-hint">${escapeHtml(item.hint)}</div>` : ''}
      <div class="options" role="listbox">
        ${item.options.map((opt, i) => `
          <button class="option" data-opt="${i}" role="option">
            <span class="option__key">${String.fromCharCode(65 + i)}</span>
            <span class="option__text">${formatInline(opt)}</span>
          </button>`).join('')}
      </div>
    `;

    const sayBtn = $('[data-say]', content);
    if (sayBtn) sayBtn.onclick = () => tts.speak(item.speak);
    const playBtn = $('[data-play-text]', content);
    if (playBtn) playBtn.onclick = () => tts.speak(item.listenText, { rate: Math.min(Number(state.settings.rate) || 1, 0.9) });

    content.querySelectorAll('.option').forEach((opt) => {
      opt.onclick = () => {
        if (session.checked) return;
        content.querySelectorAll('.option').forEach((o) => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        session.selected = Number(opt.dataset.opt);
        Sfx.click();
        const check = $('.lesson-footer .btn--check', root);
        if (check) check.disabled = false;
      };
    });

    renderCheckFooter(item);
  }

  function renderCheckFooter(item) {
    const footer = $('#lesson-footer');
    footer.innerHTML = `
      <div class="feedback" hidden></div>
      <div class="lesson-footer__actions">
        <button class="btn btn-3d btn--green btn--wide btn--check" disabled>ПРОВЕРИТЬ</button>
      </div>`;
    const check = $('.btn--check', footer);
    check.onclick = () => {
      if (!session.checked) return checkAnswer(item);
      next();
    };
  }

  function checkAnswer(item) {
    if (session.selected === null || session.checked) return;
    session.checked = true;

    const selected = session.selected;
    const correct = selected === item.answer;
    const content = $('#lesson-content');
    const options = content.querySelectorAll('.option');
    options.forEach((opt) => {
      const i = Number(opt.dataset.opt);
      opt.classList.remove('is-selected');
      opt.classList.add('is-locked');
      if (i === item.answer) opt.classList.add('is-correct');
      else if (i === selected) opt.classList.add('is-wrong');
    });

    const feedback = $('.feedback', root);
    feedback.hidden = false;

    if (correct) {
      session.correct++;
      Sfx.correct();
      feedback.className = 'feedback feedback--correct';
      feedback.innerHTML = `
        <div class="feedback__title">Отлично! 🎉</div>
        <div class="feedback__text">${formatInline(item.explain || 'Верно!')}</div>`;
    } else {
      session.wrong++;
      const left = spendHeart();
      Sfx.wrong();
      if (item.type === 'choice' && Array.isArray(item.options)) {
        const list = state.game.mistakes || [];
        const already = list.some((m) => m.prompt === item.prompt);
        if (!already && list.length < 30) {
          list.push({
            prompt: item.prompt,
            options: item.options,
            answer: item.answer,
            explain: item.explain,
            source: item.source,
            speak: item.speak || null,
            listenText: item.listenText || null
          });
          state.game.mistakes = list;
        }
      }
      feedback.className = 'feedback feedback--wrong';
      feedback.innerHTML = `
        <div class="feedback__title">Не совсем ${left === 0 ? '💔' : '🙂'}</div>
        <div class="feedback__text">
          Правильный ответ: <b>${formatInline(item.options[item.answer])}</b>.<br>
          ${formatInline(item.explain || '')}
        </div>`;
      updateHearts();
    }

    const btn = $('.btn--check', root);
    btn.textContent = 'ПРОДОЛЖИТЬ';
    btn.classList.toggle('btn--red', !correct);
    btn.classList.toggle('btn--green', correct);

    if (state.game.hearts.count <= 0) {
      session.failed = true;
      btn.textContent = 'ПРОДОЛЖИТЬ';
    }
  }

  function next() {
    if (session.failed) {
      showOutOfHearts(session.step, { onClose: session.onClose }, session);
      return;
    }
    session.index++;
    renderItem();
  }

  // ---------- результат ----------
  function finish() {
    const s = session;
    const step = s.step;
    const timeMs = Date.now() - s.start;
    const total = s.correct + s.wrong;
    const accuracy = total ? Math.round((s.correct / total) * 100) : 100;
    const perfect = s.wrong === 0;

    if (window.GE.STEP_BY_ID.has(step.id) && !state.game.completedNodes.includes(step.id)) {
      state.game.completedNodes.push(step.id);
    }
    if (perfect) state.game.perfectLessons += 1;

    const baseXp = 10 + (perfect ? 5 : 0);
    const xp = grantXp(baseXp);
    const streak = touchStreak();
    save();

    Sfx.complete();
    renderResult({ step, xp, accuracy, timeMs, perfect, streak, boost: baseXp !== xp });
  }

  function renderResult({ step, xp, accuracy, timeMs, perfect, streak, boost }) {
    setProgress(100);
    const content = $('#lesson-content');
    content.className = 'lesson-content lesson-content--center';
    $('#lesson-footer').innerHTML = '';

    const confetti = Array.from({ length: 26 })
      .map((_, i) => {
        const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff', '#ff4b4b'];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 7;
        return `<span class="confetti" style="left:${left}%;background:${color};width:${size}px;height:${size * 1.6}px;animation-delay:${delay}s"></span>`;
      })
      .join('');

    content.innerHTML = `
      <div class="confetti-layer">${confetti}</div>
      <div class="result">
        <div class="result__owl">${owlSvg(132, 'happy')}</div>
        <h1 class="result__title">${perfect ? 'Идеально!' : 'Урок завершён!'}</h1>
        <p class="result__sub">${escapeHtml(step.title)}</p>

        <div class="result__stats">
          <div class="result-stat result-stat--xp">
            <b>+${xp} XP</b><span>${boost ? 'двойной опыт ⚡' : 'опыт'}</span>
          </div>
          <div class="result-stat result-stat--acc">
            <b>${accuracy}%</b><span>точность</span>
          </div>
          <div class="result-stat result-stat--time">
            <b>${fmtTime(timeMs)}</b><span>время</span>
          </div>
        </div>

        <div class="result__chips">
          <span class="pill pill--fire">🔥 ${streak.count} ${streak.count === 1 ? 'день' : 'дня'} серия</span>
          <span class="pill pill--gem">💎 +5</span>
          ${streak.shielded ? '<span class="pill">🛡️ заморозка использована</span>' : ''}
        </div>

        <button class="btn btn-3d btn--green btn--wide result__btn" data-finish>ПРОДОЛЖИТЬ</button>
      </div>`;

    $('[data-finish]', content).onclick = () => {
      Sfx.click();
      const onDone = session && session.onDone;
      close();
      if (onDone) onDone();
    };
  }

  function openReward(step, opts = {}) {
    if (!root) root = $('#lesson-root');
    if (window.GE.STEP_BY_ID.has(step.id) && !state.game.completedNodes.includes(step.id)) {
      state.game.completedNodes.push(step.id);
    }
    const gems = step.type === 'chest' ? 30 : 60;
    state.game.gems += gems;
    save();
    Sfx.chest();
    renderRewardScreen(step, gems, opts);
  }

  function renderRewardScreen(step, gems, opts) {
    root.classList.add('is-open');
    document.body.classList.add('lesson-open');
    root.innerHTML = `
      <div class="lesson-screen">
        <header class="lesson-top">
          <button class="icon-btn" data-exit aria-label="Закрыть">✕</button>
          <div class="lesson-bar"><div class="lesson-bar__fill" style="width:100%"><span></span></div></div>
          ${heartsHtml()}
        </header>
        <div class="lesson-content lesson-content--center">
          <div class="confetti-layer">${Array.from({ length: 22 }).map((_, i) => {
            const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff'];
            return `<span class="confetti" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random()}s"></span>`;
          }).join('')}</div>
          <div class="result">
            <div class="reward-icon">${step.type === 'chest' ? '🎁' : '🏆'}</div>
            <h1 class="result__title">${step.type === 'chest' ? 'Сундук открыт!' : 'Раздел пройден!'}</h1>
            <p class="result__sub">${escapeHtml(step.title)}</p>
            <div class="result__stats">
              <div class="result-stat"><b>+${gems} 💎</b><span>самоцветы</span></div>
            </div>
            <button class="btn btn-3d btn--green btn--wide result__btn" data-close-reward>ЗАБРАТЬ</button>
          </div>
        </div>
      </div>`;
    session = { step, onClose: opts.onClose || null, onDone: opts.onDone || null };
    $('[data-close-reward]', root).onclick = () => {
      Sfx.click();
      close();
      if (opts.onDone) opts.onDone();
    };
    $('[data-exit]', root).onclick = () => {
      close();
      if (opts.onDone) opts.onDone();
    };
  }

  function showOutOfHearts(step, opts = {}, resume = null) {
    if (!root) root = $('#lesson-root');
    root.classList.add('is-open');
    document.body.classList.add('lesson-open');
    const canBuy = state.game.gems >= 50;
    root.innerHTML = `
      <div class="lesson-screen">
        <header class="lesson-top">
          <button class="icon-btn" data-exit aria-label="Закрыть">✕</button>
          <div class="lesson-bar"><div class="lesson-bar__fill" style="width:${resume ? (resume.index / resume.items.length) * 100 : 4}%"><span></span></div></div>
          ${heartsHtml()}
        </header>
        <div class="lesson-content lesson-content--center">
          <div class="result">
            <div class="result__owl">${owlSvg(120, 'sad')}</div>
            <h1 class="result__title">Сердца закончились</h1>
            <p class="result__sub">Не расстраивайтесь! Восстановите сердца и продолжите урок.</p>
            <div class="result__stats">
              <div class="result-stat"><b>${state.game.gems} 💎</b><span>у вас есть</span></div>
              <div class="result-stat"><b>50 💎</b><span>полный запас</span></div>
            </div>
            <button class="btn btn-3d btn--green btn--wide result__btn" data-refill ${canBuy ? '' : 'disabled'}>
              ${canBuy ? 'ВОССТАНОВИТЬ ЗА 50 💎' : 'НЕ ХВАТАЕТ САМОЦВЕТОВ'}
            </button>
            <button class="btn btn-3d btn--gray btn--wide" data-quit style="margin-top:10px">ВЫЙТИ НА ПУТЬ</button>
            <p class="muted-small">Сердца также восстанавливаются сами: 1 сердце каждые 30 минут.</p>
          </div>
        </div>
      </div>`;

    $('[data-exit]', root).onclick = () => {
      close();
      if (opts.onClose) opts.onClose();
    };
    $('[data-quit]', root).onclick = () => {
      close();
      if (opts.onClose) opts.onClose();
    };
    const refill = $('[data-refill]', root);
    if (refill) {
      refill.onclick = () => {
        if (state.game.gems < 50) return;
        state.game.gems -= 50;
        addHearts(HEART_MAX);
        save();
        Sfx.correct();
        if (resume) {
          session = resume;
          session.failed = false;
          root.innerHTML = '';
          renderFrame();
          renderItem();
        } else {
          close();
          open(step, opts);
        }
      };
    }
  }

  window.GE.Lesson = { open, close };
})();
