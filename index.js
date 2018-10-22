var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
require('dotenv').config();

var send = require('./send')
var replies = require('./replies')
var db = require('./db')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());


// Only set this to true if all is broken and you need time to fix it - it will put the game on hold for everyone, returning a standard
// message everytime they send anything!

var SLEEP_MODE = process.env.SLEEP_MODE == "true"


/* Messenger Platform variables */

// PAGE_ACCESS_TOKEN

var PAGE_ACCESS_TOKEN = "";  // Test Page (set when running locally)

if (process.env.PAGE_ACCESS_TOKEN) {
  PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // Production Page (set when running from Heroku)
}

// PAGE_VERIFY_TOKEN

var PAGE_VERIFY_TOKEN = "";  // Test Page (set when running locally)
 
if (process.env.PAGE_VERIFY_TOKEN) {
  PAGE_VERIFY_TOKEN = process.env.PAGE_VERIFY_TOKEN; // Production Page (set when running from Heroku)
}


// MY USER ID (FOR LOCAL TIMESTAMPS IN THE STATS AND LOGGING PAGES)

var MY_USER_ID;

if (process.env.MY_USER_ID) {
    MY_USER_ID = process.env.MY_USER_ID; // Production Page (set when running from Heroku)
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
  response.send("Malaria Challenge Test Page");
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
    db.purgeLogs();
    //res.sendStatus(200);
    res.status(200).end();
  } else {
    res.send("In Sleep Mode!");
  }

});


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
    if (data != null && data.object === 'page' && data.entry != null) {
        
        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function(entry) {
            
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            if (entry.messaging != null) {

                // Iterate over each messaging event
                entry.messaging.forEach(function(event) {

                    if ((event.message && !event.message.is_echo) || event.postback) {
                        
                        var senderID = event.sender.id;
                        
                        if (SLEEP_MODE == true) {
                            
                            // In sleep mode, so just return a standard message, but don't process any further! ...
                            sendMessage(event.sender.id, [200, getSleepModeText()], null, true);
                            
                        } else {

                            // Not in sleep mode, so continue as normal! ...

                            db.mongo.logs.insert(
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
                            if (parseInt(senderID) == MY_USER_ID) {

                                var ipAddressRequest = "http://ip.changeip.com";
                                request(ipAddressRequest, function(error, response, body) {
                                    db.mongo.logs.insert(
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
                        
                            send.sendTypingIndicator(senderID, true);

                            // Get the user's profile information (from the user's table, otherwise from graph.facebook.com)
                            getValidUserProfile(senderID, function(validUserProfile) {
                                
                                // DELETE THIS LINE AFTER TESTING
                                validUserProfile.first_name = "";

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

                      var senderID = event.sender.id;
                        // Log ref param
                        var ref_for_logging = event.referral;
                        if (event.referral != null) {
                            ref_for_logging = ref_for_logging + " (" + JSON.stringify(event.referral) + ")";
                        }

                      var inviter = parseInt(event.referral.ref.replace("invite_", ""));
                        
                      console.log("Ref parameter for user " + senderID + " = " + ref_for_logging + " [through Referral (existing user)]");

                      // Read profile from Facebook and create new user 
                      getValidUserProfile(senderID, function(validUserProfile) {

                        // DELETE THIS LINE AFTER TESTING
                        validUserProfile.first_name = "";

                        replies.sendIntroText(senderID, validUserProfile, inviter);

                      });
                        
                    } else {
                        console.log("Webhook received unknown event: ", event);
                    }
                });
            }
        });
    }
});

function isInt(n) {
    return n % 1 === 0; }

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

    db.mongo.users.find({ "user": parseInt(recipientID) }, 
    { "first_name": 1, "last_name": 1, "profile_pic": 1, "locale": 1, "timezone": 1, "gender": 1, _id: 0 },
    function(err, mongoUserResults){

        if (mongoUserResults.length > 0 ) {

            var validUserProfile = {
                first_name:mongoUserResults[0].first_name,
                last_name:mongoUserResults[0].last_name,
                profile_pic:mongoUserResults[0].profile_pic,
                locale:mongoUserResults[0].locale,
                timezone:mongoUserResults[0].timezone,
                gender:mongoUserResults[0].gender
            };

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
                "?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=" + PAGE_ACCESS_TOKEN;
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

                db.mongo.logs.insert(
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
                    send.sendTypingIndicator(recipientID, false);
                } else {

                    var userProfile = null;

                    if (bodyJSON != null) {

                        userProfile = { first_name:bodyJSON.first_name,
                                        last_name:bodyJSON.last_name,
                                        profile_pic:bodyJSON.profile_pic,
                                        locale:bodyJSON.locale,
                                        timezone:bodyJSON.timezone,
                                        gender:bodyJSON.gender
                                    };

                    }

                    if (isUserProfileValid(userProfile) == true) {
                
                        // As the userProfile retrieved from graph.facebook.com is valid, update the details in the users table if it exists
                        db.mongo.users.findAndModify(
                            {
                                query: { "user": parseInt(recipientID) },
                                update: { $set: { "first_name": userProfile.first_name,
                                                  "last_name": userProfile.last_name,
                                                  "profile_pic": userProfile.profile_pic,
                                                  "locale": userProfile.locale,
                                                  "timezone": parseInt(userProfile.timezone),
                                                  "gender": userProfile.gender } }
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
                                gender:null
                            };
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
    console.log(JSON.stringify(event));
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

        db.mongo.users.count({ "user": parseInt(senderID) }, function(err, mongoUserResults){
            
            if (err) { console.error("MongoDB error: " + err); }
            
            var userExists = false;
            if (mongoUserResults > 0) {
                userExists = true;
            } else {
                console.log("[receivedMessage] User doesn't exist: " + senderID + " (message: '" + messageText + "')");
            }

            if (userExists == false) {

                // If the user doesn't exist, try to start the challenge

                replies.sendIntroText(senderID, userProfile, null);

            } else {

                // Otherwise, the user exists, so process the message / attachment ...

                var processMessageText = true;

                var quickReply = message.quick_reply;

                if (quickReply != null) {

                    var quickReplyPayload = quickReply.payload;
                    
                    if (quickReplyPayload != null) {

                        // Then we process the message as a quick reply
                        processMessageText = false;

                        db.mongo.users.find({ "user": parseInt(senderID) }, function(err, mongoUserResults){

                            if (err) { console.error("MongoDB error: " + err); }
            
                            if (mongoUserResults != null) {
            
                                var numZaps = mongoUserResults[0].num_zaps;
            
                                replies.sendGroupOfMessages(senderID, userProfile, numZaps, quickReplyPayload);
            
                            }
            
                        });

                    }
                }

                if (messageText && processMessageText == true) {
                    
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
        
                    db.mongo.messages.insert(
                        queryJSON,
                        function(err, results){
                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));
                        }    
                    );
        
                    // Increment num_messages for this user in the user's table
                    db.mongo.users.findAndModify(
                        {
                            query: { "user": parseInt(senderID), "num_messages": {$ne:null} },
                            update: { $inc: { "num_messages": 1 } }
                        },
                        function(err, results){
                            if (err) { console.error("MongoDB error: " + err); }
                        }
                    );
                
                    // Now process the message
        
                    replies.processMessage(senderID, userProfile, messageText);
                
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
        
                        db.mongo.message_attachments.insert(
                            queryJSON,
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                                //console.log("MongoDB results: " + JSON.stringify(results));
                            }    
                        );
        
                        // Increment num_message_attachments for this user in the user's table
                        db.mongo.users.findAndModify(
                            {
                                query: { "user": parseInt(senderID), "num_message_attachments": {$ne:null} },
                                update: { $inc: { "num_message_attachments": 1 } }
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }
                            }
                        );
                        
                        // Now process the attachment
                        
                        replies.processAttachment(senderID, userProfile, messageAttachments[0], attachmentURL, stickerID);
        
                    } else {
        
                        replies.processUnknownInput(senderID, userProfile)
        
                    }
                }

            }

        });
        
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

    db.mongo.users.count({ "user": parseInt(senderID) }, function(err, mongoUserResults){
        
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
              console.log("Line 688: " + inviter + " = checking if it is a number and not senderID");
                // Ensure inviter is made up of digits only and is not equal to the sender id
                var isnum = /^\d+$/.test(inviter);
                if (isnum && inviter != senderID) {
                    valid_inviter = inviter;
              console.log("Valid: " + valid_inviter);

                }
            }
            
            // Get the ad_id and ad_ref if they exist ...
            var ad_id = -1;
            var ad_ref = "";
            if (event.postback.referral != null && event.postback.referral.ad_id != null) {
                ad_id = event.postback.referral.ad_id;
                ad_ref = event.postback.referral.ref;
            }

            replies.sendIntroText(senderID, userProfile, valid_inviter);
            
        } else if (payload.includes("zap")) {
            var payloadTimestamp = payload.replace("zap_", "");
            replies.zap(senderID, userProfile, payloadTimestamp);
        } else if (payload == "My Ranking") {
            // TO IMPLEMENT ...
            // viewScore(senderID, false, true, null);
        } else if (payload == "Invite Friends") {
            share(senderID);
        }

    });

}

