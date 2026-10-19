// Listening curriculum — тексты для аудирования озвучиваются через Web Speech API (TTS)
// Каждый урок содержит текст, который можно озвучить с выбором голоса и скорости.
const LISTENING_LEVELS = [
  {
    id: 'beginner',
    title: 'Beginner — A1',
    desc: 'Короткие диалоги: знакомство, кафе, отель. Медленный темп.',
    icon: '🌱',
    lessons: [
      {
        id: 'b1-introductions',
        title: 'Знакомство в Амстердаме',
        duration: '1:20',
        difficulty: '★☆☆',
        textEn: `Hello! My name is Anna. I am from Poland, but I live in Amsterdam now. I am 24 years old. I work as a designer. I love coffee and cycling. What about you? Where are you from? What do you do? Nice to meet you!`,
        textRu: 'Привет! Меня зовут Анна. Я из Польши, но сейчас живу в Амстердаме. Мне 24 года. Я работаю дизайнером. Люблю кофе и велосипеды.',
        questions: [
          { q: 'Where does Anna live now?', options: ['In Poland', 'In Amsterdam', 'In Berlin'], answer: 1 },
          { q: 'How old is she?', options: ['22', '24', '26'], answer: 1 },
          { q: 'What is her job?', options: ['Teacher', 'Designer', 'Doctor'], answer: 1 }
        ],
        scriptTips: 'Обрати внимание на: I am from... I live in... I work as a...'
      },
      {
        id: 'b2-cafe',
        title: 'В кафе',
        duration: '1:45',
        difficulty: '★☆☆',
        textEn: `Good morning! Can I help you? Yes, please. I would like a cappuccino and a croissant. Sure. Would you like it to stay or to go? To stay, please. Would you like sugar? No, thank you. That will be four euros fifty. Here you are. Thank you! Enjoy your coffee!`,
        textRu: 'Доброе утро! Чем могу помочь? — Я бы хотел капучино и круассан. — Желаете здесь или с собой?',
        questions: [
          { q: 'What does the customer order?', options: ['Tea and cake', 'Cappuccino and croissant', 'Coffee and sandwich'], answer: 1 },
          { q: 'How much does it cost?', options: ['€3.50', '€4.50', '€5.00'], answer: 1 },
          { q: 'Does the customer want sugar?', options: ['Yes', 'No', 'Not mentioned'], answer: 1 }
        ],
        scriptTips: 'Фразы: I would like..., Would you like...?, That will be...'
      },
      {
        id: 'b3-hotel',
        title: 'Бронирование отеля',
        duration: '2:00',
        difficulty: '★★☆',
        textEn: `Hello, I have a reservation under the name Smith. For how many nights? For three nights, from Friday to Monday. Do you prefer a single or double room? A double room with a city view, please. Breakfast is included from seven to ten. Check-out is at eleven. Thank you!`,
        textRu: 'Здравствуйте, у меня бронь на имя Smith. — На сколько ночей? — На три ночи...',
        questions: [
          { q: 'How many nights is the reservation for?', options: ['2', '3', '4'], answer: 1 },
          { q: 'What kind of room does the guest want?', options: ['Single', 'Double with city view', 'Double with sea view'], answer: 1 },
          { q: 'When is check-out?', options: ['10am', '11am', '12pm'], answer: 1 }
        ],
        scriptTips: 'I have a reservation, For how many nights?, Check-out is at...'
      }
    ]
  },
  {
    id: 'elementary',
    title: 'Elementary — A2',
    desc: 'Повседневные ситуации: покупки, транспорт, работа.',
    icon: '🌿',
    lessons: [
      {
        id: 'e1-shopping',
        title: 'Покупки в магазине',
        duration: '2:10',
        difficulty: '★★☆',
        textEn: `Excuse me, how much is this jacket? It's sixty nine euros. Do you have it in medium? Let me check. Yes, we do. Would you like to try it on? Yes, please. Where is the fitting room? Over there, on the left. Thanks. It fits perfectly! Great, I'll take it. Would you like a bag? Yes, please.`,
        textRu: 'Извините, сколько стоит эта куртка? — 69 евро. — Есть размер M?',
        questions: [
          { q: 'How much is the jacket?', options: ['€59', '€69', '€79'], answer: 1 },
          { q: 'What size does the customer need?', options: ['Small', 'Medium', 'Large'], answer: 1 },
          { q: 'Does the jacket fit?', options: ['Too small', 'Perfectly', 'Too big'], answer: 1 }
        ],
        scriptTips: 'How much is...? Do you have it in...? Try it on, fitting room'
      },
      {
        id: 'e2-directions',
        title: 'Как пройти к музею',
        duration: '2:30',
        difficulty: '★★☆',
        textEn: `Hi, excuse me. I'm looking for the Rijksmuseum. Is it far from here? Not at all. Go straight for two blocks, then turn right. You will see a big park on your left. The museum is right next to the park. How long does it take on foot? About ten minutes. If you prefer, you can take tram number two. Perfect, thank you so much!`,
        textRu: 'Привет, извините. Я ищу Рейксмузеум. Далеко? — Нет, прямо два квартала, потом направо...',
        questions: [
          { q: 'How to get to the museum?', options: ['Go straight then left', 'Go straight then right', 'Turn left immediately'], answer: 1 },
          { q: 'What is near the museum?', options: ['River', 'Park', 'Station'], answer: 1 },
          { q: 'How long on foot?', options: ['5 min', '10 min', '20 min'], answer: 1 }
        ],
        scriptTips: 'Go straight, turn right/left, How long does it take?'
      },
      {
        id: 'e3-job',
        title: 'Собеседование',
        duration: '2:45',
        difficulty: '★★★',
        textEn: `Tell me about yourself. Well, I have three years of experience in marketing. I worked at a startup in Berlin. Why do you want to work here? Because I love your product and I share your values. What are your strengths? I'm creative and I work well in a team. When can you start? I can start in two weeks. Wonderful, we will contact you soon.`,
        textRu: 'Расскажите о себе. — У меня 3 года опыта в маркетинге...',
        questions: [
          { q: 'Where did the candidate work before?', options: ['In Amsterdam', 'In Berlin', 'In London'], answer: 1 },
          { q: 'Why does he want the job?', options: ['Salary', 'Loves product & values', 'Location'], answer: 1 },
          { q: 'When can he start?', options: ['Immediately', 'In 2 weeks', 'In a month'], answer: 1 }
        ],
        scriptTips: 'Tell me about yourself, strengths, When can you start?'
      }
    ]
  },
  {
    id: 'intermediate',
    title: 'Intermediate — B1–B2',
    desc: 'Новости, мнения, путешествия. Естественный темп носителей.',
    icon: '🌳',
    lessons: [
      {
        id: 'i1-travel',
        title: 'Путешествие в Шотландию',
        duration: '3:00',
        difficulty: '★★★',
        textEn: `Last summer I travelled to Scotland with my friends. We rented a car and drove through the Highlands. The landscapes were breathtaking — green hills, old castles and lakes. The weather was unpredictable. One moment it was sunny, the next it was raining. We stayed in small cottages and tried haggis. It was surprisingly delicious! I recommend visiting in May or June when the days are long.`,
        textRu: 'Прошлым летом я путешествовал по Шотландии с друзьями. Мы арендовали машину и проехали через Хайленд...',
        questions: [
          { q: 'How did they travel around Scotland?', options: ['By train', 'By rented car', 'By bike'], answer: 1 },
          { q: 'What was the weather like?', options: ['Always sunny', 'Unpredictable', 'Always rainy'], answer: 1 },
          { q: 'When does the speaker recommend visiting?', options: ['Winter', 'May or June', 'Autumn'], answer: 1 }
        ],
        scriptTips: 'Past Simple narration, breathtaking, unpredictable, recommend'
      },
      {
        id: 'i2-news',
        title: 'Новости: удалённая работа',
        duration: '3:15',
        difficulty: '★★★',
        textEn: `Good evening. In today’s news: more and more companies in the Netherlands are offering hybrid work. Employees work from home two or three days a week and go to the office the rest of the time. Studies show that productivity has not decreased. However, some managers worry that team spirit is harder to maintain. What do you think? Send us your opinion.`,
        textRu: 'Добрый вечер. В новостях: всё больше компаний в Нидерландах предлагают гибридную работу...',
        questions: [
          { q: 'What is hybrid work?', options: ['Only office', 'Only home', 'Mix of home & office'], answer: 2 },
          { q: 'What do studies show?', options: ['Productivity decreased', 'Productivity not decreased', 'No data'], answer: 1 },
          { q: 'What worries managers?', options: ['Costs', 'Team spirit', 'Technology'], answer: 1 }
        ],
        scriptTips: 'News style, passive, formal vocabulary'
      },
      {
        id: 'i3-opinion',
        title: 'Мнение: соцсети',
        duration: '3:30',
        difficulty: '★★★',
        textEn: `If you ask me, social media has both advantages and disadvantages. On the one hand, we can stay in touch with friends and learn new things. On the other hand, many people compare themselves to others and feel anxious. I think we should limit screen time and focus on real life. For example, I deleted Instagram for a month and I felt much happier.`,
        textRu: 'На мой взгляд, соцсети имеют и плюсы и минусы...',
        questions: [
          { q: 'What is one disadvantage mentioned?', options: ['Costs money', 'People feel anxious comparing', 'Hard to use'], answer: 1 },
          { q: 'What did the speaker do?', options: ['Deleted Instagram for a month', 'Quit phone', 'Started blog'], answer: 0 },
          { q: 'What does speaker recommend?', options: ['More screen time', 'Limit screen time', 'Ban social media'], answer: 1 }
        ],
        scriptTips: 'If you ask me, On the one hand..., I think we should...'
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = LISTENING_LEVELS;
if (typeof window !== 'undefined') window.LISTENING_LEVELS = LISTENING_LEVELS;
