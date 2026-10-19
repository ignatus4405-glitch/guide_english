// Grammar curriculum — подробные правила на русском
// Экспортируется как window.GRAMMAR_TOPICS в браузере (без модулей) и module.exports для Node.
const GRAMMAR_TOPICS = [
  {
    id: 'alphabet-pronunciation',
    title: 'Алфавит и произношение',
    level: 'A0–A1',
    icon: '🔤',
    estMinutes: 25,
    summary: '26 букв, звуки, транскрипция и базовые правила чтения.',
    content: {
      rule: `
        <p>Английский алфавит состоит из <b>26 букв</b>: 5 гласных (A, E, I, O, U) и 21 согласной. Важно не путать <i>название буквы</i> и <i>звук</i>: буква «A» [ei], а звук — [æ] как в <b>cat</b>.</p>
        <p>Ключевые правила чтения:</p>
        <ul>
          <li><b>c</b> → [k] перед a,o,u (cat) и [s] перед e,i,y (city, cycle)</li>
          <li><b>g</b> → [g] (go) и [dʒ] перед e,i,y (gentle, gym) — есть исключения</li>
          <li><b>-tion</b> читается [ʃn] (nation), <b>-ght</b> — немое gh (light [lait])</li>
          <li>E на конце часто не читается, но удлиняет гласную: bike [baik], cake [keik]</li>
        </ul>
      `,
      examples: [
        { en: 'Apple [ˈæpl] — яблоко', ru: 'Звук [æ] — рот широко открыт' },
        { en: 'Cake [keɪk] — торт', ru: 'Конечная e удлиняет a → [ei]' },
        { en: 'Light [laɪt] — свет', ru: 'gh не читается' },
        { en: 'City [ˈsɪti] — город', ru: 'c перед i → [s]' }
      ],
      table: {
        headers: ['Буква', 'Название', 'Звук', 'Пример'],
        rows: [
          ['A a', '[ei]', '[æ], [ei], [ɑː]', 'cat, cake, car'],
          ['C c', '[siː]', '[k] / [s]', 'cat / city'],
          ['E e', '[iː]', '[e], [iː]', 'bed, be'],
          ['G g', '[dʒiː]', '[g] / [dʒ]', 'go / gentle'],
          ['Th th', '—', '[θ] / [ð]', 'think [θ] / this [ð]']
        ]
      },
      pitfalls: 'Самая частая ошибка — читать «как написано». Английское чтение нужно учить через транскрипцию. Не говорите «лайт» как «лигхт» — gh немая.',
      exercises: [
        { q: 'Как читается слово <b>cake</b>?', options: ['[kæk]', '[keɪk]', '[kɑːk]'], answer: 1, explain: 'Конечная e делает a долгой: [keɪk].' },
        { q: 'Какой звук даёт <b>c</b> в слове <b>city</b>?', options: ['[k]', '[s]', '[tʃ]'], answer: 1, explain: 'Перед i, e, y → [s].' },
        { q: 'Выберите слово, где <b>gh</b> не читается', options: ['ghost', 'light', 'gh'] , answer: 1, explain: 'В light gh немая: [laɪt]. В ghost — [g].'}
      ]
    }
  },
  {
    id: 'present-simple',
    title: 'Present Simple — простое настоящее',
    level: 'A1',
    icon: '🕒',
    estMinutes: 30,
    summary: 'Формула, когда используется, маркеры времени, исключения.',
    content: {
      rule: `
        <p><b>Формула:</b> <code>I/You/We/They + V</code> | <code>He/She/It + V-s</code></p>
        <p><b>Используем</b> для: привычек, расписаний, фактов, инструкций.</p>
        <p><b>Маркеры:</b> always, usually, often, sometimes, never, every day/week, on Mondays.</p>
        <p><b>Отрицание:</b> do not / does not + V → <i>I don't like coffee. She doesn't play tennis.</i></p>
        <p><b>Вопрос:</b> Do/Does + подлежащее + V? → <i>Do you work here? Does he speak English?</i></p>
      `,
      examples: [
        { en: 'I live in Amsterdam.', ru: 'Я живу в Амстердаме. (факт)' },
        { en: 'She works at a hospital.', ru: 'Она работает в больнице. (+s!)' },
        { en: 'The train leaves at 8:15.', ru: 'Поезд отправляется в 8:15. (расписание)' },
        { en: 'I don’t eat meat. Does he smoke?', ru: 'Отрицание и вопрос' }
      ],
      table: {
        headers: ['Лицо', 'Утверждение', 'Отрицание', 'Вопрос'],
        rows: [
          ['I / You / We / They', 'I play', "I don't play", 'Do I play?'],
          ['He / She / It', 'He plays', "He doesn't play", 'Does he play?']
        ]
      },
      pitfalls: 'Забывают -s в 3-м лице: не <s>He play</s> а <b>He plays</b>. И не добавляют -s после does: не <s>Does he plays?</s> а <b>Does he play?</b>',
      exercises: [
        { q: 'She ___ (work) in Berlin.', options: ['work', 'works', 'working'], answer: 1, explain: 'He/She/It + s → works' },
        { q: '___ you like pizza?', options: ['Do', 'Does', 'Are'], answer: 0, explain: 'Do + you' },
        { q: 'He ___ coffee.', options: ["don't drink", "doesn't drink", "doesn't drinks"], answer: 1, explain: 'После does — глагол без s.' }
      ]
    }
  },
  {
    id: 'present-continuous',
    title: 'Present Continuous — настоящее длительное',
    level: 'A1–A2',
    icon: '⏳',
    estMinutes: 30,
    summary: 'Действие сейчас, временные ситуации, раздражение с always.',
    content: {
      rule: `
        <p><b>Формула:</b> <code>am/is/are + V-ing</code></p>
        <p><b>Когда:</b></p>
        <ul>
          <li>Сейчас в момент речи: <i>I'm reading now.</i></li>
          <li>Вокруг сейчас (временно): <i>She's living in Amsterdam these days.</i></li>
          <li>Запланированное будущее: <i>I'm meeting John tomorrow.</i></li>
          <li>Раздражение: <i>You're always losing your keys!</i></li>
        </ul>
        <p><b>Маркеры:</b> now, at the moment, right now, currently, these days, look!, listen!</p>
        <p><b>Статические глаголы</b> обычно НЕ в Continuous: know, believe, love, hate, want, need, understand, remember.</p>
      `,
      examples: [
        { en: "I'm studying English.", ru: 'Я сейчас изучаю английский.' },
        { en: 'Listen! The baby is crying.', ru: 'Слушай! Ребёнок плачет.' },
        { en: 'She is always complaining!', ru: 'Она вечно жалуется! (раздражение)' }
      ],
      table: {
        headers: ['Форма', 'Пример'],
        rows: [
          ['Утверждение', 'I am working / She is working / They are working'],
          ['Отрицание', "I’m not working / She isn’t working"],
          ['Вопрос', 'Are you working? What are you doing?']
        ]
      },
      pitfalls: 'Не путать: <b>I live in Berlin</b> (постоянно) vs <b>I’m living in Berlin</b> (временно, например на полгода).',
      exercises: [
        { q: 'Look! It ___ (rain).', options: ['rains', 'is raining', 'rain'], answer: 1, explain: 'Сейчас → Continuous' },
        { q: 'I ___ (know) the answer.', options: ['know', 'am knowing', 'knows'], answer: 0, explain: 'know — статический, не в -ing' },
        { q: '___ you ___ (work) now?', options: ['Do / work', 'Are / working', 'Is / working'], answer: 1, explain: 'Are you working now?' }
      ]
    }
  },
  {
    id: 'past-simple',
    title: 'Past Simple — простое прошедшее',
    level: 'A1–A2',
    icon: '📅',
    estMinutes: 35,
    summary: 'Законченные действия в прошлом, правильные и неправильные глаголы.',
    content: {
      rule: `
        <p><b>Формула:</b> <code>V-ed</code> (правильные) / 2-я форма (неправильные)</p>
        <p><b>Правильные:</b> play → played, want → wanted, stop → stopped (удвоение)</p>
        <p><b>Неправильные:</b> go → went, see → saw, eat → ate, have → had (учить списком)</p>
        <p><b>Отрицание/Вопрос:</b> did not + V / Did + S + V? → <i>Did you see him? I didn't go.</i> (глагол без -ed!)</p>
        <p><b>Маркеры:</b> yesterday, last week/month, two days ago, in 2019, when I was a child.</p>
      `,
      examples: [
        { en: 'I visited London last year.', ru: 'Я посетил Лондон в прошлом году.' },
        { en: 'She went to the cinema yesterday.', ru: 'Она ходила в кино вчера. (went, не goed)' },
        { en: 'Did you finish? — Yes, I did. / No, I didn’t.', ru: 'Короткие ответы с did' }
      ],
      table: {
        headers: ['Тип', 'Пример', 'Отрицание', 'Вопрос'],
        rows: [
          ['Правильный', 'I worked', "I didn't work", 'Did you work?'],
          ['Неправильный', 'I went', "I didn't go", 'Did you go?'],
          ['to be', 'I was / You were', "I wasn't", 'Were you?']
        ]
      },
      pitfalls: 'После did глагол возвращается к базовой форме: не <s>Did you went?</s> а <b>Did you go?</b>. Вторая ошибка — was/were: I was, you were.',
      exercises: [
        { q: 'We ___ (go) to Rome in 2022.', options: ['goed', 'went', 'have gone'], answer: 1, explain: 'go → went (неправильный)' },
        { q: 'She ___ (not / call) me yesterday.', options: ["didn't called", "didn't call", 'not called'], answer: 1, explain: 'didn’t + базовая форма' },
        { q: '___ you ___ TV last night?', options: ['Did / watched', 'Did / watch', 'Watched / you'], answer: 1, explain: 'Did you watch?' }
      ]
    }
  },
  {
    id: 'articles',
    title: 'Артикли a/an, the, нулевой',
    level: 'A2',
    icon: '📝',
    estMinutes: 40,
    summary: 'Когда нужен артикль, а когда нет. Исчисляемые/неисчисляемые.',
    content: {
      rule: `
        <p><b>a/an</b> — один из многих, впервые упоминаем: <i>I saw a dog. A cat is an animal.</i> an перед гласным звуком: an apple, an hour (h немая).</p>
        <p><b>the</b> — конкретный, единственный, уже известный: <i>The dog I saw was big. The sun is hot.</i></p>
        <p><b>Нулевой (—)</b> с: множественным числом в общем смысле (<i>Cats are cute</i>), неисчисляемыми (<i>Water is important</i>), именами, днями, месяцами.</p>
        <p><b>Запомнить:</b> go to school / go to the cinema, play football / play the piano, at home / in the house.</p>
      `,
      examples: [
        { en: 'I need a new phone.', ru: 'Мне нужен (какой-то) новый телефон.' },
        { en: 'The phone I bought is great.', ru: 'Телефон, который я купил, отличный. (конкретный)' },
        { en: 'Life is beautiful.', ru: 'Жизнь прекрасна. (нулевой артикль)' },
        { en: 'She plays the guitar.', ru: 'Она играет на гитаре. (the с инструментами)' }
      ],
      table: {
        headers: ['Артикль', 'Когда', 'Пример'],
        rows: [
          ['a / an', 'Один из многих, исчисляемое ед.ч.', 'I have a car / an umbrella'],
          ['the', 'Конкретный, уникальный', 'The car is red. The earth'],
          ['— (нулевой)', 'Мн.ч. в общем, неисчисляемые, имена', 'I love music. Go to school']
        ]
      },
      pitfalls: 'Не ставьте артикль с притяжательными: не <s>the my book</s> а <b>my book</b>. И не путайте a/an по написанию — важно по звуку: an hour, a university [juː].',
      exercises: [
        { q: 'I saw ___ elephant.', options: ['a', 'an', 'the'], answer: 1, explain: 'elephant начинается с гласного звука → an' },
        { q: '___ sun is shining.', options: ['A', 'The', '—'], answer: 1, explain: 'Уникальный объект → The sun' },
        { q: 'She plays ___ piano.', options: ['a', 'the', '—'], answer: 1, explain: 'С музыкальными инструментами — the' }
      ]
    }
  },
  {
    id: 'future-forms',
    title: 'Способы выражения будущего',
    level: 'A2',
    icon: '🔮',
    estMinutes: 35,
    summary: 'will, going to, Present Continuous и Present Simple для будущего.',
    content: {
      rule: `
        <p><b>will</b> — спонтанное решение, предсказание, обещание: <i>I’ll call you later. I think it will rain.</i></p>
        <p><b>going to</b> — намерение, план, очевидное будущее: <i>I’m going to study abroad. Look at those clouds — it’s going to rain.</i></p>
        <p><b>Present Continuous</b> — договорённость: <i>We’re meeting at 7 pm. She’s flying to London tomorrow.</i></p>
        <p><b>Present Simple</b> — расписание: <i>The train leaves at 6. The course starts on Monday.</i></p>
      `,
      examples: [
        { en: '— The phone is ringing. — I’ll answer it!', ru: 'Спонтанное решение → will' },
        { en: 'I’m going to buy a new laptop next month.', ru: 'План → going to' },
        { en: 'We are having dinner with Anna tonight.', ru: 'Договорённость → Present Continuous' },
        { en: 'My flight departs at 23:40.', ru: 'Расписание → Present Simple' }
      ],
      table: {
        headers: ['Форма', 'Когда используем', 'Пример'],
        rows: [
          ['will', 'Решение в момент речи', 'I’ll help you!'],
          ['going to', 'План/намерение', 'I’m going to learn French'],
          ['am/is/are V-ing', 'Договорённость', 'I’m meeting Tom at 5'],
          ['Present Simple', 'Расписание', 'The bus arrives at 7']
        ]
      },
      pitfalls: 'Не говорите <s>I will going to</s>. will и going to — разные конструкции. Для предсказаний с evidence используйте going to: <i>Be careful! You’re going to fall!</i>',
      exercises: [
        { q: 'I think Brazil ___ (win) the match.', options: ['wins', 'is going to win', 'will win'], answer: 2, explain: 'Мнение/предсказание → will' },
        { q: 'Watch out! You ___ (drop) the glass!', options: ['will drop', 'are going to drop', 'drop'], answer: 1, explain: 'Очевидное будущее по признакам → going to' },
        { q: 'The lessons ___ (start) at 9 am tomorrow.', options: ['start', 'are starting', 'will start'], answer: 0, explain: 'Расписание → Present Simple' }
      ]
    }
  },
  {
    id: 'modals',
    title: 'Модальные глаголы: can, must, should, may',
    level: 'A2',
    icon: '💡',
    estMinutes: 30,
    summary: 'Возможность, необходимость, совет, разрешение.',
    content: {
      rule: `
        <p><b>can / can’t</b> — умение, возможность, разрешение/просьба: <i>I can swim. Can you help me? You can’t park here.</i></p>
        <p><b>must / mustn’t</b> — сильная необходимость/запрет: <i>You must wear a seatbelt. You mustn’t smoke here.</i></p>
        <p><b>have to</b> — внешнее правило: <i>I have to work on Saturdays.</i> (отриц. don’t have to = не обязан)</p>
        <p><b>should / shouldn’t</b> — совет: <i>You should see a doctor. Should I call him?</i></p>
        <p><b>may / might</b> — возможность 50/50: <i>It may rain later.</i> | <b>could</b> — вежливая просьба: <i>Could you open the window?</i></p>
      `,
      examples: [
        { en: 'You mustn’t be late.', ru: 'Тебе нельзя опаздывать. (запрет)' },
        { en: 'You don’t have to come early.', ru: 'Тебе не обязательно приходить рано. (не запрет!)' },
        { en: 'Should I buy this jacket?', ru: 'Стоит ли мне купить эту куртку?' }
      ],
      table: {
        headers: ['Модальный', 'Значение', 'Пример'],
        rows: [
          ['can', 'Умею / могу', 'I can speak 3 languages'],
          ['must', 'Должен (я так считаю)', 'You must try this cake!'],
          ['have to', 'Должен (правила извне)', 'I have to go now'],
          ['should', 'Совет', 'You should rest more']
        ]
      },
      pitfalls: 'После модальных — голый инфинитив без to: не <s>can to go</s> а <b>can go</b>. Исключение: have to, ought to.',
      exercises: [
        { q: 'You ___ smoke in the hospital.', options: ['must not', 'mustn’t', 'don’t have to'], answer: 1, explain: 'Запрет → mustn’t' },
        { q: 'You ___ bring your passport. (не обязательно)', options: ["mustn't", "don't have to", 'shouldn’t'], answer: 1, explain: 'Не обязан → don’t have to' },
        { q: '___ you help me, please?', options: ['Must', 'Should', 'Could'], answer: 2, explain: 'Вежливая просьба → Could' }
      ]
    }
  },
  {
    id: 'conditionals',
    title: 'Условные предложения 0, 1, 2',
    level: 'B1',
    icon: '🔀',
    estMinutes: 45,
    summary: 'If + Present → будущее, нереальные ситуации и общие истины.',
    content: {
      rule: `
        <p><b>Zero Conditional</b> (общие истины): <code>If + Present Simple, Present Simple</code> → <i>If you heat water, it boils.</i></p>
        <p><b>First Conditional</b> (реально в будущем): <code>If + Present Simple, will + V</code> → <i>If it rains, we’ll stay home.</i></p>
        <p><b>Second Conditional</b> (нереально сейчас): <code>If + Past Simple, would + V</code> → <i>If I were you, I’d call him. If I had money, I’d travel.</i></p>
        <p><b>Важно:</b> после if не используем will! Не <s>If it will rain</s> а <b>If it rains</b>.</p>
      `,
      examples: [
        { en: 'If you press this button, the door opens.', ru: 'Если нажать кнопку, дверь открывается. (Zero)' },
        { en: 'If I finish early, I will call you.', ru: 'Если закончу рано, позвоню. (First)' },
        { en: 'If I lived in Spain, I would speak Spanish every day.', ru: 'Если бы я жил в Испании... (Second, сейчас не живу)' }
      ],
      table: {
        headers: ['Тип', 'Формула', 'Пример'],
        rows: [
          ['Zero', 'If + PS, PS', 'If you mix red and blue, you get purple'],
          ['First', 'If + PS, will V', 'If she studies, she will pass'],
          ['Second', 'If + Past, would V', 'If I were rich, I’d buy a yacht']
        ]
      },
      pitfalls: 'Частая калька с русского: <s>If I will have time</s> → правильно <b>If I have time</b>. Во втором типе I/He/She/It → were (If I were you).',
      exercises: [
        { q: 'If it ___ (be) sunny, we’ll go to the park.', options: ['will be', 'is', 'was'], answer: 1, explain: 'First Conditional: If + Present → will' },
        { q: 'If I ___ (be) you, I wouldn’t do it.', options: ['am', 'were', 'will be'], answer: 1, explain: 'Second: If I were you' },
        { q: 'If you heat ice, it ___ (melt).', options: ['melts', 'will melt', 'would melt'], answer: 0, explain: 'Zero: общая истина → Present' }
      ]
    }
  },
  {
    id: 'present-perfect',
    title: 'Present Perfect — настоящее совершённое',
    level: 'B1',
    icon: '✅',
    estMinutes: 40,
    summary: 'Опыт и результат к настоящему моменту: have/has + V3.',
    content: {
      rule: `
        <p><b>Формула:</b> <code>have/has + V3</code> (3-я форма или -ed)</p>
        <p><b>Когда используем:</b></p>
        <ul>
          <li>Опыт в жизни (без указания времени): <i>I have visited London twice.</i></li>
          <li>Результат важен сейчас: <i>I’ve lost my keys — I can’t get in.</i></li>
          <li>Действие началось в прошлом и продолжается: <i>I have lived here since 2020.</i></li>
        </ul>
        <p><b>Маркеры:</b> ever, never, just, already, yet, since, for, so far, recently.</p>
        <p><b>Сравните:</b> <i>I have been to Paris</i> (опыт, когда — неважно) vs <i>I went to Paris in 2019</i> (конкретное время → Past Simple).</p>
      `,
      examples: [
        { en: 'I have never eaten sushi.', ru: 'Я никогда не ел суши.' },
        { en: 'She has just finished her homework.', ru: 'Она только что закончила домашнее задание.' },
        { en: 'Have you ever been to Scotland?', ru: 'Ты когда-нибудь был в Шотландии?' },
        { en: 'We have lived here for five years.', ru: 'Мы живём здесь пять лет. (for + период)' }
      ],
      table: {
        headers: ['Форма', 'Пример', 'Отрицание', 'Вопрос'],
        rows: [
          ['I / You / We / They', 'I have worked', "I haven't worked", 'Have you worked?'],
          ['He / She / It', 'He has worked', "He hasn't worked", 'Has he worked?'],
          ['Since / For', 'since 2020 (точка)', 'for two years (период)', 'How long have you…?']
        ]
      },
      pitfalls: 'Не используйте Present Perfect с конкретным прошедшим временем: не <s>I have seen him yesterday</s> а <b>I saw him yesterday</b>. И не путайте since (с какого момента) и for (сколько времени).',
      exercises: [
        { q: 'I ___ (never / be) to Japan.', options: ['never was', 'have never been', 'has never been'], answer: 1, explain: 'Опыт → have + V3, never ставится перед глаголом.' },
        { q: 'She ___ (just / finish) her homework.', options: ['just finished', 'has just finished', 'have just finished'], answer: 1, explain: 'She → has, just после have/has.' },
        { q: '___ you ever ___ (eat) Thai food?', options: ['Did / eat', 'Have / eaten', 'Has / ate'], answer: 1, explain: 'Have you ever eaten…?' }
      ]
    }
  },
  {
    id: 'comparatives',
    title: 'Степени сравнения прилагательных',
    level: 'A2',
    icon: '📊',
    estMinutes: 30,
    summary: 'Сравниваем предметы: -er, more, the best, as … as.',
    content: {
      rule: `
        <p><b>Сравнительная степень</b> (двое):</p>
        <ul>
          <li>Короткие слова (1–2 слога): <code>+ -er</code> → <i>bigger, cheaper, faster</i></li>
          <li>Длинные (2+ слога): <code>more + прилагательное</code> → <i>more expensive, more interesting</i></li>
          <li>Неправильные: good → better, bad → worse, far → further/farther</li>
        </ul>
        <p><b>Превосходная</b> (все): <code>the + -est</code> / <code>the most + прил.</code> → <i>the biggest, the most beautiful</i></p>
        <p><b>Сравнение:</b> <i>than</i> (London is bigger than Berlin), <i>as … as</i> (as fast as), <i>not as … as</i>.</p>
        <p><b>Правило написания:</b> big → bigger (удвоение), happy → happier (y → i), nice → nicer (+r).</p>
      `,
      examples: [
        { en: 'This phone is cheaper than that one.', ru: 'Этот телефон дешевле того.' },
        { en: 'English is more useful than I thought.', ru: 'Английский полезнее, чем я думал.' },
        { en: 'It’s the best coffee in town.', ru: 'Это лучший кофе в городе.' },
        { en: 'She is as tall as her brother.', ru: 'Она такая же высокая, как её брат.' }
      ],
      table: {
        headers: ['Прилагательное', 'Сравнительная', 'Превосходная'],
        rows: [
          ['cheap', 'cheaper', 'the cheapest'],
          ['big', 'bigger', 'the biggest'],
          ['happy', 'happier', 'the happiest'],
          ['expensive', 'more expensive', 'the most expensive'],
          ['good / bad', 'better / worse', 'the best / the worst']
        ]
      },
      pitfalls: 'Нельзя использовать две степени сразу: не <s>more better</s>. И не забывайте the перед превосходной: <b>the most beautiful city</b>.',
      exercises: [
        { q: 'This bag is ___ (cheap) than mine.', options: ['cheaper', 'more cheap', 'the cheapest'], answer: 0, explain: 'Короткое прилагательное → -er.' },
        { q: 'It is ___ (interesting) book I have read.', options: ['more interesting', 'the most interesting', 'most interesting'], answer: 1, explain: 'Превосходная → the most interesting.' },
        { q: 'My results are ___ than last year.', options: ['good', 'better', 'the best'], answer: 1, explain: 'good → better (неправильная форма).' }
      ]
    }
  }
];


if (typeof module !== 'undefined' && module.exports) module.exports = GRAMMAR_TOPICS;
if (typeof window !== 'undefined') window.GRAMMAR_TOPICS = GRAMMAR_TOPICS;
