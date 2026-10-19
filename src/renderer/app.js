/* Guide English — интерфейс: путь, практика, справочник, словарь, профиль,
   магазин, настройки, поиск и автообновления. */
(function () {
  'use strict';

  const GE = window.GE;
  const {
    GRAMMAR, COURSE, ALL_LESSONS, ALL_WORDS, VOCAB, SHOP_ITEMS,
    STEPS, STEP_BY_ID, state, tts, Sfx, owlSvg,
    escapeHtml, formatInline, shuffle, plural, findTopic, findListening, findVocabSet,
    isNodeDone, isNodeUnlocked, isUnitUnlocked, courseProgress,
    lessonsDone, listeningDone, wordsKnownCount, levelInfo,
    streakActiveToday, boostLeft, boostMultiplier, nextHeartIn,
    unlockedAchievements, achievementStats, save, resetAll,
    regenerateHearts, addHearts, HEART_MAX, todayKey, formatMinutes, hasElectron,
    applyTheme
  } = GE;

  const routes = {};
  let currentRoute = 'learn';
  let searchTimer = null;

  // ======================================================================
  // helpers
  // ======================================================================
  function toast(message, type = 'info', ms = 3200) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    }, ms);
  }

  function openModal(html, opts = {}) {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-card ${opts.wide ? 'modal-card--wide' : ''}">${html}</div>`;
    root.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelectorAll('[data-close]').forEach((btn) => { btn.onclick = close; });
    return { backdrop, card: backdrop.firstElementChild, close };
  }

  function navigate(route) {
    if (!routes[route]) route = 'learn';
    currentRoute = route;
    if (location.hash !== `#${route}`) {
      try { history.pushState({}, '', `#${route}`); } catch (e) { location.hash = route; }
    }
    render();
  }

  function startStep(step) {
    if (!step) return;
    GE.Lesson.open(step, { onDone: () => render() });
  }

  function startPseudoLesson(type, ref, title) {
    GE.Lesson.open(
      { id: `practice-${type}-${ref || 'mixed'}`, type, ref: ref || null, title },
      { onDone: () => render() }
    );
  }

  // ======================================================================
  // shell
  // ======================================================================
  function render() {
    const view = document.getElementById('view');
    if (!view) return;
    view.innerHTML = '';
    const fn = routes[currentRoute] || routes.learn;
    fn(view);
    updateShell();
    updateNav();
  }

  function updateNav() {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.route === currentRoute);
    });
  }

  function updateShell() {
    const level = levelInfo();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('stat-streak', state.game.streak.count);
    setText('stat-gems', state.game.gems);
    setText('stat-hearts', state.game.hearts.count);
    setText('stat-xp', state.game.xp);
    setText('avatar-level', level.level);

    const goal = Math.max(1, Number(state.settings.dailyGoal) || 20);
    const daily = state.game.daily.xp || 0;
    const ratio = Math.min(1, daily / goal);

    const ring = document.getElementById('goal-ring');
    if (ring) ring.style.strokeDashoffset = String(113.1 * (1 - ratio));
    setText('goal-text', `${daily} / ${goal} XP`);

    const railRing = document.getElementById('daily-ring-fg');
    if (railRing) railRing.style.strokeDashoffset = String(251.3 * (1 - ratio));
    setText('daily-xp', `${daily} XP`);

    document.querySelectorAll('.js-hearts-count').forEach((el) => { el.textContent = state.game.hearts.count; });
    document.querySelectorAll('.js-hearts-timer').forEach((el) => {
      el.textContent = state.game.hearts.count >= HEART_MAX
        ? 'Полный запас'
        : `+1 через ${formatMinutes(nextHeartIn())}`;
    });
    document.querySelectorAll('.js-gems').forEach((el) => { el.textContent = state.game.gems; });
    document.querySelectorAll('.js-streak').forEach((el) => { el.textContent = state.game.streak.count; });
    document.querySelectorAll('.js-boost').forEach((el) => {
      el.textContent = boostLeft() > 0 ? `×2 XP ещё ${formatMinutes(boostLeft())}` : '×2 XP не активен';
    });
  }

  // ======================================================================
  // LEARN — путь
  // ======================================================================
  function findCurrentStep() {
    return STEPS.find((s) => isNodeUnlocked(s) && !isNodeDone(s)) || null;
  }

  function heroHtml(current) {
    const p = courseProgress();
    const name = current ? current.title : 'Курс пройден';
    return `
      <section class="hero-card">
        <div class="hero-card__owl">${owlSvg(86)}</div>
        <div class="hero-card__main">
          <h2>${current ? 'Продолжаем учиться!' : 'Курс пройден — вы молодец!'}</h2>
          <p>${current
            ? `Следующий шаг: <b>${escapeHtml(name)}</b>. ${p.done} из ${p.total} уроков уже позади.`
            : `Все ${p.total} уроков пройдены. Повторите сложные темы в «Практике» или начните курс заново.`}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn-3d btn--green btn--small" data-hero-start>
              ${current ? 'ПРОДОЛЖИТЬ' : 'ПОВТОРИТЬ КУРС'}
            </button>
            <button class="btn-3d btn--gray btn--small" data-hero-practice>ПРАКТИКА</button>
          </div>
        </div>
      </section>`;
  }

  function dailyCardHtml() {
    const goal = Math.max(1, Number(state.settings.dailyGoal) || 20);
    const daily = state.game.daily.xp || 0;
    const ratio = Math.min(1, daily / goal);
    return `
      <section class="card daily-card">
        <div class="daily-card__ring">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle class="ring-bg" cx="48" cy="48" r="40"></circle>
            <circle class="ring-fg" id="daily-ring-fg" cx="48" cy="48" r="40"
              style="stroke-dashoffset:${251.3 * (1 - ratio)}"></circle>
          </svg>
          <span>${daily >= goal ? '🏆' : '🎯'}</span>
        </div>
        <h3>Дневная цель</h3>
        <p>${daily >= goal ? 'Цель выполнена! Отличная работа.' : 'Занимайтесь каждый день, чтобы держать серию.'}</p>
        <div class="daily-card__xp" id="daily-xp">${daily} XP из ${goal}</div>
      </section>`;
  }

  function railCardHtml() {
    const p = courseProgress();
    return `
      <section class="card rail-card">
        <h3>Ваш прогресс</h3>
        <div class="rail-row"><span>🔥 Серия</span><b class="js-streak">${state.game.streak.count}</b></div>
        <div class="rail-row"><span>❤️ Сердца</span><b><span class="js-hearts-count">${state.game.hearts.count}</span> / ${HEART_MAX}</b></div>
        <div class="rail-row"><span>💎 Самоцветы</span><b class="js-gems">${state.game.gems}</b></div>
        <div class="rail-row"><span>📚 Уроки</span><b>${p.done} / ${p.total}</b></div>
        <div class="rail-row"><span>⚡ Буст</span><b class="js-boost" style="font-size:11px">${boostLeft() > 0 ? `×2 XP ещё ${formatMinutes(boostLeft())}` : 'не активен'}</b></div>
        <div class="rail-row"><span>🃏 Слова</span><b>${wordsKnownCount()} / ${ALL_WORDS.length}</b></div>
      </section>`;
  }

  function pathGeometry(count) {
    const stepY = 128;
    const startY = 46;
    const height = startY + (count - 1) * stepY + 120;
    const xPattern = [50, 72, 50, 28];
    const points = Array.from({ length: count }).map((_, i) => ({
      x: xPattern[i % xPattern.length],
      y: startY + i * stepY
    }));
    let d = '';
    points.forEach((p, i) => {
      if (i === 0) {
        d += `M ${p.x} ${p.y}`;
      } else {
        const prev = points[i - 1];
        const midY = (prev.y + p.y) / 2;
        d += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      }
    });
    return { points, height, d };
  }

  function nodeHtml(step, point, index, current) {
    const done = isNodeDone(step.id);
    const unlocked = isNodeUnlocked(step);
    const isCurrent = current && current.id === step.id;

    let cls = 'node';
    let icon = step.icon || '📘';
    if (done) {
      cls += ' node--done';
      icon = '✓';
    } else if (isCurrent) {
      cls += ' node--current';
    } else if (!unlocked) {
      cls += ' node--locked';
    } else if (step.type === 'chest' || step.type === 'trophy') {
      cls += ' node--reward';
    }
    return `
      <div class="node-wrap ${isCurrent ? 'node-wrap--current' : ''}" style="left:${point.x}%;top:${point.y}px">
        ${isCurrent ? '<div class="start-bubble">НАЧАТЬ</div>' : ''}
        <button class="${cls}" data-step="${escapeHtml(step.id)}" aria-label="${escapeHtml(step.title)}">
          <span class="node__icon">${icon}</span>
        </button>
        <div class="node-label">${escapeHtml(step.title)}</div>
      </div>`;
  }

  function unitHtml(unit, index, current) {
    const unlocked = isUnitUnlocked(index);
    const unitSteps = STEPS.filter((s) => s.unitId === unit.id);
    const allDone = unitSteps.every((s) => isNodeDone(s.id));
    const { points, height, d } = pathGeometry(unitSteps.length);

    return `
      <section class="unit" data-unit="${escapeHtml(unit.id)}">
        <div class="unit-banner unit-banner--${unit.color} ${unlocked ? '' : 'unit-banner--locked'}">
          <div>
            <div class="unit-banner__kicker">Раздел ${index + 1}${allDone ? ' · пройден ✓' : ''}</div>
            <h2 class="unit-banner__title">${escapeHtml(unit.title)}</h2>
            <div class="unit-banner__sub">${escapeHtml(unit.subtitle)}</div>
          </div>
          <button class="unit-banner__guide" data-guide="${index}">СПРАВОЧНИК</button>
        </div>

        <div class="path-canvas" style="height:${height}px">
          <svg class="path-line" viewBox="0 0 ${100} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${d}"></path>
          </svg>
          ${unitSteps.map((step, i) => nodeHtml(step, points[i], i, current)).join('')}
        </div>
      </section>`;
  }

  routes.learn = (root) => {
    const current = findCurrentStep();
    const p = courseProgress();

    root.innerHTML = `
      <div class="learn-layout">
        <div class="learn-main">
          ${heroHtml(current)}
          ${COURSE.map((unit, i) => unitHtml(unit, i, current)).join('')}
          <div class="course-end">
            ${p.done === p.total
              ? '🏆 Все уроки курса пройдены. Отличная работа!'
              : `Пройдено ${p.done} из ${p.total} уроков · A0–B1`}
          </div>
        </div>
        <aside class="learn-rail">
          ${dailyCardHtml()}
          ${railCardHtml()}
        </aside>
      </div>`;

    const heroStart = root.querySelector('[data-hero-start]');
    if (heroStart) {
      heroStart.onclick = () => {
        Sfx.click();
        if (current) startStep(current);
        else navigate('practice');
      };
    }
    const heroPractice = root.querySelector('[data-hero-practice]');
    if (heroPractice) heroPractice.onclick = () => navigate('practice');

    root.querySelectorAll('[data-step]').forEach((btn) => {
      btn.onclick = () => {
        const step = STEP_BY_ID.get(btn.dataset.step);
        if (!step) return;
        if (!isNodeUnlocked(step)) {
          btn.classList.add('node--shake');
          setTimeout(() => btn.classList.remove('node--shake'), 400);
          Sfx.wrong();
          toast('Сначала пройдите предыдущий урок', 'warn');
          return;
        }
        Sfx.click();
        startStep(step);
      };
    });

    root.querySelectorAll('[data-guide]').forEach((btn) => {
      btn.onclick = () => openUnitGuide(Number(btn.dataset.guide));
    });
  };

  // ======================================================================
  // Справочник раздела
  // ======================================================================
  function openUnitGuide(unitIndex) {
    const unit = COURSE[unitIndex];
    if (!unit) return;
    const rows = unit.steps
      .filter((s) => s.type === 'grammar' || s.type === 'listening')
      .map((step) => {
        if (step.type === 'grammar') {
          const topic = findTopic(step.ref);
          if (!topic) return '';
          return `<button class="search-hit" data-topic="${escapeHtml(topic.id)}">
            <span style="font-size:20px">${escapeHtml(topic.icon)}</span>
            <span>${escapeHtml(topic.title)}<small>${escapeHtml(topic.summary)}</small></span>
          </button>`;
        }
        const lesson = findListening(step.ref);
        if (!lesson) return '';
        return `<button class="search-hit" data-listening="${escapeHtml(lesson.id)}">
          <span style="font-size:20px">🎧</span>
          <span>${escapeHtml(lesson.title)}<small>Аудирование · ${escapeHtml(lesson.duration)}</small></span>
        </button>`;
      })
      .join('');

    const { card } = openModal(`
      <button class="icon-btn modal-close" data-close aria-label="Закрыть">✕</button>
      <div class="lesson-kicker">Справочник раздела</div>
      <h2>${escapeHtml(unit.title)}</h2>
      <p>${escapeHtml(unit.subtitle)}</p>
      <div style="text-align:left">${rows || '<p class="muted">В этом разделе нет теоретических материалов.</p>'}</div>
    `);

    card.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.onclick = () => {
        const topic = findTopic(btn.dataset.topic);
        if (topic) openReader(topic);
      };
    });
    card.querySelectorAll('[data-listening]').forEach((btn) => {
      btn.onclick = () => {
        const lesson = findListening(btn.dataset.listening);
        if (lesson) openListeningReader(lesson);
      };
    });
  }

  function openReader(topic) {
    const c = topic.content;
    const step = GE.lessonStepFor('grammar', topic.id);
    const { card } = openModal(`
      <button class="icon-btn modal-close" data-close aria-label="Закрыть">✕</button>
      <div class="lesson-kicker">${escapeHtml(topic.level)} · ${topic.estMinutes} мин</div>
      <h2>${escapeHtml(topic.icon)} ${escapeHtml(topic.title)}</h2>
      <p>${escapeHtml(topic.summary)}</p>
      <div class="reader">
        <div class="reader__rule">${c.rule}</div>
        ${c.table ? `<div class="table-wrap"><table>
          <thead><tr>${c.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${c.table.rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>` : ''}
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
        <button class="btn-3d btn--green btn--wide" style="margin-top:18px" data-practice>
          ${step ? 'ПОТРЕНИРОВАТЬ ТЕМУ' : 'ПОТРЕНИРОВАТЬСЯ'}
        </button>
      </div>
    `, { wide: true });

    card.querySelectorAll('[data-say]').forEach((btn) => {
      btn.onclick = () => tts.speak(btn.dataset.say);
    });
    const practice = card.querySelector('[data-practice]');
    if (practice) {
      practice.onclick = () => {
        card.closest('.modal-backdrop').remove();
        if (step) startStep(step);
        else startPseudoLesson('grammar', topic.id, topic.title);
      };
    }
  }

  function openListeningReader(lesson) {
    const step = GE.lessonStepFor('listening', lesson.id);
    const { card } = openModal(`
      <button class="icon-btn modal-close" data-close aria-label="Закрыть">✕</button>
      <div class="lesson-kicker">Аудирование · ${escapeHtml(lesson.levelTitle || '')} · ${escapeHtml(lesson.duration)}</div>
      <h2>🎧 ${escapeHtml(lesson.title)}</h2>
      <p>${escapeHtml(lesson.scriptTips || '')}</p>
      <div class="listen-text"><p>${escapeHtml(lesson.textEn)}</p></div>
      <div class="tip-card" style="margin-bottom:16px">${escapeHtml(lesson.textRu)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-3d btn--blue btn--small" data-play>🔊 ПРОСЛУШАТЬ</button>
        <button class="btn-3d btn--green btn--small" data-practice>ПРОЙТИ УРОК</button>
      </div>
    `, { wide: true });

    card.querySelector('[data-play]').onclick = () => tts.speak(lesson.textEn);
    card.querySelector('[data-practice]').onclick = () => {
      card.closest('.modal-backdrop').remove();
      if (step) startStep(step);
      else startPseudoLesson('listening', lesson.id, lesson.title);
    };
  }

  // ======================================================================
  // PRACTICE
  // ======================================================================
  routes.practice = (root) => {
    const mistakes = (state.game.mistakes || []).length;
    const p = courseProgress();
    root.innerHTML = `
      <div class="page-head page-head--row">
        <div>
          <h1 class="page-title">Практика</h1>
          <p class="page-sub">Закрепите материал: смешанные вопросы, ошибки и аудирование.</p>
        </div>
        <span class="pill pill--yellow">⚡ +10 XP за урок</span>
      </div>

      <div class="tile-grid">
        <button class="tile tile--green" data-do="mixed">
          <span class="tile__icon">🧩</span>
          <span class="tile__title">Смешанная тренировка</span>
          <span class="tile__text">8 случайных вопросов из грамматики, аудирования и словаря.</span>
        </button>
        <button class="tile tile--orange" data-do="mistakes" ${mistakes ? '' : 'disabled'}>
          <span class="tile__icon">🔁</span>
          <span class="tile__title">Работа над ошибками</span>
          <span class="tile__text">${mistakes ? `${mistakes} ${plural(mistakes, 'вопрос', 'вопроса', 'вопросов')} из прошлых уроков.` : 'Сначала ошибитесь в уроке — вопросы появятся здесь.'}</span>
        </button>
        <button class="tile tile--blue" data-do="listening">
          <span class="tile__icon">🎧</span>
          <span class="tile__title">Аудирование</span>
          <span class="tile__text">Случайный урок на понимание на слух.</span>
        </button>
        <button class="tile tile--purple" data-do="vocab">
          <span class="tile__icon">🃏</span>
          <span class="tile__title">Словарный запас</span>
          <span class="tile__text">Быстрая викторина по словам из словаря.</span>
        </button>
        <button class="tile tile--yellow" data-do="grammar">
          <span class="tile__icon">📖</span>
          <span class="tile__title">Грамматика</span>
          <span class="tile__text">Случайная тема: правило и упражнения.</span>
        </button>
      </div>

      <section class="card" style="margin-top:22px">
        <h3 class="card__title">Как это работает</h3>
        <p class="card__text">
          Практика даёт опыт и самоцветы, но не продвигает по основному пути.
          Ошибки запоминаются — используйте «Работу над ошибками», чтобы не повторять их.
          Пройдено ${p.done} из ${p.total} уроков курса.
        </p>
      </section>
    `;

    const handlers = {
      mixed: () => startPseudoLesson('practice', null, 'Смешанная тренировка'),
      mistakes: () => startPseudoLesson('mistakes', null, 'Работа над ошибками'),
      listening: () => {
        const lesson = shuffle(ALL_LESSONS)[0];
        const step = GE.lessonStepFor('listening', lesson.id);
        if (step) startStep(step);
        else startPseudoLesson('listening', lesson.id, lesson.title);
      },
      vocab: () => {
        const set = shuffle(VOCAB)[0];
        startPseudoLesson('vocab', set.id, set.title);
      },
      grammar: () => {
        const topic = shuffle(GRAMMAR)[0];
        const step = GE.lessonStepFor('grammar', topic.id);
        if (step) startStep(step);
        else startPseudoLesson('grammar', topic.id, topic.title);
      }
    };

    root.querySelectorAll('[data-do]').forEach((btn) => {
      btn.onclick = () => {
        Sfx.click();
        handlers[btn.dataset.do]();
      };
    });
  };

  // ======================================================================
  // REFERENCE
  // ======================================================================
  routes.reference = (root) => {
    root.innerHTML = `
      <div class="page-head page-head--row">
        <div>
          <h1 class="page-title">Справочник</h1>
          <p class="page-sub">Все правила с объяснениями на русском, таблицами и примерами.</p>
        </div>
        <span class="pill pill--blue">${GRAMMAR.length} тем · A0–B1</span>
      </div>

      <div class="topic-grid">
        ${GRAMMAR.map((t) => `
          <button class="topic-card" data-topic="${escapeHtml(t.id)}">
            <div class="topic-card__head">
              <span class="topic-card__icon">${escapeHtml(t.icon)}</span>
              <div>
                <h3 class="topic-card__title">${escapeHtml(t.title)}</h3>
                <div class="topic-card__meta">
                  <span class="pill pill--green">${escapeHtml(t.level)}</span>
                  <span class="pill">${t.estMinutes} мин</span>
                </div>
              </div>
            </div>
            <p class="topic-card__summary">${escapeHtml(t.summary)}</p>
            <div class="topic-card__foot">
              <span class="pill pill--blue">Читать правило →</span>
            </div>
          </button>`).join('')}
      </div>
    `;

    root.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.onclick = () => {
        const topic = findTopic(btn.dataset.topic);
        if (topic) openReader(topic);
      };
    });
  };

  // ======================================================================
  // VOCABULARY
  // ======================================================================
  routes.vocab = (root) => {
    root.innerHTML = `
      <div class="page-head page-head--row">
        <div>
          <h1 class="page-title">Словарь</h1>
          <p class="page-sub">Карточки с транскрипцией, озвучкой и примерами. Отмечайте знакомые слова.</p>
        </div>
        <span class="pill pill--green">${wordsKnownCount()} из ${ALL_WORDS.length} слов знаю</span>
      </div>

      ${VOCAB.map((set) => {
        const known = state.vocabKnown[set.id] || [];
        return `
          <div class="set-head">
            <h2>${escapeHtml(set.icon)} ${escapeHtml(set.title)} <span class="pill">${escapeHtml(set.level)}</span></h2>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="pill pill--green">${known.length}/${set.words.length}</span>
              <button class="btn-3d btn--blue btn--small" data-train="${escapeHtml(set.id)}">ТРЕНИРОВАТЬ</button>
            </div>
          </div>
          <div class="word-grid">
            ${set.words.map((w) => {
              const isKnown = known.includes(w.en);
              return `
                <div class="word-card">
                  <div class="word-card__top">
                    <div>
                      <div class="word-card__en">${escapeHtml(w.en)}</div>
                      <div class="word-card__ipa">${escapeHtml(w.ipa || '')}</div>
                    </div>
                    <button class="icon-btn icon-btn--audio" data-say="${escapeHtml(w.en)}" aria-label="Прослушать">🔊</button>
                  </div>
                  <div class="word-card__ru">${escapeHtml(w.ru)}</div>
                  <div class="word-card__ex">${escapeHtml(w.ex)}</div>
                  <button class="word-card__know ${isKnown ? 'is-known' : ''}"
                    data-known="${escapeHtml(set.id)}::${escapeHtml(w.en)}">
                    ${isKnown ? '✓ ЗНАЮ' : 'ОТМЕТИТЬ «ЗНАЮ»'}
                  </button>
                </div>`;
            }).join('')}
          </div>`;
      }).join('')}
    `;

    root.querySelectorAll('[data-say]').forEach((btn) => {
      btn.onclick = () => tts.speak(btn.dataset.say);
    });
    root.querySelectorAll('[data-train]').forEach((btn) => {
      btn.onclick = () => {
        const set = findVocabSet(btn.dataset.train);
        if (!set) return;
        Sfx.click();
        startPseudoLesson('vocab', set.id, set.title);
      };
    });
    root.querySelectorAll('[data-known]').forEach((btn) => {
      btn.onclick = () => {
        const [setId, word] = btn.dataset.known.split('::');
        const arr = state.vocabKnown[setId] || [];
        if (arr.includes(word)) {
          state.vocabKnown[setId] = arr.filter((w) => w !== word);
        } else {
          state.vocabKnown[setId] = [...arr, word];
          Sfx.correct();
        }
        save();
        render();
      };
    });
  };

  // ======================================================================
  // PROFILE
  // ======================================================================
  routes.profile = (root) => {
    const level = levelInfo();
    const p = courseProgress();
    const stats = achievementStats();
    const achievements = unlockedAchievements();
    const streakDays = Array.from({ length: 7 }).map((_, i) => i < Math.min(7, state.game.streak.count));

    root.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">Профиль</h1>
        <p class="page-sub">Ваш прогресс, достижения и серия занятий.</p>
      </div>

      <section class="profile-head">
        <div class="profile-head__owl">${owlSvg(92)}</div>
        <div class="profile-head__main">
          <h1>Ученик</h1>
          <p>Уровень ${level.level} · ${state.game.xp} XP всего</p>
          <div class="level-bar"><div class="level-bar__fill" style="width:${Math.min(100, (level.inLevel / level.next) * 100)}%"></div></div>
          <div class="level-caption"><span>${level.inLevel} / ${level.next} XP</span><span>до уровня ${level.level + 1}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <span class="pill pill--fire">🔥 Серия: ${state.game.streak.count} ${plural(state.game.streak.count, 'день', 'дня', 'дней')}</span>
          <span class="pill pill--gem">💎 ${state.game.gems} самоцветов</span>
        </div>
      </section>

      <div class="stats-grid">
        <div class="stat-card stat-card--green">
          <div class="stat-card__label">Уроки</div>
          <div class="stat-card__value">${p.done} / ${p.total}</div>
        </div>
        <div class="stat-card stat-card--fire">
          <div class="stat-card__label">Серия</div>
          <div class="stat-card__value">🔥 ${state.game.streak.count}</div>
        </div>
        <div class="stat-card stat-card--gem">
          <div class="stat-card__label">Опыт</div>
          <div class="stat-card__value">${state.game.xp} XP</div>
        </div>
        <div class="stat-card stat-card--heart">
          <div class="stat-card__label">Слова</div>
          <div class="stat-card__value">${stats.wordsKnown} / ${ALL_WORDS.length}</div>
        </div>
      </div>

      <section class="card" style="margin-bottom:18px">
        <h3 class="card__title">Последние 7 дней</h3>
        <p class="card__text">Занимайтесь каждый день, чтобы увеличивать серию. Заморозку серии можно купить в магазине.</p>
        <div style="display:flex;gap:10px;margin-top:14px">
          ${streakDays.map((active, i) => `
            <div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:16px;border:2px solid ${active ? 'var(--orange)' : 'var(--line)'};background:${active ? '#fff0e6' : 'transparent'}">
              ${active ? '🔥' : '<span style="opacity:.25">•</span>'}
            </div>`).join('')}
        </div>
      </section>

      <div class="page-head page-head--row" style="margin-top:26px">
        <div>
          <h2 class="page-title" style="font-size:22px">Достижения</h2>
          <p class="page-sub">${achievements.filter((a) => a.unlocked).length} из ${achievements.length} открыто</p>
        </div>
      </div>
      <div class="achievements">
        ${achievements.map((a) => `
          <div class="achievement ${a.unlocked ? '' : 'is-locked'}">
            <div class="achievement__icon">${a.unlocked ? a.icon : '🔒'}</div>
            <div>
              <div class="achievement__title">${escapeHtml(a.title)}</div>
              <div class="achievement__desc">${escapeHtml(a.desc)}</div>
            </div>
          </div>`).join('')}
      </div>
    `;
  };

  // ======================================================================
  // SHOP
  // ======================================================================
  routes.shop = (root) => {
    const hearts = state.game.hearts.count;
    const boost = boostLeft();
    const shield = state.game.shield;
    const items = SHOP_ITEMS.map((item) => {
      let disabled = state.game.gems < item.price;
      let note = '';
      if (item.type === 'hearts') {
        if (hearts >= HEART_MAX) { disabled = true; note = 'Сердца полны'; }
        else note = `Сейчас ${hearts} из ${HEART_MAX}`;
      }
      if (item.type === 'boost') {
        if (boost > 0) { disabled = true; note = `Активен ещё ${formatMinutes(boost)}`; }
        else note = 'Следующие 15 минут';
      }
      if (item.type === 'shield') {
        if (shield >= 2) { disabled = true; note = 'Максимум 2 заморозки'; }
        else note = `Заморозок: ${shield}`;
      }
      return { ...item, disabled, note };
    });

    root.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">Магазин</h1>
        <p class="page-sub">Тратьте самоцветы на сердца, бусты и защиту серии.</p>
      </div>

      <section class="gems-banner">
        <div class="gems-banner__icon">💎</div>
        <div style="flex:1">
          <h2><span class="js-gems">${state.game.gems}</span> самоцветов</h2>
          <p>+5 самоцветов за каждый пройденный урок и бонусы за сундуки.</p>
        </div>
      </section>

      <section class="card" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div>
          <h3 class="card__title">❤️ Сердца: <span class="js-hearts-count">${hearts}</span> из ${HEART_MAX}</h3>
          <p class="card__text js-hearts-timer">${hearts >= HEART_MAX ? 'Полный запас' : `+1 через ${formatMinutes(nextHeartIn())}`}</p>
        </div>
        <span class="pill pill--blue">1 сердце / 30 минут</span>
      </section>

      <div class="shop-grid">
        ${items.map((item) => `
          <div class="shop-item">
            <div class="shop-item__icon">${item.icon}</div>
            <div class="shop-item__title">${escapeHtml(item.title)}</div>
            <div class="shop-item__desc">${escapeHtml(item.desc)}${item.note ? `<br><b>${escapeHtml(item.note)}</b>` : ''}</div>
            <button class="shop-item__buy" data-buy="${item.id}" ${item.disabled ? 'disabled' : ''}>
              💎 ${item.price}
            </button>
          </div>`).join('')}
      </div>

      <section class="card" style="margin-top:22px">
        <h3 class="card__title">Зарабатывайте самоцветы</h3>
        <p class="card__text">
          Каждый урок (+10 XP и 5 💎), сундуки в пути (+30 💎) и финалы разделов (+60 💎).
          Не тратьте всё сразу — заморозка серии спасает вас в пропущенный день.
        </p>
      </section>
    `;

    root.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.onclick = () => buyItem(btn.dataset.buy);
    });
  };

  function buyItem(id) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return;
    if (state.game.gems < item.price) {
      toast('Не хватает самоцветов', 'warn');
      return;
    }
    if (item.type === 'hearts' && state.game.hearts.count >= HEART_MAX) {
      toast('Сердца уже полны', 'warn');
      return;
    }
    if (item.type === 'boost' && boostLeft() > 0) {
      toast('Буст уже активен', 'warn');
      return;
    }
    if (item.type === 'shield' && state.game.shield >= 2) {
      toast('Максимум 2 заморозки', 'warn');
      return;
    }

    state.game.gems -= item.price;
    if (item.type === 'hearts') addHearts(HEART_MAX);
    if (item.type === 'boost') state.game.boostUntil = Date.now() + 15 * 60 * 1000;
    if (item.type === 'shield') state.game.shield += 1;
    save();
    Sfx.chest();
    toast(`Куплено: ${item.title}`, 'success');
    render();
  }

  // ======================================================================
  // SETTINGS
  // ======================================================================
  function voiceOptions() {
    const voices = (state.voices && state.voices.length) ? state.voices : tts.loadVoices();
    if (!voices.length) return '<option value="">Голоса не найдены</option>';
    return voices.map((v) => {
      const selected = state.settings.voice === v.name ? 'selected' : '';
      return `<option value="${escapeHtml(v.name)}" ${selected}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`;
    }).join('');
  }

  routes.settings = (root) => {
    root.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">Настройки</h1>
        <p class="page-sub">Озвучка, внешний вид, обновления и данные.</p>
      </div>

      <div class="settings-grid">
        <section class="card">
          <h3 class="card__title">🔊 Аудирование и озвучка</h3>
          <div class="setting">
            <div>
              <div class="setting__label">Голос</div>
              <div class="setting__desc">Английский голос из установленных в Windows</div>
            </div>
            <select id="voiceSelect">${voiceOptions()}</select>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Скорость речи</div>
              <div class="setting__desc">0.5× — медленно, 1.0× — обычный темп</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <input id="rateRange" type="range" min="0.5" max="1.4" step="0.05" value="${Number(state.settings.rate) || 1}" />
              <span class="pill" id="rateVal">${(Number(state.settings.rate) || 1).toFixed(2)}×</span>
            </div>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Громкость</div>
              <div class="setting__desc">Громкость синтезатора речи</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <input id="volRange" type="range" min="0" max="1" step="0.05" value="${Number(state.settings.volume) || 1}" />
              <span class="pill" id="volVal">${Math.round((Number(state.settings.volume) || 1) * 100)}%</span>
            </div>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Звуковые эффекты</div>
              <div class="setting__desc">Короткие звуки за правильные и неправильные ответы</div>
            </div>
            <button class="switch ${state.settings.sound ? 'is-on' : ''}" id="soundToggle" aria-label="Звуковые эффекты"></button>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Проверить голос</div>
              <div class="setting__desc">Тестовая фраза на английском</div>
            </div>
            <button class="btn-3d btn--blue btn--small" id="testVoice">ПРОВЕРИТЬ</button>
          </div>
        </section>

        <section class="card">
          <h3 class="card__title">🎨 Внешний вид и цель</h3>
          <div class="setting">
            <div>
              <div class="setting__label">Тема</div>
              <div class="setting__desc">Светлая или тёмная</div>
            </div>
            <select id="themeSelect">
              <option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Светлая</option>
              <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
            </select>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Дневная цель</div>
              <div class="setting__desc">Сколько опыта набирать каждый день</div>
            </div>
            <select id="goalSelect">
              ${[10, 20, 30, 50].map((g) => `<option value="${g}" ${Number(state.settings.dailyGoal) === g ? 'selected' : ''}>${g} XP</option>`).join('')}
            </select>
          </div>
        </section>

        <section class="card">
          <h3 class="card__title">⬇️ Обновления</h3>
          <div class="setting">
            <div>
              <div class="setting__label">Текущая версия</div>
              <div class="setting__desc" id="versionLine">v0.2.0 • Windows</div>
            </div>
            <span class="pill pill--green" id="updateStatus">Проверка при запуске</span>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">Автоматические обновления</div>
              <div class="setting__desc">Проверка GitHub Releases при запуске и каждые 4 часа. При выходе новой версии — баннер и перезапуск в один клик.</div>
            </div>
            <button class="btn-3d btn--blue btn--small" id="checkUpdatesNow">ПРОВЕРИТЬ</button>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">История версий</div>
              <div class="setting__desc">Релизы и изменения — на GitHub</div>
            </div>
            <button class="btn-3d btn--gray btn--small" id="openReleases">RELEASES</button>
          </div>
        </section>

        <section class="card">
          <h3 class="card__title">💾 Данные</h3>
          <div class="setting">
            <div>
              <div class="setting__label">Прогресс</div>
              <div class="setting__desc">Хранится локально на компьютере: путь, XP, серия, сердца и слова. Сброс вернёт всё в начало.</div>
            </div>
            <button class="btn-3d btn--red btn--small" id="resetBtn">СБРОСИТЬ</button>
          </div>
          <div class="setting">
            <div>
              <div class="setting__label">О программе</div>
              <div class="setting__desc">Guide English — тренажёр английского с правилами и аудированием</div>
            </div>
            <button class="btn-3d btn--gray btn--small" id="aboutBtn">СВЕДЕНИЯ</button>
          </div>
        </section>
      </div>
    `;

    const voiceSelect = root.querySelector('#voiceSelect');
    voiceSelect.onchange = (e) => {
      state.settings.voice = e.target.value || null;
      save();
      toast('Голос сохранён', 'success');
    };

    const rate = root.querySelector('#rateRange');
    rate.oninput = () => {
      state.settings.rate = Number(rate.value);
      root.querySelector('#rateVal').textContent = Number(rate.value).toFixed(2) + '×';
      save();
    };

    const vol = root.querySelector('#volRange');
    vol.oninput = () => {
      state.settings.volume = Number(vol.value);
      root.querySelector('#volVal').textContent = Math.round(Number(vol.value) * 100) + '%';
      save();
    };

    const sound = root.querySelector('#soundToggle');
    sound.onclick = () => {
      state.settings.sound = !state.settings.sound;
      sound.classList.toggle('is-on', state.settings.sound);
      save();
      if (state.settings.sound) Sfx.correct();
    };

    root.querySelector('#testVoice').onclick = () => {
      tts.speak('Hello! This is Guide English. Let’s learn English together.');
    };

    root.querySelector('#themeSelect').onchange = (e) => {
      state.settings.theme = e.target.value;
      applyTheme();
      save();
    };

    root.querySelector('#goalSelect').onchange = (e) => {
      state.settings.dailyGoal = Number(e.target.value);
      save();
      updateShell();
      toast('Дневная цель обновлена', 'success');
    };

    root.querySelector('#checkUpdatesNow').onclick = () => {
      if (hasElectron && window.guideEnglish.checkForUpdates) {
        window.guideEnglish.checkForUpdates().then((r) => {
          if (r.ok) toast('Проверяем GitHub Releases…');
          else toast(r.error || 'Не удалось проверить обновления', 'warn');
        });
      } else {
        toast('В веб-режиме автообновление доступно только в установленной версии', 'warn');
      }
    };

    root.querySelector('#openReleases').onclick = () => openExternal('https://github.com/ignatus4405-glitch/guide_english/releases');
    root.querySelector('#aboutBtn').onclick = () => {
      showAbout();
    };
    root.querySelector('#resetBtn').onclick = () => confirmReset();

    if (hasElectron) {
      window.guideEnglish.getVersion().then((v) => {
        const line = root.querySelector('#versionLine');
        if (line) line.textContent = `v${v} • Windows`;
      }).catch(() => {});
    }
  };

  function showAbout() {
    const version = document.getElementById('app-version')?.textContent || '';
    openModal(`
      <div class="modal-card__owl">${owlSvg(96)}</div>
      <h2>Guide English</h2>
      <p>Тренажёр английского языка в формате игры: путь, сердца, серия и опыт — плюс настоящие правила с объяснениями и аудирование.<br>
      Маскот: сова Оли.<br>Версия ${escapeHtml(version)} · Windows 10/11</p>
      <div class="modal-card__actions">
        <button class="btn-3d btn--green btn--wide" data-close>ОТЛИЧНО</button>
        <button class="btn-3d btn--gray btn--wide" data-github>ОТКРЫТЬ GITHUB</button>
      </div>
    `).card.querySelector('[data-github]').onclick = () =>
      openExternal('https://github.com/ignatus4405-glitch/guide_english');
  }

  function confirmReset() {
    const { card } = openModal(`
      <div class="modal-card__owl">${owlSvg(84, 'sad')}</div>
      <h2>Сбросить прогресс?</h2>
      <p>Пропадут XP, серия, сердца, пройденные уроки и отмеченные слова. Это действие нельзя отменить.</p>
      <div class="modal-card__actions">
        <button class="btn-3d btn--gray btn--wide" data-close>ОСТАВИТЬ КАК ЕСТЬ</button>
        <button class="btn-3d btn--red btn--wide" data-confirm>СБРОСИТЬ ВСЁ</button>
      </div>
    `);
    card.querySelector('[data-confirm]').onclick = async () => {
      await resetAll();
      applyTheme();
      card.closest('.modal-backdrop').remove();
      toast('Прогресс сброшен', 'success');
      render();
    };
  }

  async function openExternal(url) {
    if (hasElectron && window.guideEnglish.openExternal) return window.guideEnglish.openExternal(url);
    window.open(url, '_blank');
  }

  // ======================================================================
  // SEARCH
  // ======================================================================
  function setupSearch() {
    const input = document.getElementById('globalSearch');
    const panel = document.getElementById('search-panel');
    if (!input || !panel) return;

    const closePanel = () => { panel.hidden = true; };
    const renderResults = (query) => {
      const q = query.trim().toLowerCase();
      if (q.length < 2) { closePanel(); return; }
      const topics = GRAMMAR.filter((t) => (t.title + ' ' + t.summary + ' ' + t.content.rule).toLowerCase().includes(q)).slice(0, 4);
      const lessons = ALL_LESSONS.filter((l) => (l.title + ' ' + l.textEn + ' ' + l.textRu).toLowerCase().includes(q)).slice(0, 3);
      const words = ALL_WORDS.filter((w) => (w.en + ' ' + w.ru).toLowerCase().includes(q)).slice(0, 4);

      if (!topics.length && !lessons.length && !words.length) {
        panel.innerHTML = '<div class="search-empty">Ничего не найдено. Попробуйте «артикль», «кафе» или «travel».</div>';
        panel.hidden = false;
        return;
      }

      panel.innerHTML = `
        ${topics.length ? `<div class="search-group__title">Грамматика</div>${topics.map((t) => `
          <button class="search-hit" data-search-topic="${escapeHtml(t.id)}">
            <span style="font-size:18px">${escapeHtml(t.icon)}</span>
            <span>${escapeHtml(t.title)}<small>${escapeHtml(t.level)} · правило</small></span>
          </button>`).join('')}` : ''}
        ${lessons.length ? `<div class="search-group__title">Аудирование</div>${lessons.map((l) => `
          <button class="search-hit" data-search-listening="${escapeHtml(l.id)}">
            <span style="font-size:18px">🎧</span>
            <span>${escapeHtml(l.title)}<small>${escapeHtml(l.levelTitle)} · ${escapeHtml(l.duration)}</small></span>
          </button>`).join('')}` : ''}
        ${words.length ? `<div class="search-group__title">Слова</div>${words.map((w) => `
          <button class="search-hit" data-search-word="${escapeHtml(w.en)}">
            <span style="font-size:18px">🃏</span>
            <span>${escapeHtml(w.en)} — ${escapeHtml(w.ru)}<small>${escapeHtml(w.ipa || '')}</small></span>
          </button>`).join('')}` : ''}
      `;
      panel.hidden = false;

      panel.querySelectorAll('[data-search-topic]').forEach((btn) => {
        btn.onclick = () => {
          closePanel();
          const topic = findTopic(btn.dataset.searchTopic);
          if (topic) openReader(topic);
        };
      });
      panel.querySelectorAll('[data-search-listening]').forEach((btn) => {
        btn.onclick = () => {
          closePanel();
          const lesson = findListening(btn.dataset.searchListening);
          if (lesson) openListeningReader(lesson);
        };
      });
      panel.querySelectorAll('[data-search-word]').forEach((btn) => {
        btn.onclick = () => {
          closePanel();
          const word = ALL_WORDS.find((w) => w.en === btn.dataset.searchWord);
          if (!word) return;
          openModal(`
            <button class="icon-btn modal-close" data-close aria-label="Закрыть">✕</button>
            <div style="text-align:center">
              <div style="font-size:30px;font-weight:900">${escapeHtml(word.en)}</div>
              <div class="muted" style="font-family:var(--mono);font-size:13px;margin:4px 0 10px">${escapeHtml(word.ipa || '')}</div>
              <div style="font-size:17px;font-weight:800">${escapeHtml(word.ru)}</div>
              <div class="word-card__ex" style="margin-top:14px">${escapeHtml(word.ex)}</div>
              <button class="btn-3d btn--blue btn--small" style="margin-top:14px" data-say>🔊 ПРОСЛУШАТЬ</button>
            </div>`).card.querySelector('[data-say]').onclick = () => tts.speak(word.en);
        };
      });
    };

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderResults(input.value), 180);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; closePanel(); input.blur(); }
      if (e.key === 'Enter') {
        const first = panel.querySelector('.search-hit');
        if (first && !panel.hidden) first.click();
      }
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('search')?.contains(e.target)) closePanel();
    });
  }

  // ======================================================================
  // UPDATER
  // ======================================================================
  function setupUpdater() {
    if (!hasElectron) return;
    const g = window.guideEnglish;
    const banner = document.getElementById('update-banner');
    const title = document.getElementById('update-title');
    const detail = document.getElementById('update-detail');
    const bar = document.querySelector('#update-progress .update-progress__bar');
    const installBtn = document.getElementById('update-installBtn');
    const closeBtn = document.getElementById('update-closeBtn');
    const status = () => document.getElementById('updateStatus');

    const show = () => banner && banner.classList.remove('hidden');

    if (closeBtn) closeBtn.onclick = () => banner.classList.add('hidden');
    if (installBtn) installBtn.onclick = () => g.quitAndInstall && g.quitAndInstall();

    g.onUpdaterChecking && g.onUpdaterChecking(() => toast('Проверяем обновления…'));
    g.onUpdaterAvailable && g.onUpdaterAvailable((info) => {
      show();
      if (title) title.textContent = `Доступна версия ${info.version}`;
      if (detail) detail.textContent = 'Скачиваем обновление с GitHub Releases…';
      if (installBtn) installBtn.classList.add('hidden');
      toast(`Вышла новая версия ${info.version}`, 'success');
    });
    g.onUpdaterProgress && g.onUpdaterProgress((p) => {
      show();
      if (detail) detail.textContent = `Загрузка обновления: ${Math.round(p.percent)}%`;
      if (bar) bar.style.width = `${Math.round(p.percent)}%`;
    });
    g.onUpdaterDownloaded && g.onUpdaterDownloaded((info) => {
      show();
      if (title) title.textContent = `Обновление ${info.version} загружено`;
      if (detail) detail.textContent = 'Перезапустите приложение, чтобы установить новую версию.';
      if (installBtn) installBtn.classList.remove('hidden');
      if (bar) bar.parentElement.classList.add('hidden');
      toast(`Обновление ${info.version} готово к установке`, 'success', 6000);
    });
    g.onUpdaterNotAvailable && g.onUpdaterNotAvailable(() => {
      if (status()) status().textContent = 'Последняя версия';
      toast('У вас последняя версия', 'success');
    });
    g.onUpdaterError && g.onUpdaterError(() => {
      if (status()) status().textContent = 'Ошибка проверки';
      toast('Не удалось проверить обновления', 'warn');
    });

    const manual = document.getElementById('check-updates-btn');
    if (manual) {
      manual.onclick = () => {
        g.checkForUpdates().then((r) => {
          if (r.ok) toast('Проверяем обновления…');
          else toast(r.error === 'Updater disabled in dev mode'
            ? 'Автообновления работают в установленной версии'
            : (r.error || 'Не удалось проверить обновления'), 'warn');
        });
      };
    }

    window.guideEnglish.getVersion().then((v) => {
      const el = document.getElementById('app-version');
      if (el) el.textContent = `v${v}`;
    }).catch(() => {});
  }

  // ======================================================================
  // boot
  // ======================================================================
  function bindShell() {
    document.querySelectorAll('[data-route]').forEach((el) => {
      if (el.classList.contains('nav-item')) {
        el.onclick = () => { Sfx.click(); navigate(el.dataset.route); };
      }
    });
    document.querySelectorAll('[data-goto]').forEach((el) => {
      el.onclick = () => navigate(el.dataset.goto);
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('globalSearch')?.focus();
      }
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-backdrop');
        if (modals.length) modals[modals.length - 1].remove();
      }
    });

    window.addEventListener('hashchange', () => {
      const route = (location.hash || '#learn').slice(1);
      if (routes[route] && route !== currentRoute) {
        currentRoute = route;
        render();
      }
    });

    document.addEventListener('voices-changed', () => {
      if (currentRoute === 'settings') render();
    });
  }

  function tick() {
    const changed = regenerateHearts();
    if (changed) updateShell();
    else updateShell();
    if (currentRoute === 'settings' && boostLeft() === 0) {
      const el = document.querySelector('.js-boost');
      if (el) el.textContent = '×2 XP не активен';
    }
  }

  async function boot() {
    await GE.loadState();
    applyTheme();

    const brand = document.getElementById('brand-owl');
    if (brand) brand.innerHTML = owlSvg(44);
    const avatar = document.getElementById('avatar-owl');
    if (avatar) avatar.innerHTML = owlSvg(38);

    bindShell();
    setupSearch();
    setupUpdater();

    const hash = (location.hash || '#learn').slice(1);
    currentRoute = routes[hash] ? hash : 'learn';

    render();
    if (!hasElectron) {
      const mode = document.getElementById('app-version');
      if (mode && !mode.textContent.trim()) mode.textContent = 'веб-версия';
    }

    const started = lessonsDone() > 0;
    if (!started) {
      setTimeout(() => toast('Сова Оли ждёт: нажмите на первый кружок, чтобы начать 🦉', 'info', 5000), 700);
    }

    setInterval(tick, 30000);
    window.__guideEnglish = { state, GE, navigate, render, currentRoute: () => currentRoute };
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
