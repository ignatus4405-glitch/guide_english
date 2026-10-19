/* Guide English — ядро: состояние, хранилище, озвучка, звуки, геймификация.
   Загружается до lesson.js и app.js. Работает в Electron (window.guideEnglish)
   и в браузере (localStorage). */
(function () {
  'use strict';

  const hasElectron = !!window.guideEnglish;
  const LS_PREFIX = 'guide-english:';

  const GRAMMAR = window.GRAMMAR_TOPICS || [];
  const LISTENING = window.LISTENING_LEVELS || [];
  const VOCAB = window.VOCABULARY_SETS || [];
  const COURSE = window.COURSE_UNITS || [];
  const ACHIEVEMENTS = window.ACHIEVEMENTS || [];
  const SHOP_ITEMS = window.SHOP_ITEMS || [];

  const ALL_LESSONS = LISTENING.flatMap((lvl) =>
    lvl.lessons.map((l) => ({ ...l, levelId: lvl.id, levelTitle: lvl.title }))
  );
  const ALL_TOPICS = GRAMMAR;
  const ALL_WORDS = VOCAB.flatMap((s) => s.words.map((w) => ({ ...w, setId: s.id, setName: s.title })));

  const STEPS = COURSE.flatMap((unit, unitIndex) =>
    unit.steps.map((step, index) => ({ ...step, unitId: unit.id, unitIndex, index, globalIndex: 0 }))
  );
  STEPS.forEach((s, i) => {
    s.globalIndex = i;
    // синхронизируем индекс с объектами внутри COURSE_UNITS (их рендерит путь)
    const original = COURSE[s.unitIndex] && COURSE[s.unitIndex].steps[s.index];
    if (original) original.globalIndex = i;
  });
  const STEP_BY_ID = new Map(STEPS.map((s) => [s.id, s]));
  const STEP_BY_REF = new Map(
    STEPS.filter((s) => s.ref).map((s) => [`${s.type}:${s.ref}`, s])
  );

  // ---------- утилиты ----------
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

  /** Экранирует текст, но оставляет простую разметку <b>, <i>, <s>, <code>, <br>. */
  function formatInline(str = '') {
    return escapeHtml(str)
      .replace(/&lt;(\/?)(b|i|u|s|code)&gt;/gi, '<$1$2>')
      .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  }

  function formatMinutes(ms) {
    const total = Math.max(0, Math.ceil(ms / 60000));
    if (total < 60) return `${total} мин`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }

  // ---------- хранилище ----------
  const Store = {
    async get(key, def) {
      try {
        if (hasElectron) {
          const v = await window.guideEnglish.storeGet(key, def);
          return v === null || v === undefined ? def : v;
        }
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (e) {
        console.warn('store.get', key, e);
        return def;
      }
    },
    async set(key, val) {
      try {
        if (hasElectron) return await window.guideEnglish.storeSet(key, val);
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
        return { ok: true };
      } catch (e) {
        console.warn('store.set', key, e);
        return { ok: false };
      }
    },
    async clearProgress() {
      try {
        if (hasElectron) return await window.guideEnglish.clearProgress();
        ['game', 'settings', 'progress', 'completedLessons', 'vocabularyProgress'].forEach((k) =>
          localStorage.removeItem(LS_PREFIX + k)
        );
        return { ok: true };
      } catch (e) {
        return { ok: false };
      }
    }
  };

  // ---------- состояние ----------
  const DEFAULT_GAME = {
    completedNodes: [],
    xp: 0,
    gems: 250,
    hearts: { count: 5, updatedAt: Date.now() },
    streak: { count: 0, last: null },
    shield: 0,
    boostUntil: 0,
    daily: { date: '', xp: 0 },
    perfectLessons: 0,
    legacyLessons: [],
    mistakes: []
  };

  const state = {
    game: JSON.parse(JSON.stringify(DEFAULT_GAME)),
    vocabKnown: {},          // setId -> [words]
    progress: {},            // legacy: topicId -> {answers}
    settings: {
      voice: null,
      rate: 0.95,
      volume: 1,
      theme: 'light',
      sound: true,
      dailyGoal: 20
    },
    voices: [],
    route: 'learn',
    booted: false
  };

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      Store.set('game', state.game);
      Store.set('vocabKnown', state.vocabKnown);
      Store.set('settings', state.settings);
    }, 250);
  }

  const HEART_MAX = 5;
  const HEART_REGEN_MS = 30 * 60 * 1000; // 1 сердце за 30 минут

  function regenerateHearts() {
    const h = state.game.hearts;
    if (h.count >= HEART_MAX) {
      h.updatedAt = Date.now();
      return false;
    }
    const elapsed = Date.now() - (h.updatedAt || Date.now());
    const gained = Math.floor(elapsed / HEART_REGEN_MS);
    if (gained > 0) {
      h.count = Math.min(HEART_MAX, h.count + gained);
      h.updatedAt = h.count >= HEART_MAX ? Date.now() : (h.updatedAt || Date.now()) + gained * HEART_REGEN_MS;
      save();
      return true;
    }
    return false;
  }

  function nextHeartIn() {
    const h = state.game.hearts;
    if (h.count >= HEART_MAX) return 0;
    const elapsed = Date.now() - (h.updatedAt || Date.now());
    return Math.max(0, HEART_REGEN_MS - (elapsed % HEART_REGEN_MS));
  }

  function spendHeart() {
    const h = state.game.hearts;
    if (h.count >= HEART_MAX) h.updatedAt = Date.now();
    h.count = Math.max(0, h.count - 1);
    save();
    return h.count;
  }

  function addHearts(n) {
    const h = state.game.hearts;
    h.count = Math.min(HEART_MAX, h.count + n);
    h.updatedAt = Date.now();
    save();
    return h.count;
  }

  // ---------- прогресс курса ----------
  function isNodeDone(stepId) {
    return state.game.completedNodes.includes(stepId);
  }

  function isNodeUnlocked(step) {
    if (isNodeDone(step.id)) return true;
    if (step.globalIndex === 0) return true;
    const prev = STEPS[step.globalIndex - 1];
    return prev ? isNodeDone(prev.id) : true;
  }

  function isUnitUnlocked(unitIndex) {
    const first = STEPS.find((s) => s.unitIndex === unitIndex);
    return first ? isNodeUnlocked(first) : false;
  }

  function courseProgress() {
    const lessons = STEPS.filter((s) => s.type !== 'chest' && s.type !== 'trophy');
    const done = lessons.filter((s) => isNodeDone(s.id)).length;
    return { done, total: lessons.length, ratio: lessons.length ? done / lessons.length : 0 };
  }

  function lessonsDone() {
    return state.game.completedNodes.filter((id) => {
      const s = STEP_BY_ID.get(id);
      return s && s.type !== 'chest' && s.type !== 'trophy';
    }).length;
  }

  function listeningDone() {
    return state.game.completedNodes.filter((id) => {
      const s = STEP_BY_ID.get(id);
      return s && s.type === 'listening';
    }).length;
  }

  function wordsKnownCount() {
    return Object.values(state.vocabKnown || {}).reduce((n, arr) => n + (arr?.length || 0), 0);
  }

  function levelInfo() {
    const xp = state.game.xp;
    const level = 1 + Math.floor(xp / 100);
    const inLevel = xp % 100;
    return { level, inLevel, next: 100, xp };
  }

  function streakActiveToday() {
    return state.game.streak.last === todayKey();
  }

  function touchStreak() {
    const s = state.game.streak;
    const today = todayKey();
    if (s.last === today) return { changed: false, count: s.count, shielded: false };
    if (s.last === null) {
      s.count = 1;
      s.last = today;
      save();
      return { changed: true, count: 1, shielded: false };
    }
    if (s.last === yesterdayKey()) {
      s.count += 1;
      s.last = today;
      save();
      return { changed: true, count: s.count, shielded: false };
    }
    // серия прервалась
    if (state.game.shield > 0) {
      state.game.shield -= 1;
      s.count += 1;
      s.last = today;
      save();
      return { changed: true, count: s.count, shielded: true };
    }
    s.count = 1;
    s.last = today;
    save();
    return { changed: true, count: 1, shielded: false };
  }

  function resetDailyIfNeeded() {
    const today = todayKey();
    if (state.game.daily.date !== today) {
      state.game.daily = { date: today, xp: 0 };
      save();
    }
  }

  function boostMultiplier() {
    return Date.now() < (state.game.boostUntil || 0) ? 2 : 1;
  }

  function boostLeft() {
    return Math.max(0, (state.game.boostUntil || 0) - Date.now());
  }

  function grantXp(base) {
    const gained = Math.round(base * boostMultiplier());
    state.game.xp += gained;
    resetDailyIfNeeded();
    state.game.daily.xp += gained;
    state.game.gems += 5;
    save();
    return gained;
  }

  function achievementStats() {
    const p = courseProgress();
    return {
      lessonsDone: lessonsDone(),
      perfectLessons: state.game.perfectLessons,
      streak: state.game.streak.count,
      wordsKnown: wordsKnownCount(),
      listeningDone: listeningDone(),
      gems: state.game.gems,
      level: levelInfo().level,
      progressRatio: p.ratio
    };
  }

  function unlockedAchievements() {
    const stats = achievementStats();
    return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: !!a.check(stats) }));
  }

  function lessonStepFor(type, ref) {
    return STEP_BY_REF.get(`${type}:${ref}`) || null;
  }

  /** Переносит прогресс старой версии (темы/уроки) в пройденные шаги. */
  function migrateLegacy(legacyCompleted, legacyProgress) {
    if (state.game.completedNodes.length) return;
    const nodes = [];
    (legacyCompleted || []).forEach((lessonId) => {
      const step = lessonStepFor('listening', lessonId);
      if (step) nodes.push(step.id);
    });
    Object.keys(legacyProgress || {}).forEach((topicId) => {
      const topic = GRAMMAR.find((t) => t.id === topicId);
      const entry = legacyProgress[topicId];
      if (!topic || !entry?.answers) return;
      const answered = Object.keys(entry.answers).length;
      if (answered >= (topic.content.exercises || []).length) {
        const step = lessonStepFor('grammar', topicId);
        if (step) nodes.push(step.id);
      }
    });
    if (nodes.length) {
      state.game.completedNodes = Array.from(new Set(nodes));
      state.game.legacyLessons = legacyCompleted || [];
      save();
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme || 'light';
  }

  async function loadState() {
    const savedGame = await Store.get('game', null);
    if (savedGame && typeof savedGame === 'object') {
      state.game = {
        ...JSON.parse(JSON.stringify(DEFAULT_GAME)),
        ...savedGame,
        hearts: { ...DEFAULT_GAME.hearts, ...(savedGame.hearts || {}) },
        streak: { ...DEFAULT_GAME.streak, ...(savedGame.streak || {}) },
        daily: { ...DEFAULT_GAME.daily, ...(savedGame.daily || {}) }
      };
    }
    const savedSettings = await Store.get('settings', null);
    if (savedSettings && typeof savedSettings === 'object') {
      state.settings = { ...state.settings, ...savedSettings };
    }
    state.vocabKnown = (await Store.get('vocabKnown', null)) || {};
    state.progress = (await Store.get('progress', null)) || {};

    if (!Object.keys(state.vocabKnown).length) {
      const legacyVocab = (await Store.get('vocabularyProgress', null)) || {};
      if (Object.keys(legacyVocab).length) state.vocabKnown = legacyVocab;
    }

    const legacyCompleted = (await Store.get('completedLessons', null)) || [];
    migrateLegacy(legacyCompleted, state.progress);

    regenerateHearts();
    resetDailyIfNeeded();
    applyTheme();
  }

  async function resetAll() {
    await Store.clearProgress();
    state.game = JSON.parse(JSON.stringify(DEFAULT_GAME));
    state.game.hearts.updatedAt = Date.now();
    state.vocabKnown = {};
    state.progress = {};
    save();
  }

  // ---------- озвучка ----------
  const tts = {
    synth: window.speechSynthesis,
    token: 0,
    active: false,

    loadVoices() {
      if (!this.synth) return [];
      const all = this.synth.getVoices() || [];
      const en = all.filter((v) => /^en(-|_|$)/i.test(v.lang));
      state.voices = en.length ? en : all;
      return state.voices;
    },

    pickVoice() {
      if (!this.synth) return null;
      const all = this.synth.getVoices() || [];
      if (state.settings.voice) {
        const found = all.find((v) => v.name === state.settings.voice);
        if (found) return found;
      }
      this.loadVoices();
      return (
        state.voices.find((v) => /Google US English|Microsoft Aria|Microsoft Zira|Samantha|Daniel/i.test(v.name)) ||
        state.voices.find((v) => /en-US/i.test(v.lang)) ||
        state.voices[0] ||
        null
      );
    },

    speak(text, opts = {}) {
      if (!this.synth) return null;
      this.stop();
      const u = new window.SpeechSynthesisUtterance(text);
      const voice = opts.voice || this.pickVoice();
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || 'en-US';
      u.rate = opts.rate != null ? opts.rate : Number(state.settings.rate) || 1;
      u.volume = opts.volume != null ? opts.volume : Number(state.settings.volume) || 1;
      if (opts.onEnd) u.onend = opts.onEnd;
      if (opts.onError) u.onerror = opts.onError;
      this.active = true;
      this.synth.speak(u);
      return u;
    },

    stop() {
      if (!this.synth) return;
      this.token++;
      try { this.synth.cancel(); } catch (e) { /* noop */ }
      this.active = false;
    }
  };

  if (window.speechSynthesis) {
    tts.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      tts.loadVoices();
      document.dispatchEvent(new CustomEvent('voices-changed'));
    };
  }

  // ---------- звуки интерфейса ----------
  const Sfx = {
    ctx: null,
    ensure() {
      if (!state.settings.sound) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, duration, type = 'sine', delay = 0, gain = 0.08) {
      const ctx = this.ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime + delay;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration);
    },
    click() { this.tone(600, 0.06, 'triangle', 0, 0.04); },
    correct() { this.tone(659, 0.12, 'sine', 0); this.tone(880, 0.16, 'sine', 0.1); },
    wrong() { this.tone(196, 0.18, 'sawtooth', 0, 0.05); this.tone(165, 0.22, 'sawtooth', 0.12, 0.04); },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'sine', i * 0.1, 0.07));
    },
    chest() {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', i * 0.08, 0.06));
    }
  };

  // ---------- маскот ----------
  /**
   * Сова Оли — маскот приложения.
   * mood: 'happy' | 'wow' | 'sad'
   */
  function owlSvg(size = 96, mood = 'happy') {
    const eyeY = mood === 'sad' ? 104 : 96;
    const pupilY = mood === 'sad' ? eyeY + 4 : eyeY + 2;
    const beakY = mood === 'wow' ? 128 : 118;
    return `
<svg class="owl owl--${mood}" width="${size}" height="${size}" viewBox="0 0 220 220" role="img" aria-label="Сова Оли">
  <ellipse cx="110" cy="206" rx="56" ry="9" fill="rgba(15,23,42,.10)"/>
  <ellipse cx="110" cy="132" rx="74" ry="74" fill="#58cc02"/>
  <ellipse cx="110" cy="152" rx="52" ry="48" fill="#89e219"/>
  <g fill="#46a302">
    <ellipse cx="42" cy="138" rx="17" ry="40" transform="rotate(10 42 138)"/>
    <ellipse cx="178" cy="138" rx="17" ry="40" transform="rotate(-10 178 138)"/>
  </g>
  <path d="M62 68 L70 30 L96 58 Z" fill="#58cc02"/>
  <path d="M158 68 L150 30 L124 58 Z" fill="#58cc02"/>
  <circle cx="80" cy="${eyeY}" r="31" fill="#ffffff"/>
  <circle cx="140" cy="${eyeY}" r="31" fill="#ffffff"/>
  <circle cx="84" cy="${pupilY}" r="14" fill="#3c3c3c"/>
  <circle cx="136" cy="${pupilY}" r="14" fill="#3c3c3c"/>
  <circle cx="89" cy="${pupilY - 5}" r="5" fill="#ffffff"/>
  <circle cx="141" cy="${pupilY - 5}" r="5" fill="#ffffff"/>
  <path d="M110 ${beakY} l16 15 -16 15 -16 -15 Z" fill="#ffc800"/>
  <path d="M110 ${beakY + 8} l7 7 -7 7 -7 -7 Z" fill="#ff9600"/>
  <g fill="#ff9600">
    <rect x="82" y="194" width="20" height="9" rx="4.5"/>
    <rect x="118" y="194" width="20" height="9" rx="4.5"/>
  </g>
</svg>`;
  }

  // ---------- доступ к данным ----------
  function findTopic(id) {
    return GRAMMAR.find((t) => t.id === id) || null;
  }
  function findListening(id) {
    return ALL_LESSONS.find((l) => l.id === id) || null;
  }
  function findVocabSet(id) {
    return VOCAB.find((s) => s.id === id) || null;
  }

  /** Готовит вопросы для урока любого типа. */
  function buildLessonItems(step) {
    if (step.type === 'grammar') {
      const topic = findTopic(step.ref);
      if (!topic) return [];
      const items = [{ type: 'rule', topic }];
      (topic.content.exercises || []).forEach((ex) => {
        items.push({
          type: 'choice',
          prompt: ex.q,
          options: ex.options,
          answer: ex.answer,
          explain: ex.explain,
          source: topic.title
        });
      });
      return items;
    }

    if (step.type === 'listening') {
      const lesson = findListening(step.ref);
      if (!lesson) return [];
      const items = [{ type: 'listen', lesson }];
      lesson.questions.forEach((q) => {
        items.push({
          type: 'choice',
          prompt: q.q,
          options: q.options,
          answer: q.answer,
          explain: 'Прослушайте фрагмент ещё раз и обратите внимание на ключевые слова.',
          source: lesson.title,
          listenText: lesson.textEn
        });
      });
      return items;
    }

    if (step.type === 'vocab') {
      const set = findVocabSet(step.ref);
      if (!set) return [];
      const words = shuffle(set.words).slice(0, 8);
      const pool = ALL_WORDS.filter((w) => w.ru !== '');
      return words.map((w) => {
        const distractors = shuffle(pool.filter((x) => x.ru !== w.ru && x.en !== w.en))
          .slice(0, 3)
          .map((x) => x.ru);
        const options = shuffle([w.ru, ...distractors]);
        return {
          type: 'choice',
          prompt: `Что означает «${w.en}»?`,
          options,
          answer: options.indexOf(w.ru),
          explain: `${w.en} ${w.ipa || ''} — ${w.ru}. Пример: ${w.ex}`,
          source: set.title,
          speak: w.en,
          hint: w.ex,
          isVocab: true
        };
      });
    }

    if (step.type === 'mistakes') {
      const saved = state.game.mistakes || [];
      return shuffle(saved).slice(0, 8).map((m) => ({
        type: 'choice',
        prompt: m.prompt,
        options: m.options,
        answer: m.answer,
        explain: m.explain,
        source: m.source || 'Работа над ошибками',
        speak: m.speak || null,
        listenText: m.listenText || null
      }));
    }

    if (step.type === 'practice') {
      const pool = [];
      GRAMMAR.forEach((topic) => {
        (topic.content.exercises || []).forEach((ex) => {
          pool.push({
            type: 'choice',
            prompt: ex.q,
            options: ex.options,
            answer: ex.answer,
            explain: ex.explain,
            source: topic.title
          });
        });
      });
      ALL_LESSONS.forEach((lesson) => {
        lesson.questions.forEach((q) => {
          pool.push({
            type: 'choice',
            prompt: q.q,
            options: q.options,
            answer: q.answer,
            explain: 'Ключевая фраза: ' + (lesson.scriptTips || lesson.title),
            source: lesson.title
          });
        });
      });
      ALL_WORDS.forEach((w) => {
        const distractors = shuffle(ALL_WORDS.filter((x) => x.ru !== w.ru))
          .slice(0, 3)
          .map((x) => x.ru);
        const options = shuffle([w.ru, ...distractors]);
        pool.push({
          type: 'choice',
          prompt: `Что означает «${w.en}»?`,
          options,
          answer: options.indexOf(w.ru),
          explain: `${w.en} — ${w.ru}`,
          source: 'Словарь',
          speak: w.en
        });
      });
      return shuffle(pool).slice(0, 8);
    }

    return [];
  }

  window.GE = {
    // данные
    GRAMMAR, LISTENING, VOCAB, COURSE, ACHIEVEMENTS, SHOP_ITEMS,
    ALL_LESSONS, ALL_TOPICS, ALL_WORDS, STEPS, STEP_BY_ID, STEP_BY_REF,
    // состояние
    state, Store, HEART_MAX, HEART_REGEN_MS,
    // утилиты
    $, $$, escapeHtml, formatInline, shuffle, plural, todayKey, formatMinutes,
    // прогресс
    isNodeDone, isNodeUnlocked, isUnitUnlocked, courseProgress, lessonsDone,
    listeningDone, wordsKnownCount, levelInfo, streakActiveToday, touchStreak,
    resetDailyIfNeeded, boostMultiplier, boostLeft, grantXp,
    achievementStats, unlockedAchievements, lessonStepFor,
    // сердца
    regenerateHearts, nextHeartIn, spendHeart, addHearts,
    // прочее
    loadState, save, resetAll, applyTheme, tts, Sfx, owlSvg, findTopic, findListening,
    findVocabSet, buildLessonItems, hasElectron
  };
})();
