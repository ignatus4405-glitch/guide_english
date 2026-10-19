/* Guide English — renderer logic
   Работает в Electron (window.guideEnglish) и в обычном браузере (localStorage fallback). */

(() => {
  'use strict';

  // ---------- Data ----------
  const GRAMMAR = window.GRAMMAR_TOPICS || [];
  const LISTENING = window.LISTENING_LEVELS || [];
  const VOCAB = window.VOCABULARY_SETS || [];

  const ALL_LESSONS = LISTENING.flatMap(lvl =>
    lvl.lessons.map(l => ({ ...l, levelId: lvl.id, levelTitle: lvl.title }))
  );

  // ---------- Store (Electron store or localStorage) ----------
  const hasElectron = !!window.guideEnglish;
  const LS_PREFIX = 'guide-english:';

  const Store = {
    available: hasElectron,
    async get(key, def) {
      try {
        if (hasElectron) {
          const v = await window.guideEnglish.storeGet(key, def);
          return v === null || v === undefined ? def : v;
        }
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (e) {
        console.warn('store.get failed', key, e);
        return def;
      }
    },
    async set(key, val) {
      try {
        if (hasElectron) return await window.guideEnglish.storeSet(key, val);
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
        return { ok: true };
      } catch (e) {
        console.warn('store.set failed', key, e);
        return { ok: false };
      }
    },
    async clear() {
      try {
        if (hasElectron) return await window.guideEnglish.clearProgress();
        localStorage.removeItem(LS_PREFIX + 'progress');
        localStorage.removeItem(LS_PREFIX + 'completedLessons');
        localStorage.removeItem(LS_PREFIX + 'vocabularyProgress');
        return { ok: true };
      } catch (e) {
        return { ok: false };
      }
    }
  };

  // ---------- Persistent state ----------
  const state = {
    progress: {},            // topicId -> { answers: {idx: 0|1|2}, correct: n, total: n }
    completedLessons: [],    // listening lesson ids
    vocabularyProgress: {},  // setId -> [en, en, ...]
    settings: {
      voice: null,
      rate: 0.95,
      volume: 1,
      theme: 'light',
      lastSection: 'dashboard'
    },
    voices: [],
    booted: false
  };

  async function loadState() {
    state.progress = (await Store.get('progress', {})) || {};
    state.completedLessons = (await Store.get('completedLessons', [])) || [];
    state.vocabularyProgress = (await Store.get('vocabularyProgress', {})) || {};
    const s = (await Store.get('settings', null)) || {};
    state.settings = { ...state.settings, ...s };
    applyTheme();
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  async function saveNow() {
    await Store.set('progress', state.progress);
    await Store.set('completedLessons', state.completedLessons);
    await Store.set('vocabularyProgress', state.vocabularyProgress);
    await Store.set('settings', state.settings);
  }

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(message, type = 'info', actionLabel, onAction, timeout = 5000) {
    const cont = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (actionLabel) {
      const btn = document.createElement('button');
      btn.textContent = actionLabel;
      btn.onclick = () => { onAction && onAction(); el.remove(); };
      el.appendChild(btn);
    }
    cont.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  // ---------- Text-to-speech ----------
  const tts = {
    synth: window.speechSynthesis,
    utterance: null,
    queue: [],
    active: false,
    token: 0,

    loadVoices() {
      if (!this.synth) return [];
      const all = this.synth.getVoices() || [];
      const en = all.filter(v => /^en(-|_|$)/i.test(v.lang));
      state.voices = en.length ? en : all;
      return state.voices;
    },

    pickVoice() {
      if (!this.synth) return null;
      if (state.settings.voice) {
        const found = (this.synth.getVoices() || []).find(v => v.name === state.settings.voice);
        if (found) return found;
      }
      this.loadVoices();
      const preferred = state.voices.find(v => /Google US English|Microsoft Aria|Microsoft Zira|Samantha|Daniel/i.test(v.name))
        || state.voices.find(v => /en-US/i.test(v.lang))
        || state.voices[0];
      return preferred || null;
    },

    speak(text, opts = {}) {
      if (!this.synth) {
        toast('Озвучка недоступна в этом окружении', 'warn');
        return null;
      }
      this.stop();
      const u = new window.SpeechSynthesisUtterance(text);
      const voice = opts.voice || this.pickVoice();
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || opts.lang || 'en-US';
      u.rate = opts.rate != null ? opts.rate : Number(state.settings.rate) || 1;
      u.volume = opts.volume != null ? opts.volume : Number(state.settings.volume) || 1;
      u.pitch = 1;
      if (opts.onBoundary) u.onboundary = opts.onBoundary;
      if (opts.onEnd) u.onend = opts.onEnd;
      if (opts.onError) u.onerror = opts.onError;
      this.utterance = u;
      this.active = true;
      this.synth.speak(u);
      return u;
    },

    stop() {
      if (!this.synth) return;
      this.token++;              // отменяет цепочку воспроизведения
      try { this.synth.cancel(); } catch (e) {}
      this.active = false;
    },

    pause() { try { this.synth && this.synth.pause(); } catch (e) {} },
    resume() { try { this.synth && this.synth.resume(); } catch (e) {} }
  };

  if (window.speechSynthesis) {
    tts.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      tts.loadVoices();
      // refresh voice select if settings page is open
      const sel = $('#voiceSelect');
      if (sel) sel.innerHTML = voiceOptionsHtml();
    };
  }

  function voiceOptionsHtml() {
    const voices = state.voices.length ? state.voices : tts.loadVoices();
    if (!voices.length) return `<option value="">Голоса не найдены</option>`;
    return voices.map(v => {
      const sel = state.settings.voice === v.name ? 'selected' : '';
      return `<option value="${escapeHtml(v.name)}" ${sel}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`;
    }).join('');
  }

  function speakWord(word) {
    tts.speak(word, { rate: Math.min(Number(state.settings.rate) || 1, 0.95) });
    toast(`🔊 ${word}`, 'info', null, null, 1600);
  }

  // ---------- Progress calculations ----------
  function topicStats(topic) {
    const p = state.progress[topic.id];
    const total = (topic.content.exercises || []).length;
    if (!p) return { answered: 0, correct: 0, total, done: false, percent: 0 };
    const answered = Object.keys(p.answers || {}).length;
    const correct = Object.values(p.answers || {}).filter(a => a === 'correct').length;
    return {
      answered, correct, total,
      done: total > 0 && answered >= total,
      percent: total ? Math.round((correct / total) * 100) : 0
    };
  }

  function overallPercent() {
    const grammarUnits = GRAMMAR.length * 2; // lesson + test
    const listeningUnits = ALL_LESSONS.length;
    const vocabWords = VOCAB.reduce((n, s) => n + s.words.length, 0);
    const vocabUnits = Math.max(1, Math.ceil(vocabWords / 10));

    let got = 0;
    GRAMMAR.forEach(t => {
      const st = topicStats(t);
      if (st.answered > 0) got += 1;
      if (st.done && st.percent === 100) got += 1;
    });
    got += state.completedLessons.length;
    const knownWords = Object.values(state.vocabularyProgress).reduce((n, arr) => n + (arr?.length || 0), 0);
    got += Math.min(vocabUnits, knownWords / 10);

    const totalUnits = grammarUnits + listeningUnits + vocabUnits;
    return Math.min(100, Math.round((got / Math.max(1, totalUnits)) * 100));
  }

  function lessonDone(id) {
    return state.completedLessons.includes(id);
  }

  // ---------- Router ----------
  const routes = {};

  function navigate(name, params = {}) {
    state.settings.lastSection = name;
    scheduleSave();
    const q = params.id ? `#${name}/${params.id}` : `#${name}`;
    try {
      history.pushState(params, '', q);
    } catch (e) {
      // file:// в некоторых конфигурациях запрещает pushState — откатываемся на hash
      try { location.hash = q; } catch (_) { /* noop */ }
    }
    render(name, params);
  }

  function parseHash() {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return { name: 'dashboard', params: {} };
    const [name, ...rest] = hash.split('/');
    if (name === 'grammar' && rest[0]) return { name: 'grammar', params: { id: rest[0] } };
    if (name === 'listening' && rest[0]) return { name: 'listening', params: { lessonId: rest[0] } };
    if (routes[name]) return { name, params: {} };
    return { name: 'dashboard', params: {} };
  }

  function render(name, params = {}) {
    const view = routes[name] || routes.dashboard;
    const appContent = $('#content');
    appContent.innerHTML = '';
    view(appContent, params);
    renderSidebarState(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSidebarState(activeName) {
    $$('.nav__item[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === activeName);
    });
    const pct = overallPercent();
    $('#overall-progress').textContent = pct + '%';
    $('#overall-progress-bar').style.width = pct + '%';
  }

  // ---------- Dashboard ----------
  routes.dashboard = (root) => {
    const pct = overallPercent();
    const topicsDone = GRAMMAR.filter(t => topicStats(t).percent === 100 && topicStats(t).done).length;
    const knownWords = Object.values(state.vocabularyProgress).reduce((n, arr) => n + (arr?.length || 0), 0);

    // find next topic
    const nextTopic = GRAMMAR.find(t => !topicStats(t).done) || GRAMMAR[0];
    const nextLesson = ALL_LESSONS.find(l => !lessonDone(l.id)) || ALL_LESSONS[0];

    root.innerHTML = `
      <div class="hero">
        <div class="hero__left">
          <h2>Английский — понятно и на слух</h2>
          <p>Правила с объяснениями на русском, живые примеры, аудирование с озвучкой и тренировка. Учитесь в своём темпе — прогресс сохраняется на компьютере.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn--primary" id="heroContinue">Продолжить обучение →</button>
            <button class="btn" id="heroListening">🎧 Аудирование</button>
          </div>
          <div class="hero__bullets">
            <span class="bullet">${GRAMMAR.length} тем грамматики</span>
            <span class="bullet">${ALL_LESSONS.length} уроков аудирования</span>
            <span class="bullet">${VOCAB.reduce((n, s) => n + s.words.length, 0)} слов</span>
            <span class="bullet">Автообновления</span>
          </div>
        </div>
        <div class="hero__right">
          <div class="hero__art">🎧📖💬</div>
        </div>
      </div>

      <div class="grid grid--3" style="margin-top:18px">
        ${statCard('Прогресс курса', pct + '%', 'Общий путь по программе', '📈')}
        ${statCard('Темы изучены', `${topicsDone} из ${GRAMMAR.length}`, 'Правила и тесты', '📚')}
        ${statCard('Слов в словаре', `${knownWords} / ${VOCAB.reduce((n, s) => n + s.words.length, 0)}`, 'Отмечено как «знаю»', '🃏')}
      </div>

      <div class="grid grid--2" style="margin-top:18px">
        <div class="card">
          <div class="card__head"><h3>Продолжить обучение</h3><span class="chip chip--primary">Рекомендуем</span></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:12px">
            <div class="lesson">
              <div class="lesson__icon">${escapeHtml(nextTopic.icon)}</div>
              <div class="lesson__main">
                <p class="lesson__title">${escapeHtml(nextTopic.title)}</p>
                <div class="lesson__meta">
                  <span>${escapeHtml(nextTopic.level)}</span> • <span>${nextTopic.estMinutes} мин</span>
                </div>
              </div>
              <button class="btn btn--primary btn--small" id="dashOpenTopic">Открыть</button>
            </div>
            <div class="lesson">
              <div class="lesson__icon">🎧</div>
              <div class="lesson__main">
                <p class="lesson__title">${escapeHtml(nextLesson.title)}</p>
                <div class="lesson__meta">
                  <span>${escapeHtml(nextLesson.levelTitle)}</span> • <span>${escapeHtml(nextLesson.duration)}</span>
                  ${lessonDone(nextLesson.id) ? '<span class="chip chip--success">Пройдено</span>' : ''}
                </div>
              </div>
              <button class="btn btn--small" id="dashOpenLesson">Слушать</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h3>Как работает программа</h3><span class="chip">Guide</span></div>
          <div class="card__pad" style="font-size:13px;line-height:1.6;color:#334155">
            <p style="margin:0 0 8px"><b>1. Правило.</b> Короткое объяснение на русском + таблица и примеры.</p>
            <p style="margin:0 0 8px"><b>2. Практика.</b> Тест по теме с разбором каждой ошибки.</p>
            <p style="margin:0 0 8px"><b>3. Аудирование.</b> Слушайте текст, меняйте скорость и голос, отвечайте на вопросы.</p>
            <p style="margin:0 0 8px"><b>4. Словарь.</b> Карточки слов с транскрипцией и озвучкой.</p>
            <p style="margin:0"><b>5. Обновления.</b> Новые версии приходят автоматически с GitHub Releases — приложение сообщит и предложит перезапуск.</p>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><h3>Быстрый доступ к грамматике</h3><button class="btn btn--ghost btn--small" id="dashAllGrammar">Все темы →</button></div>
        <div class="grid grid--3 card__pad">
          ${GRAMMAR.slice(0, 3).map(t => topicCardHtml(t)).join('')}
        </div>
      </div>
    `;

    $('#heroContinue').onclick = () => navigate('grammar', { id: nextTopic.id });
    $('#heroListening').onclick = () => navigate('listening');
    $('#dashOpenTopic').onclick = () => navigate('grammar', { id: nextTopic.id });
    $('#dashOpenLesson').onclick = () => navigate('listening', { lessonId: nextLesson.id });
    $('#dashAllGrammar').onclick = () => navigate('grammar');
    $$('.topic-card', root).forEach(card => {
      card.onclick = () => navigate('grammar', { id: card.dataset.id });
    });
  };

  function statCard(label, value, sub, icon) {
    return `
      <div class="card">
        <div class="card__pad">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="muted" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">${escapeHtml(label)}</div>
              <div style="font-size:26px;font-weight:900;margin-top:6px">${escapeHtml(value)}</div>
              <div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(sub)}</div>
            </div>
            <div style="font-size:26px">${icon}</div>
          </div>
        </div>
      </div>`;
  }

  function topicCardHtml(t) {
    const st = topicStats(t);
    return `
      <div class="card topic-card" data-id="${escapeHtml(t.id)}">
        <div class="topic-card__top">
          <div class="topic-card__icon">${escapeHtml(t.icon)}</div>
          <div style="min-width:0">
            <p class="topic-card__title">${escapeHtml(t.title)}</p>
            <div class="topic-card__meta">
              <span class="chip chip--primary">${escapeHtml(t.level)}</span>
              <span class="chip">${t.estMinutes} мин</span>
              ${st.done ? '<span class="chip chip--success">Тест пройден</span>' : ''}
            </div>
          </div>
        </div>
        <div class="topic-card__desc">${escapeHtml(t.summary)}</div>
        <div class="topic-card__foot">
          <span class="muted">${st.percent}% верных</span>
          <div class="progress-mini"><div class="progress-mini__fill" style="width:${st.percent}%"></div></div>
        </div>
      </div>`;
  }

  // ---------- Grammar list ----------
  routes.grammar = (root, params) => {
    if (params && params.id) return renderGrammarTopic(root, params.id);

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h2 class="h2">📚 Грамматика</h2>
          <p class="muted" style="margin:6px 0 0;font-size:13px">Правила с объяснениями на русском, таблицами, примерами и тестом.</p>
        </div>
        <span class="chip chip--primary">${GRAMMAR.length} тем • A0–B1</span>
      </div>
      <div class="grid grid--3">
        ${GRAMMAR.map(t => topicCardHtml(t)).join('')}
      </div>
    `;
    $$('.topic-card', root).forEach(card => {
      card.onclick = () => navigate('grammar', { id: card.dataset.id });
    });
  };

  function renderGrammarTopic(root, id) {
    const topic = GRAMMAR.find(t => t.id === id);
    if (!topic) {
      root.innerHTML = `<div class="card card__pad">Тема не найдена. <button class="btn btn--small" onclick="location.hash='#grammar'">К списку</button></div>`;
      return;
    }
    const c = topic.content;
    const st = topicStats(topic);

    root.innerHTML = `
      <div class="detail">
        <aside class="detail__nav">
          <div style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:800">Темы</div>
          ${GRAMMAR.map(t => `
            <button data-id="${escapeHtml(t.id)}" class="${t.id === topic.id ? 'active' : ''}">
              <span>${escapeHtml(t.icon)}</span><span>${escapeHtml(t.title)}</span>
            </button>`).join('')}
          <div class="sep"></div>
          <a class="btn btn--ghost btn--small" style="width:100%;justify-content:center" href="#grammar">← Все темы</a>
        </aside>

        <div class="detail__content">
          <div class="card">
            <div class="card__head">
              <div style="display:flex;gap:12px;align-items:center">
                <div class="topic-card__icon" style="width:40px;height:40px">${escapeHtml(topic.icon)}</div>
                <div>
                  <h2 class="h2" style="font-size:18px">${escapeHtml(topic.title)}</h2>
                  <div style="display:flex;gap:6px;margin-top:6px">
                    <span class="chip chip--primary">${escapeHtml(topic.level)}</span>
                    <span class="chip">${topic.estMinutes} мин</span>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="chip ${st.percent === 100 ? 'chip--success' : ''}">${st.correct}/${st.total} верно</span>
                <button class="btn btn--small" id="speakTopic">🔊 Озвучить примеры</button>
              </div>
            </div>
            <div class="card__pad">
              <div class="rule-block">${c.rule}</div>
              ${c.table ? `
                <h3 class="h3" style="margin:8px 0 10px">Таблица</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr>${c.table.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${c.table.rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
                  </table>
                </div>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card__head"><h3>Примеры</h3><span class="muted" style="font-size:12px">Нажмите 🔊, чтобы услышать</span></div>
            <div class="card__pad" style="display:flex;flex-direction:column;gap:10px">
              ${c.examples.map((ex, i) => `
                <div class="example">
                  <button class="btn btn--small" data-speak="${escapeHtml(ex.en.split(' — ')[0])}" title="Озвучить">🔊</button>
                  <div>
                    <div style="font-weight:700">${escapeHtml(ex.en)}</div>
                    <div class="muted" style="margin-top:2px">${escapeHtml(ex.ru)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          ${c.pitfalls ? `<div class="pitfall"><b>⚠️ Частая ошибка:</b> ${escapeHtml(c.pitfalls)}</div>` : ''}

          <div class="card">
            <div class="card__head"><h3>Практика</h3><span class="muted" style="font-size:12px">Выберите ответ — увидите разбор</span></div>
            <div class="card__pad" style="display:flex;flex-direction:column;gap:14px" id="exercises">
              ${(c.exercises || []).map((ex, i) => exerciseHtml(topic, ex, i)).join('')}
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <a class="btn btn--ghost" href="#grammar">← Все темы</a>
            <button class="btn btn--primary" id="nextTopicBtn">Следующая тема →</button>
          </div>
        </div>
      </div>
    `;

    $$('.detail__nav button[data-id]', root).forEach(b => {
      b.onclick = () => navigate('grammar', { id: b.dataset.id });
    });
    $$('[data-speak]', root).forEach(b => {
      b.onclick = () => speakWord(b.dataset.speak.replace(/[\[\]].*$/, '').trim());
    });
    $('#speakTopic').onclick = () => {
      const text = c.examples.map(e => e.en.split(' — ')[0]).join('. ');
      tts.speak(text);
      toast('Озвучиваем примеры темы', 'info', null, null, 2000);
    };

    bindExercises(topic);

    const idx = GRAMMAR.findIndex(t => t.id === topic.id);
    const next = GRAMMAR[(idx + 1) % GRAMMAR.length];
    $('#nextTopicBtn').onclick = () => navigate('grammar', { id: next.id });
  }

  function exerciseHtml(topic, ex, i) {
    const saved = state.progress[topic.id]?.answers?.[i];
    return `
      <div class="exercise" data-ex="${i}">
        <div class="exercise__q">${i + 1}. ${ex.q}</div>
        <div class="exercise__options">
          ${ex.options.map((opt, oi) => {
            let cls = 'exercise__opt';
            if (saved) {
              if (oi === ex.answer) cls += ' correct';
              else if (saved === 'wrong' && oi === state.progress[topic.id].lastPick?.[i]) cls += ' wrong';
            }
            return `<div class="${cls}" data-opt="${oi}" data-answer="${ex.answer}">
              <span style="width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none">${String.fromCharCode(65 + oi)}</span>
              <span>${opt}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="exercise__explain ${saved ? '' : 'hidden'}">${saved ? '💡 ' + escapeHtml(ex.explain) : ''}</div>
      </div>`;
  }

  function bindExercises(topic) {
    const topicId = topic.id;
    $$(`#exercises .exercise`).forEach(exEl => {
      const i = Number(exEl.dataset.ex);
      const ex = topic.content.exercises[i];
      const saved = state.progress[topicId]?.answers?.[i];

      if (saved) {
        const explain = $('.exercise__explain', exEl);
        if (explain) explain.classList.remove('hidden');
        return;
      }

      $$('.exercise__opt', exEl).forEach(optEl => {
        optEl.onclick = () => {
          const pick = Number(optEl.dataset.opt);
          const correct = pick === ex.answer;
          state.progress[topicId] = state.progress[topicId] || { answers: {}, lastPick: {} };
          state.progress[topicId].answers[i] = correct ? 'correct' : 'wrong';
          state.progress[topicId].lastPick = state.progress[topicId].lastPick || {};
          state.progress[topicId].lastPick[i] = pick;
          scheduleSave();

          $$('.exercise__opt', exEl).forEach(el => {
            const oi = Number(el.dataset.opt);
            if (oi === ex.answer) el.classList.add('correct');
            else if (oi === pick) el.classList.add('wrong');
            el.style.pointerEvents = 'none';
          });
          const explain = $('.exercise__explain', exEl);
          explain.classList.remove('hidden');
          explain.innerHTML = `${correct ? '✅ Верно! ' : '❌ Не совсем. '}💡 ${escapeHtml(ex.explain)}`;

          if (correct) toast('Верно! Так держать', 'success', null, null, 2000);
          else toast('Есть разбор под заданием — посмотрите объяснение', 'warn', null, null, 2500);

          updateProgressUI();
        };
      });
    });
  }

  function updateProgressUI() {
    const pct = overallPercent();
    $('#overall-progress').textContent = pct + '%';
    $('#overall-progress-bar').style.width = pct + '%';
  }

  // ---------- Listening ----------
  routes.listening = (root, params) => {
    if (params && params.lessonId) return renderListeningLesson(root, params.lessonId);

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h2 class="h2">🎧 Аудирование</h2>
          <p class="muted" style="margin:6px 0 0;font-size:13px">Слушайте тексты, регулируйте скорость и голос, проверяйте понимание вопросами.</p>
        </div>
        <span class="chip chip--primary">${ALL_LESSONS.length} уроков • A1–B2</span>
      </div>
      ${LISTENING.map(level => `
        <div class="card" style="margin-bottom:16px">
          <div class="card__head">
            <div style="display:flex;gap:10px;align-items:center">
              <span style="font-size:20px">${escapeHtml(level.icon)}</span>
              <div>
                <h3>${escapeHtml(level.title)}</h3>
                <div class="muted" style="font-size:12px">${escapeHtml(level.desc)}</div>
              </div>
            </div>
            <span class="chip">${level.lessons.length} ${plural(level.lessons.length, 'урок', 'урока', 'уроков')}</span>
          </div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:10px">
            ${level.lessons.map(l => `
              <div class="lesson">
                <div class="lesson__icon">🎧</div>
                <div class="lesson__main">
                  <p class="lesson__title">${escapeHtml(l.title)}</p>
                  <div class="lesson__meta">
                    <span>⏱ ${escapeHtml(l.duration)}</span>
                    <span>${escapeHtml(l.difficulty)}</span>
                    <span>${l.questions.length} ${plural(l.questions.length, 'вопрос', 'вопроса', 'вопросов')}</span>
                    ${lessonDone(l.id) ? '<span class="chip chip--success">Пройдено</span>' : ''}
                  </div>
                </div>
                <div class="lesson__actions">
                  <button class="btn btn--small" data-play="${escapeHtml(l.id)}">🔊 Прослушать</button>
                  <button class="btn btn--primary btn--small" data-open="${escapeHtml(l.id)}">Открыть</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    `;

    $$('[data-open]', root).forEach(b => {
      b.onclick = () => navigate('listening', { lessonId: b.dataset.open });
    });
    $$('[data-play]', root).forEach(b => {
      b.onclick = () => {
        const lesson = ALL_LESSONS.find(l => l.id === b.dataset.play);
        if (lesson) {
          playTranscript(splitSentences(lesson.textEn));
          toast('Аудирование: ' + lesson.title, 'info', 'Стоп', () => {
            tts.stop();
            highlightSentence(-1);
          });
        }
      };
    });
  };

  function renderListeningLesson(root, lessonId) {
    const lesson = ALL_LESSONS.find(l => l.id === lessonId);
    if (!lesson) {
      root.innerHTML = `<div class="card card__pad">Урок не найден. <a href="#listening">Все уроки</a></div>`;
      return;
    }
    const sentences = splitSentences(lesson.textEn);
    const done = lessonDone(lesson.id);

    root.innerHTML = `
      <div style="margin-bottom:14px"><a href="#listening" class="btn btn--ghost btn--small">← Все уроки</a></div>
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="h2" style="font-size:18px">${escapeHtml(lesson.title)}</h2>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="chip chip--primary">${escapeHtml(lesson.levelTitle)}</span>
              <span class="chip">⏱ ${escapeHtml(lesson.duration)}</span>
              <span class="chip">${escapeHtml(lesson.difficulty)}</span>
              ${done ? '<span class="chip chip--success">Пройдено</span>' : ''}
            </div>
          </div>
          <button class="btn btn--primary btn--small" id="playAll">▶ Слушать весь текст</button>
        </div>

        <div class="card__pad">
          <div class="audio-bar">
            <label class="muted" style="font-size:12px">Голос</label>
            <select id="lessonVoice" style="max-width:260px">${voiceOptionsHtml()}</select>
            <label class="muted" style="font-size:12px">Скорость</label>
            <input id="lessonRate" class="range" type="range" min="0.5" max="1.4" step="0.05" value="${Number(state.settings.rate) || 1}" />
            <span class="chip" id="lessonRateVal">${(Number(state.settings.rate) || 1).toFixed(2)}×</span>
            <button class="btn btn--small" id="stopAudio">⏹ Стоп</button>
          </div>

          <div id="transcript" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"></div>

          <details style="margin-top:14px">
            <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--primary)">Показать перевод (подсказка)</summary>
            <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#475569;background:#f8fafc;border:1px solid var(--border);padding:12px;border-radius:12px">
              ${escapeHtml(lesson.textRu)}
            </div>
          </details>

          <div class="pitfall" style="margin-top:14px;background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">
            <b>🎯 Обратите внимание:</b> ${escapeHtml(lesson.scriptTips)}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card__head"><h3>Проверка понимания</h3><span class="muted" style="font-size:12px">${lesson.questions.length} ${plural(lesson.questions.length, 'вопрос', 'вопроса', 'вопросов')}</span></div>
        <div class="card__pad" style="display:flex;flex-direction:column;gap:14px" id="listeningQuiz">
          ${lesson.questions.map((q, i) => `
            <div class="exercise" data-q="${i}">
              <div class="exercise__q">${i + 1}. ${escapeHtml(q.q)}</div>
              <div class="exercise__options">
                ${q.options.map((o, oi) => `<div class="exercise__opt" data-opt="${oi}" data-answer="${q.answer}">
                  <span style="width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none">${String.fromCharCode(65 + oi)}</span>
                  <span>${escapeHtml(o)}</span>
                </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;

    renderTranscript(sentences);

    $('#lessonVoice').onchange = (e) => {
      state.settings.voice = e.target.value || null;
      scheduleSave();
    };
    $('#lessonRate').oninput = (e) => {
      const v = Number(e.target.value);
      state.settings.rate = v;
      $('#lessonRateVal').textContent = v.toFixed(2) + '×';
      scheduleSave();
    };
    $('#playAll').onclick = () => playTranscript(sentences);
    $('#stopAudio').onclick = () => {
      tts.stop();
      highlightSentence(-1);
    };

    // Click on sentence to hear it
    $$('#transcript [data-sent]').forEach(el => {
      el.onclick = () => {
        const idx = Number(el.dataset.sent);
        tts.stop();
        highlightSentence(idx);
        tts.speak(sentences[idx], { onEnd: () => highlightSentence(-1) });
      };
    });

    bindListeningQuiz(lesson);
  }

  function splitSentences(text) {
    return String(text)
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
  }

  function renderTranscript(sentences) {
    const box = $('#transcript');
    box.innerHTML = sentences.map((s, i) => `
      <div data-sent="${i}" style="cursor:pointer;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;font-size:14px;line-height:1.5;display:flex;gap:10px;align-items:flex-start;transition:.15s">
        <span style="color:#94a3b8;font-size:12px;font-weight:800;min-width:18px">${i + 1}</span>
        <span>${escapeHtml(s)}</span>
      </div>`).join('');
  }

  function highlightSentence(idx) {
    $$('#transcript [data-sent]').forEach(el => {
      const on = Number(el.dataset.sent) === idx;
      el.style.background = on ? '#eff6ff' : '#fff';
      el.style.borderColor = on ? '#93c5fd' : 'var(--border)';
    });
  }

  function playTranscript(sentences) {
    tts.stop();
    const token = tts.token;
    let i = 0;
    const next = () => {
      if (token !== tts.token) return;           // воспроизведение остановлено
      if (i >= sentences.length) { highlightSentence(-1); return; }
      const idx = i++;
      highlightSentence(idx);
      tts.speak(sentences[idx], {
        onEnd: next,
        onError: () => { if (token === tts.token) highlightSentence(-1); }
      });
    };
    next();
    toast('Слушаем текст. Нажмите ⏹ Стоп, чтобы остановить', 'info', null, null, 2500);
  }

  function bindListeningQuiz(lesson) {
    let correctCount = 0;
    let answered = 0;
    const total = lesson.questions.length;

    $$('#listeningQuiz .exercise').forEach((qEl, qi) => {
      const q = lesson.questions[qi];
      $$('.exercise__opt', qEl).forEach(optEl => {
        optEl.onclick = () => {
          const pick = Number(optEl.dataset.opt);
          const correct = pick === q.answer;
          $$('.exercise__opt', qEl).forEach(el => {
            const oi = Number(el.dataset.opt);
            if (oi === q.answer) el.classList.add('correct');
            else if (oi === pick) el.classList.add('wrong');
            el.style.pointerEvents = 'none';
          });
          answered++;
          if (correct) correctCount++;
          if (answered === total) {
            const passed = correctCount >= Math.ceil(total * 0.66);
            if (passed && !lessonDone(lesson.id)) {
              state.completedLessons.push(lesson.id);
              scheduleSave();
              toast(`Урок пройден: ${correctCount}/${total} верно 🎉`, 'success');
              updateProgressUI();
            } else if (!passed) {
              toast(`Результат ${correctCount}/${total}. Прослушайте текст ещё раз и попробуйте снова`, 'warn', null, null, 4500);
            } else {
              toast(`Результат ${correctCount}/${total}. Урок уже был пройден`, 'info');
            }
          }
        };
      });
    });
  }

  // ---------- Vocabulary ----------
  routes.vocabulary = (root) => {
    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h2 class="h2">🃏 Словарь</h2>
          <p class="muted" style="margin:6px 0 0;font-size:13px">Карточки с транскрипцией, озвучкой и примерами. Отмечайте слова, которые уже знаете.</p>
        </div>
        <button class="btn btn--primary btn--small" id="vocabTrain">🎯 Тренировать слова</button>
      </div>
      ${VOCAB.map(set => {
        const known = state.vocabularyProgress[set.id] || [];
        return `
          <div class="card" style="margin-bottom:16px">
            <div class="card__head">
              <div style="display:flex;gap:10px;align-items:center">
                <span style="font-size:20px">${escapeHtml(set.icon)}</span>
                <div>
                  <h3>${escapeHtml(set.title)}</h3>
                  <div class="muted" style="font-size:12px">${escapeHtml(set.level)} • ${set.words.length} слов</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span class="chip ${known.length === set.words.length ? 'chip--success' : ''}">${known.length}/${set.words.length} знаю</span>
                <button class="btn btn--small" data-speak-set="${escapeHtml(set.id)}">🔊 Все слова</button>
              </div>
            </div>
            <div class="card__pad grid grid--3" data-set="${escapeHtml(set.id)}">
              ${set.words.map(w => {
                const isKnown = known.includes(w.en);
                return `
                  <div class="word-card">
                    <div class="word-card__head">
                      <div>
                        <div class="word-card__en">${escapeHtml(w.en)}</div>
                        <div class="word-card__ipa">${escapeHtml(w.ipa || '')}</div>
                      </div>
                      <button class="btn btn--small" data-speak-word="${escapeHtml(w.en)}">🔊</button>
                    </div>
                    <div class="word-card__ru">${escapeHtml(w.ru)}</div>
                    <div class="word-card__ex">${escapeHtml(w.ex)}</div>
                    <button class="btn btn--small ${isKnown ? 'btn--success' : 'btn--ghost'}" data-known="${escapeHtml(set.id)}::${escapeHtml(w.en)}">
                      ${isKnown ? '✓ Знаю' : 'Отметить «знаю»'}
                    </button>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    `;

    $$('[data-speak-word]', root).forEach(b => {
      b.onclick = () => speakWord(b.dataset.speakWord);
    });
    $$('[data-speak-set]', root).forEach(b => {
      b.onclick = () => {
        const set = VOCAB.find(s => s.id === b.dataset.speakSet);
        if (!set) return;
        tts.speak(set.words.map(w => w.en).join(', '));
        toast('Озвучиваем слова из набора', 'info', null, null, 2000);
      };
    });
    $$('[data-known]', root).forEach(b => {
      b.onclick = () => {
        const [setId, word] = b.dataset.known.split('::');
        const arr = state.vocabularyProgress[setId] || [];
        if (arr.includes(word)) {
          state.vocabularyProgress[setId] = arr.filter(w => w !== word);
          b.classList.remove('btn--success');
          b.classList.add('btn--ghost');
          b.textContent = 'Отметить «знаю»';
        } else {
          arr.push(word);
          state.vocabularyProgress[setId] = arr;
          b.classList.add('btn--success');
          b.classList.remove('btn--ghost');
          b.textContent = '✓ Знаю';
        }
        scheduleSave();
        updateProgressUI();
      };
    });
    $('#vocabTrain').onclick = () => startVocabTrainer();
  };

  function startVocabTrainer() {
    const all = VOCAB.flatMap(s => s.words.map(w => ({ ...w, setId: s.id, setName: s.title })));
    const pool = all.filter(w => !(state.vocabularyProgress[w.setId] || []).includes(w.en));
    const list = (pool.length >= 4 ? pool : all).sort(() => Math.random() - 0.5).slice(0, 10);
    let i = 0, score = 0;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100;display:grid;place-items:center;padding:20px;';
    overlay.innerHTML = `
      <div class="card" style="width:min(560px,100%);max-height:90vh;overflow:auto">
        <div class="card__head">
          <h3>🎯 Тренировка слов</h3>
          <button class="btn btn--ghost btn--small" data-close>✕</button>
        </div>
        <div class="card__pad" id="trainerBody"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const body = overlay.querySelector('#trainerBody');

    const draw = () => {
      if (i >= list.length) {
        body.innerHTML = `
          <div style="text-align:center;padding:20px 0">
            <div style="font-size:44px">${score >= list.length * 0.8 ? '🏆' : score >= list.length * 0.5 ? '👏' : '💪'}</div>
            <h3 style="margin:10px 0 6px">Результат: ${score} из ${list.length}</h3>
            <p class="muted" style="font-size:13px">${score >= list.length * 0.8 ? 'Отличная работа! Слова запоминаются.' : 'Повторите карточки и попробуйте ещё раз.'}</p>
            <button class="btn btn--primary" data-close2 style="margin-top:8px">Закрыть</button>
          </div>`;
        body.querySelector('[data-close2]').onclick = () => overlay.remove();
        updateProgressUI();
        return;
      }
      const w = list[i];
      const distractors = all.filter(x => x.ru !== w.ru).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [w, ...distractors].sort(() => Math.random() - 0.5);

      body.innerHTML = `
        <div class="muted" style="font-size:12px;margin-bottom:8px">Вопрос ${i + 1} из ${list.length} • ${escapeHtml(w.setName)}</div>
        <div style="font-size:30px;font-weight:900;margin:6px 0">${escapeHtml(w.en)}</div>
        <div class="muted" style="font-size:13px;margin-bottom:14px">${escapeHtml(w.ipa || '')}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${options.map(o => `<button class="exercise__opt" data-ru="${escapeHtml(o.ru)}" style="width:100%;text-align:left">${escapeHtml(o.ru)}</button>`).join('')}
        </div>
        <div style="margin-top:12px"><button class="btn btn--ghost btn--small" data-listen>🔊 Прослушать</button></div>
      `;
      body.querySelector('[data-listen]').onclick = () => tts.speak(w.en);
      body.querySelectorAll('[data-ru]').forEach(btn => {
        btn.onclick = () => {
          const correct = btn.dataset.ru === w.ru;
          body.querySelectorAll('[data-ru]').forEach(b => {
            if (b.dataset.ru === w.ru) b.classList.add('correct');
            else b.classList.add('wrong');
            b.style.pointerEvents = 'none';
          });
          if (correct) {
            score++;
            const arr = state.vocabularyProgress[w.setId] || [];
            if (!arr.includes(w.en)) {
              arr.push(w.en);
              state.vocabularyProgress[w.setId] = arr;
              scheduleSave();
            }
          }
          setTimeout(() => { i++; draw(); }, 700);
        };
      });
    };
    draw();
  }

  // ---------- Practice (mixed quiz) ----------
  routes.practice = (root) => {
    const grammarQs = GRAMMAR.flatMap(t =>
      (t.content.exercises || []).map((ex, i) => ({ ...ex, source: t.title, type: 'grammar', topicId: t.id, idx: i }))
    );
    const listeningQs = ALL_LESSONS.flatMap(l =>
      l.questions.map(q => ({ q: q.q, options: q.options, answer: q.answer, source: l.title, type: 'listening' }))
    );
    const allWords = VOCAB.flatMap(s => s.words);
    const vocabQs = VOCAB.flatMap(s =>
      s.words.map(w => {
        const distractors = allWords.filter(x => x.ru !== w.ru).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.ru);
        const options = [w.ru, ...distractors].sort(() => Math.random() - 0.5);
        return {
          q: `Что означает «${w.en}»?`,
          options,
          answer: options.indexOf(w.ru),
          source: s.title,
          type: 'vocab'
        };
      })
    );

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h2 class="h2">🧩 Тренировка</h2>
          <p class="muted" style="margin:6px 0 0;font-size:13px">Смешанный тест: грамматика, аудирование и словарь. 10 случайных вопросов.</p>
        </div>
        <button class="btn btn--primary" id="startPractice">▶ Начать тренировку</button>
      </div>
      <div class="card">
        <div class="card__pad" id="practiceBody">
          <p class="muted" style="font-size:13px;margin:0">Нажмите «Начать тренировку» — вопросы будут выбраны случайно из всех разделов курса. Результат показывается сразу с пояснением.</p>
        </div>
      </div>
    `;

    $('#startPractice').onclick = () => {
      const mixed = [...grammarQs.slice(0, 30), ...listeningQs, ...vocabQs]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      let i = 0, score = 0;
      const body = $('#practiceBody');

      const draw = () => {
        if (i >= mixed.length) {
          body.innerHTML = `
            <div style="text-align:center;padding:24px 0">
              <div style="font-size:50px">${score >= 8 ? '🏆' : score >= 5 ? '👏' : '💪'}</div>
              <h3 style="margin:12px 0 6px">Результат: ${score} из ${mixed.length}</h3>
              <p class="muted" style="font-size:13px">${score >= 8 ? 'Отличный результат! Вы уверенно владеете материалом.' : 'Повторите слабые темы в разделе «Грамматика» и попробуйте снова.'}</p>
              <button class="btn btn--primary" id="restartPractice" style="margin-top:10px">Ещё раз</button>
            </div>`;
          $('#restartPractice').onclick = () => $('#startPractice').click();
          return;
        }
        const item = mixed[i];
        body.innerHTML = `
          <div class="muted" style="font-size:12px;margin-bottom:10px">Вопрос ${i + 1} из ${mixed.length} • ${escapeHtml(item.source)}</div>
          <div class="exercise__q" style="font-size:15px">${item.q}</div>
          <div class="exercise__options">
            ${item.options.map((o, oi) => `<div class="exercise__opt" data-opt="${oi}">
              <span style="width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none">${String.fromCharCode(65 + oi)}</span>
              <span>${escapeHtml(o)}</span>
            </div>`).join('')}
          </div>
          <div class="exercise__explain hidden" id="pExplain"></div>
        `;
        body.querySelectorAll('.exercise__opt').forEach(el => {
          el.onclick = () => {
            const pick = Number(el.dataset.opt);
            const ok = pick === item.answer;
            if (ok) score++;
            body.querySelectorAll('.exercise__opt').forEach(e2 => {
              const oi = Number(e2.dataset.opt);
              if (oi === item.answer) e2.classList.add('correct');
              else if (oi === pick) e2.classList.add('wrong');
              e2.style.pointerEvents = 'none';
            });
            const ex = body.querySelector('#pExplain');
            ex.classList.remove('hidden');
            ex.innerHTML = `${ok ? '✅ Верно.' : '❌ Ошибка.'} ${item.explain ? '💡 ' + escapeHtml(item.explain) : 'Повторите тему: ' + escapeHtml(item.source)}`;
            setTimeout(() => { i++; draw(); }, 1100);
          };
        });
      };
      draw();
    };
  };

  // ---------- Settings ----------
  routes.settings = (root) => {
    const upd = state.settings;
    root.innerHTML = `
      <h2 class="h2" style="margin-bottom:16px">⚙️ Настройки</h2>
      <div class="settings-grid">
        <div class="card">
          <div class="card__head"><h3>Аудирование и озвучка</h3><span class="chip">Web Speech</span></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:12px">
            <div class="setting">
              <div>
                <div class="setting__label">Голос</div>
                <div class="setting__desc">Выберите английский голос из установленных в Windows</div>
              </div>
              <select id="voiceSelect" style="max-width:340px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);font-size:13px">${voiceOptionsHtml()}</select>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">Скорость речи</div>
                <div class="setting__desc">0.5× — медленно, 1.0× — обычный темп, 1.4× — быстро</div>
              </div>
              <div style="display:flex;gap:10px;align-items:center">
                <input id="rateRange" class="range" type="range" min="0.5" max="1.4" step="0.05" value="${Number(upd.rate) || 1}" style="width:160px" />
                <span class="chip" id="rateVal">${(Number(upd.rate) || 1).toFixed(2)}×</span>
              </div>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">Громкость</div>
                <div class="setting__desc">Громкость синтезатора речи</div>
              </div>
              <div style="display:flex;gap:10px;align-items:center">
                <input id="volRange" class="range" type="range" min="0" max="1" step="0.05" value="${Number(upd.volume) || 1}" style="width:160px" />
                <span class="chip" id="volVal">${Math.round((Number(upd.volume) || 1) * 100)}%</span>
              </div>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">Проверить голос</div>
                <div class="setting__desc">Тестовая фраза на английском</div>
              </div>
              <button class="btn btn--small" id="testVoice">🔊 Проверить</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h3>Обновления</h3><span class="chip chip--primary">GitHub Releases</span></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:12px">
            <div class="setting">
              <div>
                <div class="setting__label">Текущая версия</div>
                <div class="setting__desc" id="versionLine">v0.1.0 • Windows</div>
              </div>
              <span class="chip chip--success" id="updateStatus">Проверка при запуске</span>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">Автоматические обновления</div>
                <div class="setting__desc">Приложение проверяет GitHub Releases при запуске и каждые 4 часа. При выходе новой версии — уведомление и перезапуск в один клик.</div>
              </div>
              <button class="btn btn--primary btn--small" id="checkUpdatesNow">Проверить сейчас</button>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">История версий</div>
                <div class="setting__desc">Все релизы и контрольные суммы — на GitHub</div>
              </div>
              <button class="btn btn--small" id="openReleases">Открыть Releases</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h3>Внешний вид и данные</h3></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:12px">
            <div class="setting">
              <div>
                <div class="setting__label">Тема</div>
                <div class="setting__desc">Светлая или тёмная</div>
              </div>
              <select id="themeSelect" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);font-size:13px">
                <option value="light" ${upd.theme === 'light' ? 'selected' : ''}>Светлая</option>
                <option value="dark" ${upd.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
              </select>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">Прогресс</div>
                <div class="setting__desc">Хранится локально на этом компьютере (electron-store). Сброс вернёт все уроки и тесты в исходное состояние.</div>
              </div>
              <button class="btn btn--small" id="resetSettingsProgress" style="border-color:#fecaca;color:#b91c1c">Сбросить прогресс</button>
            </div>
            <div class="setting">
              <div>
                <div class="setting__label">О программе</div>
                <div class="setting__desc">Guide English — тренажёр английского с правилами и аудированием</div>
              </div>
              <button class="btn btn--small" id="aboutBtn">Сведения</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#voiceSelect').onchange = (e) => {
      state.settings.voice = e.target.value || null;
      scheduleSave();
      toast('Голос сохранён', 'success', null, null, 1800);
    };
    $('#rateRange').oninput = (e) => {
      state.settings.rate = Number(e.target.value);
      $('#rateVal').textContent = Number(e.target.value).toFixed(2) + '×';
      scheduleSave();
    };
    $('#volRange').oninput = (e) => {
      state.settings.volume = Number(e.target.value);
      $('#volVal').textContent = Math.round(Number(e.target.value) * 100) + '%';
      scheduleSave();
    };
    $('#testVoice').onclick = () => {
      tts.speak('Hello! This is Guide English. Let’s learn English together.', { rate: Number(state.settings.rate) || 1 });
      toast('Произносим тестовую фразу', 'info', null, null, 2000);
    };
    $('#themeSelect').onchange = (e) => {
      state.settings.theme = e.target.value;
      applyTheme();
      scheduleSave();
    };
    $('#checkUpdatesNow').onclick = () => {
      if (hasElectron && window.guideEnglish.checkForUpdates) {
        window.guideEnglish.checkForUpdates().then(r => {
          if (!r.ok) toast(r.error || 'Не удалось проверить обновления', 'warn');
          else toast('Проверяем GitHub Releases…', 'info');
        });
      } else {
        toast('В dev-режиме автообновление отключено. Оно работает в установленной версии из GitHub Releases.', 'warn', null, null, 6000);
      }
    };
    $('#openReleases').onclick = () => openExternal('https://github.com/ignatus4405-glitch/guide_english/releases');
    $('#resetSettingsProgress').onclick = async () => {
      const ok = confirm('Сбросить весь прогресс? Это действие нельзя отменить.');
      if (!ok) return;
      await Store.clear();
      state.progress = {};
      state.completedLessons = [];
      state.vocabularyProgress = {};
      updateProgressUI();
      toast('Прогресс сброшен', 'success');
      render('settings');
    };
    $('#aboutBtn').onclick = async () => {
      const version = hasElectron ? await window.guideEnglish.getVersion() : '0.1.0 (dev)';
      toast(`Guide English v${version} • Electron ${hasElectron ? 'приложение' : 'браузер'}`, 'info', null, null, 4000);
    };

    if (hasElectron) {
      window.guideEnglish.getVersion().then(v => {
        const line = $('#versionLine');
        if (line) line.textContent = `v${v} • Windows`;
        const fv = $('#app-version');
        if (fv) fv.textContent = `v${v}`;
      }).catch(() => {});
    }
  };

  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme || 'light';
  }

  async function openExternal(url) {
    if (hasElectron && window.guideEnglish.openExternal) return window.guideEnglish.openExternal(url);
    window.open(url, '_blank');
  }

  // ---------- Search ----------
  function setupSearch() {
    const input = $('#globalSearch');
    if (!input) return;
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) {
          if (input.value.trim() === '') render('dashboard');
          return;
        }
        renderSearch(q);
      }, 250);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; render('dashboard'); }
    });
  }

  function renderSearch(q) {
    const root = $('#content');
    const topics = GRAMMAR.filter(t =>
      (t.title + ' ' + t.summary + ' ' + t.content.rule).toLowerCase().includes(q)
    );
    const lessons = ALL_LESSONS.filter(l =>
      (l.title + ' ' + l.textEn + ' ' + l.textRu).toLowerCase().includes(q)
    );
    const words = VOCAB.flatMap(s => s.words.map(w => ({ ...w, setName: s.title })))
      .filter(w => (w.en + ' ' + w.ru).toLowerCase().includes(q))
      .slice(0, 12);

    root.innerHTML = `
      <h2 class="h2" style="margin-bottom:4px">🔍 Результаты: «${escapeHtml(q)}»</h2>
      <p class="muted" style="font-size:13px;margin-bottom:16px">Найдено: ${topics.length + lessons.length + words.length}</p>

      ${topics.length ? `
        <div class="card" style="margin-bottom:14px">
          <div class="card__head"><h3>📚 Грамматика</h3></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:8px">
            ${topics.map(t => `<button class="lesson" style="width:100%;text-align:left;cursor:pointer" data-goto-topic="${escapeHtml(t.id)}">
              <div class="lesson__icon">${escapeHtml(t.icon)}</div>
              <div class="lesson__main">
                <p class="lesson__title">${escapeHtml(t.title)}</p>
                <div class="lesson__meta"><span>${escapeHtml(t.level)}</span><span>${escapeHtml(t.summary)}</span></div>
              </div>
              <span class="btn btn--small">Открыть</span>
            </button>`).join('')}
          </div>
        </div>` : ''}

      ${lessons.length ? `
        <div class="card" style="margin-bottom:14px">
          <div class="card__head"><h3>🎧 Аудирование</h3></div>
          <div class="card__pad" style="display:flex;flex-direction:column;gap:8px">
            ${lessons.map(l => `<button class="lesson" style="width:100%;text-align:left;cursor:pointer" data-goto-lesson="${escapeHtml(l.id)}">
              <div class="lesson__icon">🎧</div>
              <div class="lesson__main">
                <p class="lesson__title">${escapeHtml(l.title)}</p>
                <div class="lesson__meta"><span>${escapeHtml(l.levelTitle)}</span><span>${escapeHtml(l.duration)}</span></div>
              </div>
              <span class="btn btn--small">Открыть</span>
            </button>`).join('')}
          </div>
        </div>` : ''}

      ${words.length ? `
        <div class="card">
          <div class="card__head"><h3>🃏 Слова</h3></div>
          <div class="card__pad grid grid--3">
            ${words.map(w => `<div class="word-card">
              <div class="word-card__head"><div><div class="word-card__en">${escapeHtml(w.en)}</div><div class="word-card__ipa">${escapeHtml(w.ipa || '')}</div></div>
              <button class="btn btn--small" data-speak-word="${escapeHtml(w.en)}">🔊</button></div>
              <div class="word-card__ru">${escapeHtml(w.ru)}</div>
              <div class="word-card__ex">${escapeHtml(w.setName)}</div>
            </div>`).join('')}
          </div>
        </div>` : ''}

      ${!topics.length && !lessons.length && !words.length ? `<div class="card card__pad">Ничего не найдено. Попробуйте: «Present», «артикль», «кафе», «travel».</div>` : ''}
    `;

    $$('[data-goto-topic]', root).forEach(b => b.onclick = () => navigate('grammar', { id: b.dataset.gotoTopic }));
    $$('[data-goto-lesson]', root).forEach(b => b.onclick = () => navigate('listening', { lessonId: b.dataset.gotoLesson }));
    $$('[data-speak-word]', root).forEach(b => b.onclick = () => speakWord(b.dataset.speakWord));
  }

  // ---------- Updater UI ----------
  function setupUpdater() {
    if (!hasElectron) {
      const hint = $('#updateStatus');
      if (hint) hint.textContent = 'Только в установленной версии';
      return;
    }

    const banner = $('#update-banner');
    const title = $('#update-title');
    const detail = $('#update-detail');
    const progress = $('#update-progress');
    const bar = progress ? progress.querySelector('.update-progress__bar') : null;
    const installBtn = $('#update-installBtn');
    const closeBtn = $('#update-closeBtn');

    const showBanner = () => banner && banner.classList.remove('hidden');
    const hideBanner = () => banner && banner.classList.add('hidden');

    closeBtn && (closeBtn.onclick = hideBanner);
    installBtn && (installBtn.onclick = () => {
      if (window.guideEnglish.quitAndInstall) window.guideEnglish.quitAndInstall();
    });

    const g = window.guideEnglish;

    g.onUpdaterChecking && g.onUpdaterChecking(() => {
      toast('Проверяем обновления на GitHub…', 'info');
    });

    g.onUpdaterAvailable && g.onUpdaterAvailable((info) => {
      showBanner();
      if (title) title.textContent = `Доступна новая версия ${info.version}`;
      if (detail) detail.textContent = 'Скачиваем обновление с GitHub Releases…';
      if (installBtn) installBtn.classList.add('hidden');
      if (progress) progress.classList.remove('hidden');
      toast(`Вышла новая версия ${info.version}`, 'success', null, null, 5000);
    });

    g.onUpdaterProgress && g.onUpdaterProgress((p) => {
      showBanner();
      if (detail) detail.textContent = `Загрузка обновления: ${Math.round(p.percent)}%`;
      if (bar) bar.style.width = Math.round(p.percent) + '%';
    });

    g.onUpdaterDownloaded && g.onUpdaterDownloaded((info) => {
      showBanner();
      if (title) title.textContent = `Обновление ${info.version} загружено`;
      if (detail) detail.textContent = 'Перезапустите приложение, чтобы установить новую версию.';
      if (installBtn) installBtn.classList.remove('hidden');
      if (progress) progress.classList.add('hidden');
      toast(`Обновление ${info.version} готово к установке`, 'success', 'Перезапустить', () => {
        window.guideEnglish.quitAndInstall && window.guideEnglish.quitAndInstall();
      }, 12000);
    });

    g.onUpdaterNotAvailable && g.onUpdaterNotAvailable((info) => {
      toast(`У вас последняя версия (${info?.version || ''})`, 'success', null, null, 3000);
      const st = $('#updateStatus');
      if (st) st.textContent = 'Последняя версия';
    });

    g.onUpdaterError && g.onUpdaterError((err) => {
      console.warn('updater error', err);
      toast('Не удалось проверить обновления. Проверьте интернет-соединение.', 'warn', null, null, 5000);
      const st = $('#updateStatus');
      if (st) st.textContent = 'Ошибка проверки';
    });

    const manual = $('#check-updates-btn');
    if (manual) {
      manual.onclick = () => {
        g.checkForUpdates().then(r => {
          if (!r.ok) toast(r.error === 'Updater disabled in dev mode'
            ? 'Автообновления работают только в установленной версии'
            : (r.error || 'Не удалось проверить обновления'), 'warn');
          else toast('Проверяем обновления…', 'info');
        });
      };
    }
  }

  // ---------- Global UI events ----------
  function setupNav() {
    $$('.nav__item[data-route]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.route));
    });
    const resetBtn = $('#resetProgressBtn');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (!confirm('Сбросить весь прогресс обучения?')) return;
        await Store.clear();
        state.progress = {};
        state.completedLessons = [];
        state.vocabularyProgress = {};
        updateProgressUI();
        toast('Прогресс сброшен', 'success');
        render('dashboard');
      };
    }
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        $('#globalSearch')?.focus();
      }
      if (e.key === ' ' && tts.active && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        tts.stop();
        toast('Озвучка остановлена', 'info', null, null, 1500);
      }
    });
  }

  // ---------- Boot ----------
  async function boot() {
    await loadState();
    setupNav();
    setupSearch();
    setupUpdater();

    try {
      const version = hasElectron ? await window.guideEnglish.getVersion() : '0.1.0';
      $('#app-version').textContent = 'v' + version;
    } catch (e) { /* noop */ }

    $('#app-mode').textContent = hasElectron ? 'Windows' : 'Web preview';

    const initial = parseHash();
    render(initial.name, initial.params);
    window.addEventListener('popstate', () => {
      const r = parseHash();
      render(r.name, r.params);
    });
    window.addEventListener('hashchange', () => {
      const r = parseHash();
      render(r.name, r.params);
    });

    state.booted = true;
    setTimeout(() => {
      toast('Добро пожаловать в Guide English! Начните с грамматики или аудирования.', 'info', 'Хорошо', () => {}, 6000);
    }, 800);
  }

  // Expose for debugging
  window.__guideEnglish = { state, tts, navigate };

  document.addEventListener('DOMContentLoaded', boot);
})();
