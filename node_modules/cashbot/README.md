cashbot.ai: nodejs
=========
[![Build Status](https://travis-ci.org/cashbot/cashbot-node.svg?branch=master)](https://travis-ci.org/cashbot/cashbot-node)

This library contains nodejs bindings for the cashbot.ai APIs. Each method in
the library is compatible with callbacks or Promises. Note: this is a server side library and not intended for use from the client side.

cashbot.ai is a monetization platform for conversational experiences. For more
information, please visit (https://cashbot.ai) or e-mail us at
[support@cashbot.ai](mailto://support@cashbot.ai).

API Keys
-----------

You will need an API key to access the cashbot.ai APIs. You can request a key by
either signing up (https://cashbot.ai/signup) or e-mailing us at
[support@cashbot.ai](mailto://support@cashbot.ai).

Installation
-----------

```npm install --save cashbot```

Quick Start: Facebook Messenger
-----------

```
// load the cashbot.ai library
var Cashbot = require('cashbot');

// initialize the cashbot client
var cashbot = Cashbot.init('API_KEY');
cashbot.setConfig({ debug: true });

// get a Facebook carousel with
// cashbot.ai recommendations for a specific user
// returns via callback function
cashbot.facebook.get('TEST_USER', { n: 3, type: 'carousel', label: 'Take a Look' }, function(err, res) {
  console.log('err: ', err);
  // returns a formatted message body
  console.log('res: ', res);
});

// get a Facebook list with
// cashbot.ai recommendations for a specific user
// returns via promises
cashbot.facebook.get('TEST_USER', { type: 'list' })
  .then(function(res) {
    // returns a formatted message body
    console.log(res);
  })
  .catch(function(err) {
    console.log(err);
  });

// register user input for improved recommendations
// from the Facebook webhook callback
// returns via callback function
cashbot.facebook.sendUserInput('TEST_USER', { n: 1, recommend: true, webhook: { /*PUT WEBHOOK RAW CONTENTS FROM request.body HERE*/ } }, function(err, res) {
  console.log(err);
  console.log(res);
});

// register user input for improved recommendations
// from the Facebook webhook callback
// returns via promises
cashbot.facebook.sendUserInput('TEST_USER', { webhook: { /*PUT WEBHOOK RAW CONTENTS FROM request.body HERE */ } })
  .then(function(res) {
    console.log(res);
  })
  .catch(function(err) {
    console.log(err);
  });
```

Quick Start: APIs
-----------

```
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
```

Tests
-----

These are a work in progress

  npm install
  npm test

Contributing
-----

Please follow the existing coding style and add unit tests for any new or changed functionality. 

License
-------------------

Released under the MIT license.  See file called LICENSE for more details.

Attribution/Credits
-------------------

Inspired by the Mixpanel nodejs library
(http://mixpanel.com/)
(https://github.com/mixpanel/mixpanel-node)

Copyright (c) 2014-15 Mixpanel
Original Library Copyright (c) 2012-14 Carl Sverre
