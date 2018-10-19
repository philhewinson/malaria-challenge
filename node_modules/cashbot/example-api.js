// load the cashbot.ai library
var Cashbot = require('cashbot');

// initialize the cashbot client
var cashbot = Cashbot.init('API_KEY');
cashbot.setConfig({ debug: true });

// get cashbot.ai recommendations for user
// returns via callback function
cashbot.getRecommendations('TEST_USER', { n: 3 }, function(err, res) {
  console.log('err: ', err);
  console.log('res: ', res);
});

// get cashbot.ai recommendations for user
// returns via promise
cashbot.getRecommendations('TEST_USER')
  .then(function(res) {
    console.log(res);
  })
  .catch(function(err) {
    console.log(err);
  });

// register user input for improved recommendations
// returns via callback function
cashbot.sendUserInput('TEST_USER', { n: 1, recommend: true, type: 'text', value: { intent: 'dummyIntent', value: 'dummy text' } }, function(err, res) {
  console.log('err: ', err);
  console.log('res: ', res);
});

// register user input for improved recommendations
// returns via promise
cashbot.sendUserInput('TEST_USER', { type: 'text', value: { intent: 'dummyIntent', value: 'dummy text' } })
  .then(function(res) {
    console.log(res);
  })
  .catch(function(err) {
    console.log(err);
  });
