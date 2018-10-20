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
      no: ['n', 'no', 'nope', 'nop', 'nah', 'na', 'never', 'eh'],
      invite: ['invite', 'share', 'refer'],
      greeting: ['hello', 'hi', 'yo', 'heya', 'hey', 'he', 'sup'],
      question: ['what', 'who', 'how', 'why', 'where', 'wha', 'which'],
      bye: ['bye', 'gtg', 'leave', 'later', 'away', 'cya', 'stop', 'unsubscribe'],
      gratitude: ['thank', 'thanks', 'thx', 'thks', 'thk', 'tu'],
      reset: ['reset', 'restart', 'wipe'],

      malaria: ['malaria'],
      mosquito: ['mosquito', 'mozzie', 'mozie'],
      net: ['net', 'nets'],
      game: ['game', 'challenge'],
      score: ['score', 'rank', 'leaderboard', 'progress'],
      language: ['english', 'language'],
    }),
  },
})

function parseIntent(message) {
  lexer.reset(message)
  var tokens = Array.from(lexer)

  let content
  for (let type of [
    'score',
    'malaria',
    'mosquito',
    'net',
    'game',
    'score',
  ]) {
    if (tokens.find(tok => tok.type === type)) {
      content = type
    }
  }

  for (let type of [
    'yes',
    'no',
    'greeting',
    'invite',
    'question',
    'bye',
    'reset',
    'invite',
    'gratitude',
    'help',
    'emoji',
  ]) {
    if (tokens.find(tok => tok.type === type)) {
      if (content) {
        return {intent: type, content} 
      }
      return {intent: type}
    }
  }

  if (content) {
    return {intent: 'question', content}
  }

  return {intent: 'unknown'}
}

assert.deepEqual(parseIntent('👍'), {intent: 'yes'})
assert.deepEqual(parseIntent('😀'), {intent: 'emoji'})
assert.deepEqual(parseIntent(' sure'), {intent: 'yes'})
assert.deepEqual(parseIntent('Yes!'), {intent: 'yes'})
assert.deepEqual(parseIntent('eh nah'), {intent: 'no'})
assert.deepEqual(parseIntent('what is malaria'), {intent: 'question', content: 'malaria'})
assert.deepEqual(parseIntent('tell me about malaria nets'), {intent: 'question', content: 'net'})
assert.deepEqual(parseIntent('hello there'), {intent: 'greeting'})
assert.deepEqual(parseIntent('who are you?'), {intent: 'question'})
assert.deepEqual(parseIntent('go away'), {intent: 'bye'})
assert.deepEqual(parseIntent('leave me alone'), {intent: 'bye'})

module.exports = {
  parseIntent,
}
