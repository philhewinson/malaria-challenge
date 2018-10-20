const assert = require('assert')

const moo = require("moo")

const { testEmoji } = require("./emojis")

const keywordsIgnoreCase = keywords => {
  const transform = moo.keywords(keywords)
  return value => transform(value.toLowerCase())
}

const lexer = moo.compile({
  emoji: {
    match: testEmoji,
    type: moo.keywords({
      greeting: ['👋'],
      yes: ['👍', '👌', '🆗'],
    }),
  },
  question: '?',
  punc: /[.!@£$%^&*=_+{}[\];':"|\/<>,.`~()-]/,
  space: { match: /\s+/, lineBreaks: true },
  word: {
    match: /[^ \t\n\r\f.!@£$%^&*=_+(){}[\];:"|\/?<>,.`~-]+/,
    type: keywordsIgnoreCase({
      yes: ['y', 'yes', 'yeah', 'ye', 'yea', 'ok', 'sure', 'ya', 'great', 'k', 'fine', 'okay', 'cool', 'o', 'oh'],
      no: ['n', 'no', 'nope', 'nop', 'nah', 'na', 'eh'],
      invite: ['invite', 'share', 'refer'],
      greeting: ['hello', 'hi', 'yo', 'heya', 'hey', 'he', 'sup'],
      question: ['what', 'who', 'how', 'why', 'where', 'wha', 'which', 'will'],
      bye: ['bye', 'gtg', 'leave', 'later', 'away', 'cya', 'stop', 'unsubscribe'],
      gratitude: ['thank', 'thanks', 'thx', 'thks', 'thk', 'tu'],
      reset: ['reset', 'restart', 'wipe'],
      buy: ['donate', 'buy', 'pay', 'purchase'],

      malaria: ['malaria'],
      mosquito: ['mosquito', 'mozzie', 'mozie'],
      net: ['net', 'nets'],
      game: ['game', 'challenge'],
      score: ['score', 'rank', 'leaderboard', 'progress'],
      language: ['english', 'language'],

      negation: ['never', 'no', 'not', "don't", "won't", "shan't", "can't"],

      persuade: ['might','maybe','unsure','consider', 'convinced'],      
      paid: ['paid', 'complete'],
        

    }),
  },
})

function parseIntent(message) {
  lexer.reset(message)
  var tokens = Array.from(lexer)

  const result = {
    intent: 'unknown',
  }

  for (let type of [
    'buy',
    'score',
    'malaria',
    'mosquito',
    'net',
    'game',
  ]) {
    if (tokens.find(tok => tok.type === type)) {
      result.intent = 'question'
      result.content = type
      break
    }
  }

  for (let type of [
    'reset',
    'persuade',
    'paid',
    'bye',
    'greeting',
    'question',
    'buy',
    'no',
    'yes',
    'invite',
    'invite',
    'gratitude',
    'help',
    'emoji',
  ]) {
    let tok
    if (tok = tokens.find(tok => tok.type === type)) {
      result.intent = type
      if (type === 'question') {
        result.question = tok.value
      } else {
        delete result.content
      }
      break
    }
  }

  for (let tok of tokens) {
    if (tok.type === 'negation') {
      result.negation = true
    }
  }

  return result
}

assert.deepEqual(parseIntent('👍'), {intent: 'yes'})
assert.deepEqual(parseIntent('😀'), {intent: 'emoji'})
assert.deepEqual(parseIntent(' sure'), {intent: 'yes'})
assert.deepEqual(parseIntent('Yes!'), {intent: 'yes'})
assert.deepEqual(parseIntent('eh nah'), {intent: 'no'})
assert.deepEqual(parseIntent('what is malaria'), {intent: 'question', content: 'malaria', question: 'what'})
assert.deepEqual(parseIntent('tell me about malaria nets'), {intent: 'question', content: 'malaria'})
assert.deepEqual(parseIntent('hello there'), {intent: 'greeting'})
assert.deepEqual(parseIntent('who are you?'), {intent: 'question', question: 'who'})
assert.deepEqual(parseIntent('go away'), {intent: 'bye'})
assert.deepEqual(parseIntent('leave me alone'), {intent: 'bye'})
assert.deepEqual(parseIntent("I don't want to donate"), {intent: 'buy', negation: true})
assert.deepEqual(parseIntent("I want to buy"), {intent: 'buy'})
assert.deepEqual(parseIntent("why should I buy a net?"), {intent: 'question', content: 'buy', question: 'why'})
assert.deepEqual(parseIntent("how do I buy a net"), {intent: 'question', content: 'buy', question: 'how'})
assert.deepEqual(parseIntent("give me more information"), {intent: 'unknown'})

module.exports = {
  parseIntent,
}
