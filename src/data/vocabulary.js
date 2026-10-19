const VOCABULARY_SETS = [
  {
    id: 'everyday-100',
    title: '100 самых частых слов',
    level: 'A1',
    icon: '💬',
    words: [
      { en: 'time', ru: 'время', ipa: '[taɪm]', ex: 'What time is it?' },
      { en: 'people', ru: 'люди', ipa: '[ˈpiːpl]', ex: 'Many people live here.' },
      { en: 'work', ru: 'работа, работать', ipa: '[wɜːk]', ex: 'I work from home.' },
      { en: 'good', ru: 'хороший', ipa: '[ɡʊd]', ex: 'Have a good day!' },
      { en: 'first', ru: 'первый', ipa: '[fɜːst]', ex: 'First time in Amsterdam?' },
      { en: 'new', ru: 'новый', ipa: '[njuː]', ex: 'I have a new idea.' },
      { en: 'because', ru: 'потому что', ipa: '[bɪˈkɒz]', ex: "I'm late because of traffic." },
      { en: 'think', ru: 'думать', ipa: '[θɪŋk]', ex: 'I think it will rain.' },
      { en: 'great', ru: 'отличный', ipa: '[ɡreɪt]', ex: 'Great job!' },
      { en: 'through', ru: 'через, сквозь', ipa: '[θruː]', ex: 'Go through the park.' },
      { en: 'need', ru: 'нуждаться', ipa: '[niːd]', ex: 'I need help.' },
      { en: 'different', ru: 'разный', ipa: '[ˈdɪfrənt]', ex: 'We are different.' }
    ]
  },
  {
    id: 'travel',
    title: 'Путешествия и транспорт',
    level: 'A2',
    icon: '✈️',
    words: [
      { en: 'flight', ru: 'рейс', ipa: '[flaɪt]', ex: 'My flight is delayed.' },
      { en: 'booking', ru: 'бронирование', ipa: '[ˈbʊkɪŋ]', ex: 'I have a booking for two nights.' },
      { en: 'luggage', ru: 'багаж', ipa: '[ˈlʌɡɪdʒ]', ex: 'Where is my luggage?' },
      { en: 'departure', ru: 'отправление', ipa: '[dɪˈpɑːtʃə]', ex: 'Departure at 6 pm.' },
      { en: 'arrival', ru: 'прибытие', ipa: '[əˈraɪvl]', ex: 'Arrival on time.' },
      { en: 'delay', ru: 'задержка', ipa: '[dɪˈleɪ]', ex: 'Sorry for the delay.' },
      { en: 'ticket', ru: 'билет', ipa: '[ˈtɪkɪt]', ex: 'Show your ticket, please.' },
      { en: 'platform', ru: 'платформа', ipa: '[ˈplætfɔːm]', ex: 'Train at platform 3.' }
    ]
  },
  {
    id: 'business',
    title: 'Работа и бизнес',
    level: 'B1',
    icon: '💼',
    words: [
      { en: 'meeting', ru: 'встреча, совещание', ipa: '[ˈmiːtɪŋ]', ex: "We have a meeting at 10." },
      { en: 'deadline', ru: 'дедлайн', ipa: '[ˈdedlaɪn]', ex: 'The deadline is Friday.' },
      { en: 'colleague', ru: 'коллега', ipa: '[ˈkɒliːɡ]', ex: 'My colleague helped me.' },
      { en: 'salary', ru: 'зарплата', ipa: '[ˈsæləri]', ex: 'Good salary and benefits.' },
      { en: 'experience', ru: 'опыт', ipa: '[ɪkˈspɪəriəns]', ex: '5 years of experience.' },
      { en: 'offer', ru: 'предложение', ipa: '[ˈɒfə]', ex: 'They made me an offer.' },
      { en: 'negotiate', ru: 'вести переговоры', ipa: '[nɪˈɡəʊʃieɪt]', ex: 'We need to negotiate the price.' }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = VOCABULARY_SETS;
if (typeof window !== 'undefined') window.VOCABULARY_SETS = VOCABULARY_SETS;
