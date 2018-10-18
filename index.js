var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');



// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

/* Mongo DB Stuff */

var mongo_db_url = 'malaria';
if (process.env.MONGODB_URI) {
    mongo_db_url = process.env.MONGODB_URI;
}

var collections = ['users', 'logs', 'messages'];
var mongojs = require('mongojs');

var mongodb = null;
if (SLEEP_MODE == false) {
    mongodb = mongojs(mongo_db_url, collections);
}


/* Messenger Platform variables */

// PAGE_ACCESS_TOKEN

var PAGE_ACCESS_TOKEN = "";  // Test Page (set when running locally)

if (process.env.PAGE_ACCESS_TOKEN) {
  PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // Production Page (set when running from Heroku)
}

// PAGE_VERIFY_TOKEN

var PAGE_VERIFY_TOKEN = "test_page_verify_token";  // Test Page (set when running locally)
 
if (process.env.PAGE_VERIFY_TOKEN) {
  PAGE_VERIFY_TOKEN = process.env.PAGE_VERIFY_TOKEN; // Production Page (set when running from Heroku)
}

// BOT_PAGE_ALIAS

var BOT_PAGE_ALIAS = "";  // Test Page (set when running locally)

if (process.env.BOT_PAGE_ALIAS) {
  BOT_PAGE_ALIAS = process.env.BOT_PAGE_ALIAS; // Production Page (set when running from Heroku)
}

// MY USER ID (FOR LOCAL TIMESTAMPS IN THE STATS AND LOGGING PAGES)

var myUserID = 1281880625235887;

if (process.env.MY_USER_ID) {
  myUserID = process.env.MY_USER_ID; // Production Page (set when running from Heroku)
}

// Only set this to true if all is broken and you need time to fix it - it will put the game on hold for everyone, returning a standard
// message everytime they send anything!
var SLEEP_MODE = false;   
if (process.env.SLEEP_MODE == true || process.env.SLEEP_MODE == "true") {
  SLEEP_MODE = true;
}

/* Local NPM Stuff */

app.set('port', (process.env.PORT || 5000));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


/* Test Pages */

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/version', function(request, response) {
  response.send("1");
});


/* End points used */

app.get('/webhook', function(req, res) {
    
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === PAGE_VERIFY_TOKEN) {
      console.log("Validating webhook");
      res.status(200).send(req.query['hub.challenge']);
    } else {
      console.error("Failed validation. Make sure the validation tokens match.");
      res.sendStatus(403);          
    }  
  });

  app.get('/purge_logs', function(req, res) {
    
    if (SLEEP_MODE == false) {
        purgeLogs();
        //res.sendStatus(200);
        res.status(200).end();
    } else {
        res.send("In Sleep Mode!");
    }
    
});


/*******/

/* SUPPORTING FUNCTIONS */

/*******/


/* Algorithmic functions */

function isNumber(obj) { return !isNaN(parseFloat(obj)) }

function isEmoji(str) {
    
    var ranges = [
        '\ud83c[\udf00-\udfff]', // U+1F300 to U+1F3FF
        '\ud83d[\udc00-\ude4f]', // U+1F400 to U+1F64F
        '\ud83d[\ude80-\udeff]' // U+1F680 to U+1F6FF
    ];
    
    if (str.match(ranges.join('|'))) {
        return true;
    } else {
        return false;
    }
}

function getEmojisFromString(str) {
    
    var characterArray = Array.from(str);
    
    var emojiString = "";
    
    for (var i=0; i<characterArray.length; i++) {
        if (isEmoji("" + characterArray[i])) {
            emojiString += characterArray[i];
        }
    }
    
    return emojiString;
    
}

function arrayContains(needle, arrhaystack) {

    return (arrhaystack.indexOf(needle) > -1);
}

function arrayContainsInOrder(orderedNeedleArray, arrhaystack, nothingAfter) {

    var needlesPresentInOrder = true;

    var lastNeedleIndex = -1;

    for (var i=0; i<orderedNeedleArray.length & needlesPresentInOrder == true; i++) {

        var currentNeedleIndex = arrhaystack.indexOf(orderedNeedleArray[i]);

        if (currentNeedleIndex < 0) {
            needlesPresentInOrder = false;
        } else if (currentNeedleIndex <= lastNeedleIndex) {
            needlesPresentInOrder = false;
        } else if (currentNeedleIndex > lastNeedleIndex) {
            lastNeedleIndex = currentNeedleIndex;
        }

    }

    if (nothingAfter && lastNeedleIndex < (arrhaystack.length - 1)) {
        needlesPresentInOrder = false;
    }

    return needlesPresentInOrder;

}

function stringStartsWith(needle, strHaystack) {
    return (strHaystack.lastIndexOf(needle, 0) === 0);
}


/* Send functions */

function callSendAPI(messageData, recipientID) {
    
    var URI = 'https://graph.facebook.com/v2.6/me/messages';
    
    request({
        
        uri: URI,
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData

        }, function (error, response, body) {
        
            // Log request and response ...
            if (SLEEP_MODE == false) {
                mongodb.logs.insert(
                    {
                        "timestamp": new Date().getTime(),
                        "user": parseInt(recipientID),
                        "type": "send",
                        "log": URI + " posted with PAGE_ACCESS_TOKEN and JSON: " + JSON.stringify(messageData) + " -> " + JSON.stringify(body),
                    },
                    function(err, results){
                        if (err) { console.error("MongoDB error: " + err); }
                    }    
                );
                //console.log(URI + " posted with PAGE_ACCESS_TOKEN and JSON: " + JSON.stringify(messageData) + " -> " + JSON.stringify(body));
            }
        
            if (body != null && body.error == null && response.statusCode == 200) {
                
                var bodyRecipientID = body.recipient_id;
                var messageID = body.message_id;

                // console.log("Successfully sent generic message with id %s to recipient %s", messageID, bodyRecipientID);
                
                // If the user's status is blocked or policy, set it to active
                if (SLEEP_MODE == false) {
                    mongodb.users.findAndModify(
                        {
                            query: {$or:[
                                { "status":{$eq:"blocked"}, "user": parseInt(bodyRecipientID) },
                                { "status":{$eq:"policy"}, "user": parseInt(bodyRecipientID) }
                            ]},
                            update: { $set: { "status": "active" } }
                        },
                        function(err, results){

                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));
                        }
                    );
                }

            } else {
                
                if (body != null && body.error != null && body.error.code == 200 && SLEEP_MODE == false) {

                    // If the body.error.code is 200, then update the user's status to "blocked"
                        // Ref: https://developers.facebook.com/docs/messenger-platform/send-api-reference/errors
                    
                    mongodb.users.findAndModify(
                        {
                            query: { "user": parseInt(recipientID) },
                            update: { $set: { "status": "blocked" } }
                        },
                        function(err, results){

                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));
                        }
                    );
                    
                } else if (body != null && body.error != null && body.error.code == 10 && SLEEP_MODE == false) {
                    
                    // If the body.error.code is 10, then update the user's status to "policy"
                        // Ref: https://developers.facebook.com/docs/messenger-platform/policy-overview

                    mongodb.users.findAndModify(
                        {
                            query: { "user": parseInt(recipientID) },
                            update: { $set: { "status": "policy" } }
                        },
                        function(err, results){

                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));
                        }
                    );
                } else {

                    if (body != null) {
                        logErrorInMongo("Error in return Body from https://graph.facebook.com/v2.6/me/messages: " + JSON.stringify(body), recipientID);
                    }

                }
                
                console.error("Unable to send message.");
                //logErrorInMongo("Unable to send message.", recipientID);
                if (error != null) {
                    console.error("Error: " + JSON.stringify(error));
                    logErrorInMongo("Error: " + JSON.stringify(error), recipientID);
                } 
                if (response != null) {
                    //console.error("Response: " + JSON.stringify(response));
                }
                if (body != null) {
                    console.error("Body: " + JSON.stringify(body));
                }
            }
        }
   ).on('error', function(e) {
    
        // Catch error

        var errorMessage = 'Error on https://graph.facebook.com/v2.6/me/messages: ' + e.message;
        console.error(errorMessage);
        logErrorInMongo(errorMessage, recipientID);

    });  
}

function sendTypingIndicator(recipientID, on) {
    
    var senderAction = "typing_off";
    if (on) {
        senderAction = "typing_on";
    }
    
    var data = {
        recipient: {
            id: recipientID
        },
        sender_action: senderAction
    };
    callSendAPI(data, recipientID);
}

function sendMessage(recipientID, messageTextArray, callback, logInMessagesTable) {

    // console.log("Sending message to user ... " + recipientID);

    var thisTimeout = messageTextArray[0];

    if (thisTimeout > 0) {
        
        // Typing indicator, so firstly wait 500ms, then send it for the duration specified ...
        
        setTimeout(function() {
            sendTypingIndicator(recipientID, true);
            setTimeout(function() {
                sendMessageInner(recipientID, messageTextArray, callback, logInMessagesTable);
            }, thisTimeout);
        }, 500);
        
    } else {
        
        // No typing indicator, so just send the message
        sendMessageInner(recipientID, messageTextArray, callback, logInMessagesTable);
        
    }
}

function sendMessageInner(recipientID, messageTextArray, callback, logInMessagesTable) {
    
    var thisMessage = messageTextArray[1];

    // Standard text message

    if (thisMessage != "") {

        // Log this message if you should

        if (logInMessagesTable && SLEEP_MODE == false) {

            var currentTimestamp = new Date().getTime();

            var queryJSON = 
                {
                    "timestamp": parseInt(currentTimestamp),
                    "user": parseInt(recipientID),
                    "message": thisMessage,
                    "response": true
                };
            //console.log("Query JSON (messages.insert): " + queryJSON);

            mongodb.messages.insert(
                queryJSON,
                function(err, results){
                    if (err) { console.error("MongoDB error: " + err); }
                    //console.log("MongoDB results: " + JSON.stringify(results));
                }    
            );
        }

        // Then send it
        
        var messageData = {
            recipient: {
                id: recipientID
            },
            message: {
                text: thisMessage
            }
        };

        callSendAPI(messageData, recipientID);
    }

    // Queue up the next message to send
    messageTextArray.splice(0, 2);

    if (messageTextArray.length > 0) {
        // Send the next message
        sendMessage(recipientID, messageTextArray, callback, logInMessagesTable);
    } else {
        // Reached the end of the messages, so switch off the typing indicator and call the callback
        sendTypingIndicator(recipientID, false);
        if (callback != null) {
            callback();
        }
    }
}

function sendImage(recipientID, imageURL) {
    
    var data = {
        recipient: {
            id: recipientID
        },
        message: {
            attachment: {
                type: "image",
                payload: {
                    url: imageURL,
                    is_reusable: true
                }
            }
        }
    };

    callSendAPI(data, recipientID);
    
}


/* Logging functions */

// Function to record errors in MongoDB
function logErrorInMongo(error, userID) {

    if (userID == null) {
        userID = -1;
    }
    
    if (SLEEP_MODE == false) {

        mongodb.logs.insert(
            {
                "timestamp": new Date().getTime(),
                "user": parseInt(userID),
                "type": "error",
                "log": error
            },
            function(err, results){
                if (err) { console.error("MongoDB error: " + err); }
            }    
        );
    }
    
}


/*******/

/* IMPLEMENTATION */

/*******/


app.post('/webhook', function (req, res) {
    
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.

    // UNCOMMENT THIS LOGGING IF YOU WANT TO SEE EXACTLY WHAT YOU GET FROM THE MESSENGER PLATFORM WEBHOOK FOR DEBUGGING
    // if (req != null && req.body != null && req.body.entry != null && req.body.entry.length > 0 &&
    //     req.body.entry[0].messaging != null && req.body.entry[0].messaging.length > 0) {
    //     console.log("Webhook: " + JSON.stringify(req.body.entry[0].messaging[0]));
    // }

    res.sendStatus(200);
    
    var data = req.body;

    // Make sure this is a page subscription
    if (data != null && data.object === 'page') {
        
        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function(entry) {
            
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {

                if ((event.message && !event.message.is_echo) || event.postback) {
                    
                    var senderID = event.sender.id;
                    
                    if (SLEEP_MODE == true) {
                        
                        // In sleep mode, so just return a standard message, but don't process any further! ...
                        sendMessage(event.sender.id, [200, getSleepModeText()], null, true);
                        
                    } else {

                        // Not in sleep mode, so continue as normal! ...

                        mongodb.logs.insert(
                            {
                                "timestamp": new Date().getTime(),
                                "user": parseInt(senderID),
                                "type": "receive",
                                "log": JSON.stringify(event),
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                            }    
                        );
                        //console.log("Event received from Read API: " + JSON.stringify(event));


                        // Log the IP address too (only if it's me)
                        if (parseInt(senderID) == myUserID) {

                            var ipAddressRequest = "http://ip.changeip.com";
                            request(ipAddressRequest, function(error, response, body) {
                                mongodb.logs.insert(
                                    {
                                        "timestamp": new Date().getTime(),
                                        "user": parseInt(senderID),
                                        "type": "ip",
                                        "log": "Server IP Address: " + body,
                                    },
                                    function(err, results){
                                        if (err) { console.error("MongoDB error: " + err); }
                                    }    
                                );
                                //console.log("Server IP Address: " + body);
                            }).on('error', function(e) {
                                
                                // Catch error
            
                                var errorMessage = 'Error on http://ip.changeip.com: ' + e.message;
                                console.error(errorMessage);
                                logErrorInMongo(errorMessage, senderID);
            
                            });

                        }
                    
                        sendTypingIndicator(senderID, true);

                        // Get the user's profile information (from the user's table, otherwise from graph.facebook.com)
                        getValidUserProfile(senderID, function(validUserProfile) {

                            if (event.message) {
                                receivedMessage(event, validUserProfile);
                            } else if (event.postback) {
                                receivedPostback(event, validUserProfile);
                            }

                        });

                    }
                } else if (event.message && event.message.is_echo) {
                    
                    // Handle the message echo ...
                    //console.log("Echo received");
                    
                } else if (event.delivery && SLEEP_MODE == false) {
                    
                    // Handle the message delivery ...
                    //console.log("Delivery received");
                    
                } else if (event.read) {
                    
                    // Handle the message read ...
                    //console.log("Read received");
                    
                } else if (event.referral) {
                    
                    // Log ref param
                    var ref_for_logging = event.referral;
                    if (event.referral != null) {
                        ref_for_logging = ref_for_logging + " (" + JSON.stringify(event.referral) + ")";
                    }
                    console.log("Ref parameter for user " + event.sender.id + " = " + ref_for_logging + " [through Referral (existing user)]");
                    
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });
    }
});

function isUserProfileValid(userProfile) {

    var isValid = false;

    if (userProfile != null &&
        userProfile.first_name != null && userProfile.first_name != "null" &&
        userProfile.last_name != null && userProfile.last_name != "null" &&
        userProfile.timezone != null && userProfile.timezone != "null" &&
        userProfile.timezone != NaN && userProfile.timezone != "NaN" && isInt(userProfile.timezone) == true) {

        isValid = true;

    }

    return isValid;

}

function getValidUserProfile(recipientID, callback) {

    var needToGetUserProfileFromFacebook = false;

    mongodb.users.find({ "user": parseInt(recipientID) }, 
    { "first_name": 1, "last_name": 1, "profile_pic": 1, "locale": 1, "timezone": 1, "gender": 1, "is_payment_enabled": 1, "last_ad_referral": 1, _id: 0 },
    function(err, mongoUserResults){

        if (mongoUserResults.length > 0 ) {

            var validUserProfile = {
                first_name:mongoUserResults[0].first_name,
                last_name:mongoUserResults[0].last_name,
                profile_pic:mongoUserResults[0].profile_pic,
                locale:mongoUserResults[0].locale,
                timezone:mongoUserResults[0].timezone,
                gender:mongoUserResults[0].gender,
                is_payment_enabled:mongoUserResults[0].is_payment_enabled,
                last_ad_referral:mongoUserResults[0].last_ad_referral};

            if (isUserProfileValid(validUserProfile) == true) {

                callback(validUserProfile);

            } else {

                // User returned is not valid, so get their profile information from Facebook later ...
                needToGetUserProfileFromFacebook = true;

            }
            
        } else {

            // No user returned in database, so get their profile information from Facebook later ...
            needToGetUserProfileFromFacebook = true;

        }

        if (needToGetUserProfileFromFacebook == true) {

            var profileInfoRequest = "https://graph.facebook.com/v2.6/" + recipientID +
                "?fields=first_name,last_name,profile_pic,locale,timezone,gender,is_payment_enabled,last_ad_referral&access_token=" + PAGE_ACCESS_TOKEN;
            request(profileInfoRequest, function(error, response, body) {

                var bodyJSON = null;
                
                try {
                    
                    bodyJSON = JSON.parse(body);

                } catch (e) {
                    var jsonParseError = "Error Parsing graph.facebook.com JSON return value for user " + recipientID + " (error: " + e + ")";
                    console.error(jsonParseError);
                    logErrorInMongo(jsonParseError, recipientID);
                }

                var logText = "";
                if (bodyJSON != null) {
                    logText = JSON.stringify(bodyJSON);
                }

                mongodb.logs.insert(
                    {
                        "timestamp": new Date().getTime(),
                        "user": parseInt(recipientID),
                        "type": "profile",
                        "log": profileInfoRequest + " -> " + logText,
                    },
                    function(err, results){
                        if (err) { console.error("MongoDB error: " + err); }
                    }    
                );
                //console.log(profileInfoRequest + " -> " + JSON.stringify(JSON.parse(body)));

                if (error) {
                    console.error(JSON.stringify(error));
                    logErrorInMongo(JSON.stringify(error), recipientID);
                    sendTypingIndicator(recipientID, false);
                } else {

                    var userProfile = null;

                    if (bodyJSON != null) {

                        userProfile = {first_name:bodyJSON.first_name,
                                        last_name:bodyJSON.last_name,
                                        profile_pic:bodyJSON.profile_pic,
                                        locale:bodyJSON.locale,
                                        timezone:bodyJSON.timezone,
                                        gender:bodyJSON.gender,
                                        is_payment_enabled:bodyJSON.is_payment_enabled,
                                        last_ad_referral:bodyJSON.last_ad_referral};

                    }

                    if (isUserProfileValid(userProfile) == true) {
                
                        // As the userProfile retrieved from graph.facebook.com is valid, update the details in the users table if it exists
                        mongodb.users.findAndModify(
                            {
                                query: { "user": parseInt(recipientID) },
                                update: { $set: { "first_name": userProfile.first_name,
                                                  "last_name": userProfile.last_name,
                                                  "profile_pic": userProfile.profile_pic,
                                                  "locale": userProfile.locale,
                                                  "timezone": parseInt(userProfile.timezone),
                                                  "gender": userProfile.gender,
                                                  "is_payment_enabled": userProfile.is_payment_enabled } }
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                            }
                        );

                        callback(userProfile);
                
                    } else {

                        // Didn't get valid user profile back from users table or graph.facebook.com, so log an error
                        var errorToRecord = "userProfile invalid from graph.facebook.com for user " + recipientID + " and invalid userProfile returned from users table";
                        console.error(errorToRecord);
                        // logErrorInMongo(errorToRecord, recipientID);
            
                        // userProfile invalid from both graph.facebook.com and the database, so check if it's null and if so, set each property to null
                        // so it doesn't cause a crash later
                        if (userProfile == null) {
                            userProfile = {
                                first_name:null,
                                last_name:null,
                                profile_pic:null,
                                locale:null,
                                timezone:null,
                                gender:null,
                                is_payment_enabled:null,
                                last_ad_referral:null};
                        }
            
                        callback(userProfile);

                    }

                }
            }).on('error', function(e) {
                
                // Catch error

                var errorMessage = 'Error on https://graph.facebook.com/v2.6/: ' + e.message;
                console.error(errorMessage);
                logErrorInMongo(errorMessage, senderID);

            });
        }

    });

}

/* Receive functions */
  
function receivedMessage(event, userProfile) {
    
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    //console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageID = message.mid;
    var messageEcho = message.is_echo;

    var messageText = message.text;
    var stickerID = message.sticker_id;
    
    var messageAttachments = message.attachments;
    var attachmentURL = "";
    if (messageAttachments != null && messageAttachments.length > 0 &&
        messageAttachments[0].payload != null) {
        attachmentURL = messageAttachments[0].payload.url;
    }

    if (!messageEcho) {

        mongodb.users.count({ "user": parseInt(senderID) }, function(err, mongoUserResults){
            
            if (err) { console.error("MongoDB error: " + err); }
            
            var userExists = false;
            if (mongoUserResults > 0) {
                userExists = true;
            } else {
                console.log("[receivedMessage] User doesn't exist: " + senderID + " (message: '" + messageText + "')");
            }

            if (userExists == false) {

                // If the user doesn't exist, try to start the challenge

                sendIntroText(senderID, userProfile, null);

            } else {

                // Otherwise, the user exists, so process the message / attachment ...

                if (messageText) {
                    
                    // Log the message text first ...
        
                    var currentTimestamp = new Date().getTime();
        
                    var queryJSON = 
                        {
                            "timestamp": parseInt(currentTimestamp),
                            "user": parseInt(senderID),
                            "message": messageText,
                            "response": false
                        };
                    //console.log("Query JSON (messages.insert): " + queryJSON);
        
                    mongodb.messages.insert(
                        queryJSON,
                        function(err, results){
                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));
                        }    
                    );
        
                    // Increment num_messages for this user in the user's table
                    mongodb.users.findAndModify(
                        {
                            query: { "user": parseInt(senderID), "num_messages": {$ne:null} },
                            update: { $inc: { "num_messages": 1 } }
                        },
                        function(err, results){
                            if (err) { console.error("MongoDB error: " + err); }
                        }
                    );
                
                    // Now process the message
        
                    processMessage(senderID, userProfile, messageText);
                
                } else if (messageAttachments) {
        
                    if (messageAttachments.length > 0) {
                        
                        // Log the message attachment text first ...
        
                        var currentTimestamp = new Date().getTime();
        
                        var queryJSON = 
                            {
                                "user": parseInt(senderID),
                                "type": messageAttachments[0].type,
                                "url": attachmentURL,
                                "sticker_id": stickerID,
                                "timestamp": parseInt(currentTimestamp)
                            };
                        //console.log("Query JSON (message_attachments.insert): " + queryJSON);
        
                        mongodb.message_attachments.insert(
                            queryJSON,
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                                //console.log("MongoDB results: " + JSON.stringify(results));
                            }    
                        );
        
                        // Increment num_message_attachments for this user in the user's table
                        mongodb.users.findAndModify(
                            {
                                query: { "user": parseInt(senderID), "num_message_attachments": {$ne:null} },
                                update: { $inc: { "num_message_attachments": 1 } }
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                            }
                        );
                        
                        // Now process the attachment
                        
                        processAttachment(senderID, userProfile, messageAttachments[0], attachmentURL, stickerID);
        
                    } else {
        
                        sendMessage(senderID, [500, getResponseToUnknownInput(userProfile)], null, true);
        
                    }
                }

            }

        });
        
    }
}


function processMessage(recipientID, userProfile, messageText) {

    // Process the messageText in different ways for later analysis if you choose ...

    var messageTextLowerCase = messageText.toLowerCase();
    var messageTextLowerCaseNoWhiteSpaces = messageTextLowerCase.replace(/\s/g,'');
    var messageTextLowerCaseAlphanumericOnly = messageTextLowerCase.replace(/\W/g, '');
    var messageTextAlphabetOnly = messageTextLowerCase.replace(/[0-9]/g, '').replace(/\W/g, '');
    
    var messageTextLowerCaseWordsArray = messageTextLowerCase.split(" ");
    var messageTextLowerCaseWordsArrayAlphanumericOnly = [];
    for (var i=0; i<messageTextLowerCaseWordsArray.length; i++) {
        var stringToAdd = messageTextLowerCaseWordsArray[i].replace(/\W/g, '');
        if (stringToAdd.length > 0) {
            messageTextLowerCaseWordsArrayAlphanumericOnly.push(stringToAdd);
        }
    }

    var messageTextLowerCaseWordsNonNumbersArray = messageTextLowerCase.replace(/[0-9]/g, '').split(" ");
    var messageTextLowerCaseWordsArrayAlphabetOnly = [];
    for (var i=0; i<messageTextLowerCaseWordsNonNumbersArray.length; i++) {
        var stringToAdd = messageTextLowerCaseWordsNonNumbersArray[i].replace(/\W/g, '');
        if (stringToAdd.length > 0) {
            messageTextLowerCaseWordsArrayAlphabetOnly.push(stringToAdd);
        }
    }
    
    var emojisFromMessageText = getEmojisFromString(messageText);


    // Handle different inputs, dealing with the more specific inputs first ...
    
    if (messageTextLowerCaseNoWhiteSpaces == "?" ) {

        sendMessage(recipientID, [200, "?"], null, true);
        
    } else if (messageTextLowerCaseNoWhiteSpaces == "ok" || messageTextLowerCaseNoWhiteSpaces == "okay" ||
            messageTextLowerCaseNoWhiteSpaces == "k" || messageTextLowerCaseNoWhiteSpaces == "yes" ||
            messageTextLowerCaseNoWhiteSpaces == "cool" || messageTextLowerCaseNoWhiteSpaces == "yay" ||
            messageTextLowerCaseNoWhiteSpaces == "oh" || messageTextLowerCaseNoWhiteSpaces == "done" ||
            messageTextLowerCaseNoWhiteSpaces == "nice" || messageTextLowerCaseNoWhiteSpaces == "fine" ||
            messageTextLowerCaseNoWhiteSpaces == "yeah" || messageTextLowerCaseNoWhiteSpaces == "boom" ||
            messageTextLowerCaseNoWhiteSpaces == "yea" || messageTextLowerCaseNoWhiteSpaces == "yep" ||
            messageTextLowerCaseNoWhiteSpaces == "yey" || messageTextLowerCaseNoWhiteSpaces == "ya" ||
            messageTextLowerCaseNoWhiteSpaces == "cheers" || messageTextLowerCaseNoWhiteSpaces == "youtoo" ||
            messageTextLowerCaseNoWhiteSpaces == "tg" || messageTextLowerCaseNoWhiteSpaces == "tf"  ||
            messageTextLowerCaseNoWhiteSpaces == "ofcourse" || messageTextLowerCaseNoWhiteSpaces == "occasionally"  ||
            messageTextLowerCaseNoWhiteSpaces == "great" || messageTextLowerCaseNoWhiteSpaces == "np") {

        sendMessage(recipientID, [200, "👍"], null, true);
        
    } else if (messageTextLowerCaseNoWhiteSpaces == "no" || messageTextLowerCaseNoWhiteSpaces == "nope" ) {

        sendMessage(recipientID, [200, getResponseToNo()], null, true);
        
    } else if (messageTextLowerCaseNoWhiteSpaces == "yo" ) {

        sendMessage(recipientID, [200, "Yo!"], null, true);
        
    } else if ( messageTextLowerCaseNoWhiteSpaces.includes("getstarted") ||
                messageTextLowerCaseNoWhiteSpaces.includes("startover") ||
                messageTextLowerCase.includes("restart") ||
                messageTextLowerCaseNoWhiteSpaces.includes("startagain") ||
                messageTextLowerCase.includes("wipe") ||
                messageTextLowerCase.includes("reset") ) {

        sendIntroText(recipientID, userProfile, null);

    } else if ( messageTextLowerCase.includes("invite") || messageTextLowerCase.includes("share") ||
                arrayContains("refer", messageTextLowerCaseWordsArrayAlphanumericOnly) ) {

        share(recipientID);

    } else if (messageTextLowerCase.includes("score") || messageTextLowerCase.includes("rank") || messageTextLowerCase.includes("position") || messageTextLowerCase.includes("leaderboard")) {

        // TO IMPLEMENT ...
        // viewScore(recipientID, false, true, null);
        sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, true);

    } else if (messageTextLowerCase.includes("help")) {

        sendMessage(recipientID, [2000,
                            "What's wrong?"],
                    null, true);

    } else if ( (arrayContains("hi", messageTextLowerCaseWordsArrayAlphanumericOnly)) ||
                messageTextLowerCase.includes("hello") ||
                messageTextLowerCase.includes("hiya") ||
                messageTextLowerCase.includes("hola") ||
                (arrayContains("hey", messageTextLowerCaseWordsArrayAlphanumericOnly)) ) {

        // Answer to "Hi"
        sendMessage(recipientID, [1000, "Hi " + userProfile.first_name + ", how are you today?"], null, true);

    }  else if ( messageTextLowerCase.includes("english") ) {

        sendMessage(recipientID, [1000, "Sorry, English is the only language I speak"], null, true);

    } else if ( messageTextLowerCase.includes("bye") ||
                messageTextLowerCase.includes("gtg") ||
                messageTextLowerCase.includes("later") ||
                messageTextLowerCase.includes("adios") ||
                messageTextLowerCase.includes("see you") ||
                arrayContains("cya", messageTextLowerCaseWordsArrayAlphanumericOnly) ) {

        sendMessage(recipientID, [1000, "Bye " + userProfile.first_name + "!"], null, true);

    } else if (messageTextLowerCase.includes("?")) {

        sendMessage(recipientID, [2000, getResponseToQuestionInput(messageText, userProfile)], null, true);

    } else if ( messageTextLowerCase.includes("sorry") ||
                messageTextLowerCase.includes("soz") ) {

            sendMessage(recipientID, [1000, "No problem!"], null, true);

    } else if ( arrayContains("yes", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("yeah", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("yea", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("yep", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("cheers", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("sure", messageTextLowerCaseWordsArrayAlphanumericOnly) ) {

        sendMessage(recipientID, [200, getResponseToYes()], null, true);
        
    } else if ( arrayContains("no", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("nope", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("nop", messageTextLowerCaseWordsArrayAlphanumericOnly) ) {

        sendMessage(recipientID, [200, getResponseToNo()], null, true);
        
    } else if (arrayContains("yo", messageTextLowerCaseWordsArrayAlphanumericOnly)) {

        sendMessage(recipientID, [200, "Yo!"], null, true);
        
    } else if ( arrayContains("ok", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("okay", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("k", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("oh", messageTextLowerCaseWordsArrayAlphanumericOnly) ||
                arrayContains("o", messageTextLowerCaseWordsArrayAlphanumericOnly) ) {

        sendMessage(recipientID, [200, getResponseToYes()], null, true);
        
    } else if ( messageTextLowerCase.includes("thank") || 
                messageTextLowerCase.includes("thx") || 
                messageTextLowerCase.includes("thku") || 
                messageTextLowerCase.includes("thk u") || 
                messageTextLowerCase.includes("thk you") || 
                messageTextLowerCase.includes("thks") ) {

        sendMessage(recipientID, [1000, "You're very welcome " + userProfile.first_name + "!"], null, true);

    } else if (emojisFromMessageText.length == messageText.length) {
        
        // Only sent emojis, so send the same one back
        sendMessage(recipientID, [500, messageText], null, true);
        
    } else {

        sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, true);

    }

}

function processAttachment(recipientID, userProfile, attachment, attachmentURL, stickerID) {
    
    if (attachment.type == "image") {

        // Note - sticker_ids to detect for below:
            // 369239263222822 - Small Facebook's Thumb's Up
            // 369239343222814 - Medium Facebook's Thumb's Up
            // 369239383222810 - Large Facebook's Thumb's Up
    
        if (stickerID == "369239263222822" || stickerID == "369239343222814" ||
            stickerID == "369239383222810") {

            // Facebook thumbs up, so send a thumbs up back
            sendMessage(recipientID, [200, "👍"], null, false);

        } else {
            
            sendMessage(recipientID, [2000, getResponseToImageInput(userProfile)], null, false);
            
        }

    } else if (attachment.type == "video") {

        sendMessage(recipientID, [6000, getResponseToVideoInput(userProfile)], null, false);

    } else if (attachment.type == "audio") {

        sendMessage(recipientID, [6000, getResponseToAudioInput(userProfile)], null, false);

    } else if (attachment.type == "file") {

        sendMessage(recipientID, [3000, getResponseToFileInput(userProfile)], null, false);

    } else {

        sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, false);

    }
}


function receivedPostback(event, userProfile) {
    
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;

    // The 'payload' param is a developer-defined field which is set in a postback 
    // button for Structured Messages. 
    var payload = event.postback.payload;
    
    // Get the ref parameter if it exists
    var ref = null;
    if (event.postback.referral != null) {
        ref = event.postback.referral.ref;
    }

    //console.log("Received postback for user %d and page %d with payload '%s' " + 
    //"at %d", senderID, recipientID, payload, timeOfPostback);

    mongodb.users.count({ "user": parseInt(senderID) }, function(err, mongoUserResults){
        
        if (err) { console.error("MongoDB error: " + err); }
        
        var userExists = false;
        if (mongoUserResults > 0) {
            userExists = true;
        } else {
            console.log("[receivedPostback] User doesn't exist: " + senderID + " (payload: '" + payload + "')");
        }

        // When a postback is called, we'll send a message back to the sender to 
        // let them know it was successful
        if (payload == "Get Started" || userExists == false) {
            
            // Log ref param
            var ref_for_logging = event.postback.referral;
            if (event.postback.referral != null) {
                ref_for_logging = ref_for_logging + " (" + JSON.stringify(event.postback.referral) + ")";
            }
            console.log("Ref parameter for user " + senderID + " = " + ref_for_logging + " [through 'Get Started' Postback (new user)]");
            
            // Check if this user came from another user
            var valid_inviter = null;
            if (ref != null && ref.includes("invite_")) {
                
                // This is an invitation from another user, so get the id of the inviter
                var inviter = ref.replace("invite_", "");
                
                // Ensure inviter is made up of digits only and is not equal to the sender id
                var isnum = /^\d+$/.test(inviter);
                if (isnum && inviter != senderID) {
                    valid_inviter = inviter;
                }
            }
            
            // Get the ad_id and ad_ref if they exist ...
            var ad_id = -1;
            var ad_ref = "";
            if (event.postback.referral != null && event.postback.referral.ad_id != null) {
                ad_id = event.postback.referral.ad_id;
                ad_ref = event.postback.referral.ref;
            }

            sendIntroText(senderID, userProfile, valid_inviter);
            
        } else if (payload == "My Ranking") {
            // TO IMPLEMENT ...
            // viewScore(senderID, false, true, null);
        } else if (payload == "Invite Friends") {
            share(senderID);
        }

    });

}

function sendIntroText(recipientID, userProfile, inviter) {
    
    // Get current time for the time_joined field for a new user
    var currentTimestamp = new Date().getTime();

    // Get these attributes for insertion ...

    var inviterForQuery = null;
    if (isNumber(inviter)) {
        inviterForQuery = parseInt(inviter);
    }

    mongodb.users.findAndModify({

        query: { "user": parseInt(recipientID) },
        update: { $setOnInsert: { "user": parseInt(recipientID), "bought_net": false, "referred_by": inviterForQuery, 
                                "first_name": userProfile.first_name, "last_name": userProfile.last_name,
                                "profile_pic": userProfile.profile_pic, "locale": userProfile.locale, "timezone": parseInt(userProfile.timezone),
                                "gender": userProfile.gender, "is_payment_enabled": userProfile.is_payment_enabled, "num_starts": 1,
                                "status": "active", "time_joined": currentTimestamp,
                                "num_messages": 0, "num_message_attachments": 0,
                                "num_referrals" : 0, "num_recursive_referrals" : 0 } },
        // new: true,   // return new doc if one is upserted
        upsert: true // insert the document if it does not exist

    },
        function(err, results){
            
            if (err) { console.error("MongoDB error: " + err); }

            // results returned is the old document, so will be null if there wasn't one before and the user didn't exist

            var userExisted = false;
            if (results != null) {
                userExisted = true;
            }

            if (userExisted == false) {

                // If the user didn't exist, a new one has been created - so reward the inviter if one exists and send the intro messages ...
                    // Plus increment the appropriate num_referrals and num_recursive_referrals values

                if (inviter != null) {

                    mongodb.users.findAndModify(
                        {
                            query: { "user": parseInt(inviter) },
                            update: { $inc: { "num_referrals": 1, "num_recursive_referrals": 1 } },
                            new: true
                        },
                        function(err, results){

                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));

                            sendMessage(inviter,

                                [
                                    200, "Your friend " + userProfile.first_name + " " + userProfile.last_name + " just started the Malaria Challenge - we'll let you know if they buy a malaria net!"
                                ],

                            null, false);

                            // Increment the appropriate num_recursive_referrals values in all "parents" of the inviter ...
                            var inviterParent = results.referred_by;
                            
                            if (inviterParent != null && isNumber(inviterParent)) {
                
                                incrementNumRecursiveReferrals(inviterParent);
                
                            }

                        }
                    );

                }

                sendIntroMessages(recipientID, userProfile);

            } else {

                // Otherwise, the user already exists, so firstly check that at least 30 seconds have passed since they last joined
                    // If not, don't do anything as it's probably a duplicate "Get Started", so should be ignored
                    // Otherwise, just share the intro text again, but leave the key parts of user fields in database as-is

                mongodb.users.find({ "user": parseInt(recipientID) }, function(err, mongoUserResults){

                    if (err) { console.error("MongoDB error: " + err); }

                    var xSecondsAfterUserJoined = parseInt(mongoUserResults[0].time_joined) + (30*1000);
                    if (currentTimestamp > xSecondsAfterUserJoined) {

                        // User exists, 30 seconds have passed since they joined, so ...
                            // Send intro messages
                            // Update some fields for this user in the users table

                        sendIntroMessages(recipientID, userProfile);

                        // Also, increment the num_starts field
                        mongodb.users.findAndModify(
                            {
                                query: { "user": parseInt(recipientID) },
                                update: { $inc: { "num_starts": 1 }, $set: { "status": "active" } }
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                            }
                        );

                    }

                });

            }
        }
    );
}

function incrementNumRecursiveReferrals(inviter) {

    mongodb.users.findAndModify(
        {
            query: { "user": parseInt(inviter) },
            update: { $inc: { "num_recursive_referrals": 1 } },
            new: true
        },
        function(err, results){

            if (err) { console.error("MongoDB error: " + err); }

            var inviterParent = results.referred_by;

            if (inviterParent != null && isNumber(inviterParent)) {

                incrementNumRecursiveReferrals(inviterParent);

            }

        }
    );

}

function sendIntroMessages(recipientID, userProfile) {
    
    sendMessage(recipientID,

        [
            0, "Hi " + userProfile.first_name + "!",
            3000, "Welcome to the Malaria Challenge!"
        ],

    null, false);
    
}


function share(recipientID) {

    sendShareInvitationButton(recipientID);

}

function sendShareInvitationButton(recipientID) {
    
    var subtitle = "Try out the Malaria Challenge!"
    
    var data = {
        recipient: {
            id: recipientID
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    image_aspect_ratio: "square",
                    elements: [{     
                        title: "Challenge Your Friends!",
                        subtitle: "Climb the global leaderboard as your friends and their friends by malaria nets!",
                        image_url: "http://www.projectedgames.com/amf/amf_logo.png",
                        buttons: [{
                            type: "element_share",
                            share_contents: { 
                                attachment: {
                                    type: "template",
                                    payload: {
                                        template_type: "generic",
                                        elements: [{
                                            title: "Let's protect people from Malaria together!",
                                            subtitle: subtitle,
                                            image_url: "http://www.projectedgames.com/amf/amf_logo.png",
                                            default_action: {
                                                type: "web_url",
                                                url: "http://m.me/" + BOT_PAGE_ALIAS + "?ref=invite_" + recipientID
                                            },
                                            buttons: [{
                                                type: "web_url",
                                                url: "http://m.me/" + BOT_PAGE_ALIAS + "?ref=invite_" + recipientID,
                                                title: "Enter Challenge!"
                                            }]
                                        }]
                                    }
                                }
                            }
                        }]
                    }]
                }
            }
        }
    };

    callSendAPI(data, recipientID);
    
}

function showShareDialogWithMessage(recipientID, message, callback) {

    if (message != "") {
        
        var logText = "Showing Share Dialog to user " + recipientID + ", with message '" + message + "'";
        //console.log(logText);
        mongodb.logs.insert(
            {
                "timestamp": new Date().getTime(),
                "user": parseInt(recipientID),
                "type": "share",
                "log": logText
            },
            function(err, results){
                if (err) { console.error("MongoDB error: " + err); }
            }    
        );

        sendMessage(recipientID,

            [
                3500, message
            ],

            function() {

                setTimeout(function() {

                    // Show the share dialog after 7.5 seconds
                    share(recipientID);

                    setTimeout(function() {
                        
                        // Call the callback another 6 seconds later ...
                        if (callback != null) {
                            callback();
                        }
                        
                    }, 6000);

                }, 7500);
            }
        , false);
        
    } else {
        
        // Message is blank, so just call the callback!
        if (callback != null) {
            callback();
        }
    }
    
}


function purgeLogs() {
    
    var currentTimestamp = new Date().getTime();

    var numDaysToKeepLogsFor = 3;   // Variable for LOCAL TEST ENVIRONMENT ONLY
    if (process.env.NUM_DAYS_KEEP_LOGS) {
      numDaysToKeepLogsFor = parseFloat(process.env.NUM_DAYS_KEEP_LOGS);
    }

    console.log("Purging old logs more than " + numDaysToKeepLogsFor + " days old ...");
    
    mongodb.logs.remove(
        {
            "timestamp": { $lte: parseInt(currentTimestamp - (numDaysToKeepLogsFor*24*60*60*1000)) }
        },
        function(err, results){

            if (err) { console.error("MongoDB error: " + err); }
            console.log("MongoDB results: " + JSON.stringify(results));
        }
    );
}


/*******/

/* Textual Replies */

/*******/


function getSleepModeText() {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "I'm afraid I am sleeping at the moment - hopefully, I'll wake up soon so please try again later!";
    
    switch (randomNumber) {
        
        case 1:
            text = "I'm afraid I am sleeping at the moment - hopefully, I'll wake up soon so please try again later!";
            break;
        case 2:
            text = "Sorry, but something is broken and I'm hoping to have it fixed soon - please try again a little later, thanks!";
            break;
        case 3:
            text = "I'm currently hybernating, so can't respond right now - please try again a little later, thanks!";
            break;
        case 4:
            text = "Something's not quite right, although I'm hoping it will be fixed soon ... so I can't process your message right now, but please try again soon!";
            break;
        case 5:
            text = "Sorry, I'm not feeling quite right at the moment - if you try again a little later, I should be better and can get back to you, thanks!";
            break;
    }
    
    return text;
    
}

function getResponseToUnknownInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 40) + 1;
    
    var text = "Hmmm";
    
    switch (randomNumber) {
        
        case 1:
            text = "Hmmm";
            break;
        case 2:
            text = "Oh";
            break;
        case 3:
            text = "👌";
            break;
        case 4:
            text = "👎";
            break;
        case 5:
            text = "😍";
            break;
        case 6:
            text = "😜";
            break;
        case 7:
            text = "😬";
            break;
        case 8:
            text = "I see!";
            break;
        case 9:
            text = "Really!?  That's pretty interesting ... tell me more!";
            break;
        case 10:
            text = "I see.  You know " + userProfile.first_name + ", I'm really enjoying our conversation - thanks for making the time for me!";
            break;
        case 11:
            text = "I'm not sure";
            break;
        case 12:
            text = "👍";
            break;
        case 13:
            text = "What?";
            break;
        case 14:
            text = "Why?";
            break;
        case 15:
            text = "Ok";
            break;
        case 16:
            text = " ... um ... I'm not sure how to respond " + userProfile.first_name;
            break;
        case 17:
            text = "You're very talkative today " + userProfile.first_name + "!";
            break;
        case 18:
            text = "What does that mean?";
            break;
        case 19:
            text = "😁";
            break;
        case 20:
            text = "😂😂😂";
            break;
        case 21:
            text = "!?";
            break;
        case 22:
            text = "???";
            break;
        case 23:
            text = "Wow";
            break;
        case 24:
            text = "Er, ok";
            break;
        case 25:
            text = "Sorry";
            break;
        case 26:
            text = "😉";
            break;
        case 27:
            text = "🙂";
            break;
        case 28:
            text = "😳";
            break;
        case 29:
            text = "😮";
            break;
        case 30:
            text = "😴";
            break;
        case 31:
            text = "😘";
            break;
        case 32:
            text = "😎";
            break;
        case 33:
            text = "😐";
            break;
        case 34:
            text = "😔";
            break;
        case 35:
            text = "😪";
            break;
        case 36:
            text = "😭";
            break;
        case 37:
            text = "😵";
            break;
        case 38:
            text = "👏";
            break;
        case 39:
            text = "👋";
            break;
        case 40:
            text = "👊";
            break;
            
    }
    
    return text;
    
}

function getResponseToQuestionInput(messageText, userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "What an interesting question ... to be honest with you, I'm not sure.";
    
    switch (randomNumber) {
        
        case 1:
            text = "What an interesting question ... to be honest with you, I'm not sure.";
            break;
        case 2:
            text = messageText;
            break;
        case 3:
            text = "Do I really have to answer that!?";
            break;
        case 4:
            text = "I'm not really sure - I'd have to think about that";
            break;
        case 5:
            text = "Yes (if you'll accept that as an answer!)";
            break;
            
    }
    
    return text;
    
}

function getResponseToYes() {

    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 4) + 1;
    
    var text = "👍";
    
    switch (randomNumber) {
        
        case 1:
            text = "👍";
            break;
        case 2:
            text = "Cool";
            break;
        case 3:
            text = "Ok";
            break;
        case 4:
            text = "Great";
            break;

    }

    return text;

}

function getResponseToNo() {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "Ok";
    
    switch (randomNumber) {
        
        case 1:
            text = "Ok";
            break;
        case 2:
            text = "Sure";
            break;
        case 3:
            text = "Fine";
            break;
        case 4:
            text = "Ok then";
            break;
        case 5:
            text = "Fine then";
            break;
            
    }
    
    return text;
    
}

function getResponseToImageInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "What a nice picture you sent me - thank you!";
    
    switch (randomNumber) {
        
        case 1:
            text = "What a nice picture you sent me - thank you!";
            break;
        case 2:
            text = "Wow, lovely picture - really inspiring!";
            break;
        case 3:
            text = "I'm not sure what to make of this picture!?";
            break;
        case 4:
            text = "What a beautiful picture!  Thanks for sharing that with me " + userProfile.first_name + "!";
            break;
        case 5:
            text = "What are you trying to tell me?";
            break;
            
    }
    
    return text;
    
}

function getResponseToVideoInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "Woah, what an amazing video!";
    
    switch (randomNumber) {
        
        case 1:
            text = "Woah, what an amazing video!";
            break;
        case 2:
            text = "Superb video!";
            break;
        case 3:
            text = "I'm not sure what to make of that video!?";
            break;
        case 4:
            text = "There's beautiful imagery in that video.  Really nice!";
            break;
        case 5:
            text = "Wow, I've never seen a video like that before!";
            break;
            
    }
    
    return text;
    
}

function getResponseToAudioInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "What a sound!";
    
    switch (randomNumber) {
        
        case 1:
            text = "What a sound!";
            break;
        case 2:
            text = "That sounds magical!";
            break;
        case 3:
            text = "I'm not sure what to make of that sound!?";
            break;
        case 4:
            text = "Now, that's an interesting noise!";
            break;
        case 5:
            text = "I've never heard a sound like that before!";
            break;
            
    }
    
    return text;
    
}

function getResponseToFileInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "Thanks for sending me this.";
    
    switch (randomNumber) {
        
        case 1:
            text = "Thanks for sending me this.";
            break;
        case 2:
            text = "Wow, this looks like a special gift!";
            break;
        case 3:
            text = "What an interesting gift you've sent me!  Thank you!";
            break;
        case 4:
            text = "What a cool gift - thanks!";
            break;
        case 5:
            text = "Now that's something different!";
            break;
            
    }
    
    return text;
    
}
