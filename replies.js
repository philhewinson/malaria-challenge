
var request = require('request');

var db = require('./db')
var send = require('./send')

var {parseIntent} = require('./grammar')

function sendIntroMessages(recipientID, userProfile) {
    
    sendGroupOfMessages(recipientID, userProfile, 0, null);
    
}


function sendIntroText(recipientID, userProfile, inviter) {
    
    // Get current time for the time_joined field for a new user
    var currentTimestamp = new Date().getTime();

    // Get these attributes for insertion ...

    var inviterForQuery = null;
    if (isNumber(inviter)) {
        inviterForQuery = parseInt(inviter);
    }

    console.log('invite', inviter, inviterForQuery)

    db.mongo.users.findAndModify({

        query: { "user": parseInt(recipientID) },
        update: { $setOnInsert: { "user": parseInt(recipientID), "bought_net": false, "referred_by": inviterForQuery, 
                                "first_name": userProfile.first_name, "last_name": userProfile.last_name,
                                "profile_pic": userProfile.profile_pic, "locale": userProfile.locale, "timezone": parseInt(userProfile.timezone),
                                "gender": userProfile.gender, "num_starts": 1,
                                "status": "active", "time_joined": currentTimestamp,
                                "num_messages": 0, "num_message_attachments": 0,
                                "num_referrals" : 0, "num_recursive_referrals" : 0,
                                "num_zaps": 0, "inviter": inviter } },
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

                    db.mongo.users.findAndModify(
                        {
                            query: { "user": parseInt(inviter) },
                            update: { $inc: { "num_referrals": 1, "num_recursive_referrals": 1 } },
                            new: true
                        },
                        function(err, results){

                            if (err) { console.error("MongoDB error: " + err); }
                            //console.log("MongoDB results: " + JSON.stringify(results));

                            send.sendMessage(inviter,

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

                db.mongo.users.find({ "user": parseInt(recipientID) }, function(err, mongoUserResults){

                    if (err) { console.error("MongoDB error: " + err); }

                    var xSecondsAfterUserJoined = parseInt(mongoUserResults[0].time_joined) + (30*1000);
                    if (currentTimestamp > xSecondsAfterUserJoined) {

                        // User exists, 30 seconds have passed since they joined, so ...
                            // Send intro messages
                            // Update some fields for this user in the users table

                        sendIntroMessages(recipientID, userProfile);

                        // Also, increment the num_starts field
                        db.mongo.users.findAndModify(
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

function processUnknownInput(recipientID, userProfile) {
  return respondToIntent(recipientID, userProfile, {intent: 'unknown'})
}

function processMessage(recipientID, userProfile, messageText) {
  var parsed = parseIntent(messageText)
  console.log(">", messageText)
  return respondToIntent(recipientID, userProfile, parsed)
}

function respondToQuestion(recipientID, userProfile, question, subject) {
  switch (subject) {
    case 'score':
      var score = userProfile.num_referrals|0
      send.sendMessage(recipientID, [200, "Your score is " + score], null, true);
      return

    case 'english':
      send.sendMessage(recipientID, [1000, "Sorry, English is the only language I speak"], null, true);
      return
    
    case 'buy':
      send.sendMessage(recipientID, randomChoice([
        [200, "The anti-malaria foundation will make sure that every penny makes it to the people who need it."],
        [0, "Did you know that we mosquitoes kill ... every year, but the anti-malaria foundation provide pesky nets that stop me from getting my teeth into you."],
        [0, userProfile.first_name, 400, "People are dying."],
      ]), null, true);
      return

    case 'mosquito':
      send.sendMessage(recipientID, [0, "Bzzzzt."], null, true);
      return

    case 'net':
      send.sendMessage(recipientID, [0, "Nets are good"], null, true);
      return

    case 'malaria':
      send.sendMessage(recipientID, [0, "Malaria is bad"], null, true);
      return

    case 'emoji':
      send.sendMessage(recipientID, randomChoice([
        [0, "🦟"],
        [0, "🥅"],
        [0, "🥅"],
        [0, "💉"],
        [0, "💊"],
      ]), null, true)
      return

    default:
      send.sendMessage(recipientID, [2000, getResponseToQuestionInput(userProfile)], null, true);
      return
  }
}

function respondToIntent(recipientID, userProfile, parsed) {
    console.log(parsed)
    switch (parsed.intent) {
      case 'question':
        return respondToQuestion(recipientID, userProfile, parsed.question, parsed.content)

      case 'yes':
        send.sendMessage(recipientID, [200, getResponseToYes()], null, true);
        return
        
      case 'no':
        send.sendMessage(recipientID, [200, getResponseToNo()], null, true);
        return
        
      case 'reset':
        sendIntroText(recipientID, userProfile, null);
        return

      case 'invite':
        send.share(recipientID);
        return

      case 'greeting':
        send.sendMessage(recipientID, [1000, "Hi " + userProfile.first_name + ", Midge here, coming to get you."], function() { send.sendMozzy(recipientID);}, true);
        return

      case 'gratitude':
        send.sendMessage(recipientID, [1000, "You're very welcome " + userProfile.first_name + "!"], null, true);
        return

      case 'bye':
        send.sendMessage(recipientID, [1000, "Bye " + userProfile.first_name + "!"], null, true);
        return

      case 'help':
        send.sendMessage(recipientID, [2000, "What's wrong?"], null, true);
        return

      case 'buy':
        if (!parsed.negation){
          send.sendMessage(recipientID, randomChoice([
            [0, "Amazing!", 200,  "Your net will protect someone from Malaria for at least 4 years."],
            [0, "Thank you so much.", 300, "This maybe the most impactful £1.50 you’ve ever spent"],
            [0, userProfile.first_name, 400, "This will change someone's life, thank you"],
          ]), null, true);
          // TODO A ‘first name’, it looks like you’ve already bought one. Share this with a friend so that they can buy a net. 
          return
        }
        // fall-through to 'persuade' case

      case 'persuade':
        send.sendMessage(recipientID, randomChoice([
          [0, "How", 100, "Can", 100, "you", 100, "be", 100, "so", 100, "heartless."],
          [0, "Fine", 500, "I'll set my mozzie friends on you."],
          [200, "The anti-malaria foundation will make sure that every penny makes it to the people who need it."],
          [0, "Did you know that we mosquitoes kill ... every year, but the anti-malaria foundation provide pesky nets that stop me from getting my teeth into you."],
          [0, "That's understandable", 400,  "But, apparently the nets the anti-malaria foundation provide both empower local business and can protect 2 lives for 3 years."],
          [0, "Oh", 300, "Ok then.", 300, "And to think I thought you were nice."],
          [0, userProfile.first_name, 400, "People are dying."],
        ]), null, true);

        return
      case 'paid':
         send.sendMessage(recipientID, [200, "Finally, a bit of restbite from these pesky Mozzies AND you're now protecting 2 lives. Thank you so much!"], null, true);
      return

      case 'unknown':
      default:
        send.sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, true);
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

            // Facebook thumbs up
            respondToIntent(recipientID, userProfile, {intent: 'yes'})

        } else {
            
            send.sendMessage(recipientID, [2000, getResponseToImageInput(userProfile)], null, false);
            
        }

    } else if (attachment.type == "video") {

        send.sendMessage(recipientID, [6000, getResponseToVideoInput(userProfile)], null, false);

    } else if (attachment.type == "audio") {

        send.sendMessage(recipientID, [6000, getResponseToAudioInput(userProfile)], null, false);

    } else if (attachment.type == "file") {

        send.sendMessage(recipientID, [3000, getResponseToFileInput(userProfile)], null, false);

    } else {

        send.sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, false);

    }
}

function zap(recipientID, userProfile, payloadTimestamp) {

    // Get the current time as close as possible to when the zap happened
    var currentTimestamp = new Date().getTime();

    db.mongo.users.findAndModify(
        {
            query: { "user": parseInt(recipientID) },
            update: { $set: { "status": "active" } }
        },
        function(err, results){
            if (err) { console.error("MongoDB error: " + err); }
        }
    );

    // Find how if the user has zapped this mozzy before ...

    db.mongo.mozzys.findAndModify(
        {
            query: { "recipient": parseInt(recipientID),
                     "time_sent": parseInt(payloadTimestamp),
                     "time_zapped": null },
            update: { $set: { "time_zapped": parseInt(currentTimestamp) } }
        },
        function(err, results){
            
            if (err) { console.error("MongoDB error: " + err); }

            if (results == null) {

                // An unzapped mozzy with this payloadTimestamp doesn't exist, so find out if there is a zapped one or not and return the appropriate messge

                db.mongo.mozzys.find(
                {
                    "recipient": parseInt(recipientID),
                    "time_sent": parseInt(payloadTimestamp)
                }, function(err, mongoMozzyResults){    
                    
                    if (err) { console.error("MongoDB error: " + err); }
                    
                    if (mongoMozzyResults.length <= 0) {

                        // There is no mozzy with the payloadTimestamp specified ...

                        send.sendMessage(recipientID, [500, "That's weird - you're trying to zap a mozzy that doesn't exist!"], null, false);

                    } else if (mongoMozzyResults[0].time_zapped != null) {

                        // Previously zapped ...
                        send.sendMessage(recipientID, [500, getAlreadyZappedText(userProfile)], null, false);

                        // FOR TESTING ONLY ...
                        //sendGroupOfMessages(recipientID, userProfile, 4, null);

                    }
                });

            } else {

                // Found the unzapped mozzy and marked it as zapped ...

                // Increment num_zaps for this user in the user's table and later the other zap metrics (assuming they exist already,
                // otherwise do nothing) ...

                db.mongo.users.findAndModify(
                    {
                        query: { "user": parseInt(recipientID), "num_zaps": {$ne:null} },
                        update: { $inc: { "num_zaps": 1 } },
                        new: true
                    },
                    function(err, results2){

                        if (err) { console.error("MongoDB error: " + err); }

                        if (results2 != null) {

                            var newNumZaps = results2.num_zaps;

                            // Send the zap response
                            sendZapResponse(recipientID, userProfile, payloadTimestamp, currentTimestamp, newNumZaps);

                        }
                    }
                );
            }
        }
    );
}

function sendZapResponse(recipientID, userProfile, payloadTimestamp, currentTimestamp, newNumZaps) {

    // Get the zapTime of the most recent mozzy

    var zapTimeRecentMozzy = currentTimestamp - parseInt(payloadTimestamp);
    var zapTimeRecentMozzyInSeconds = getZapTimeInSeconds(zapTimeRecentMozzy);

    var initialText = "";

    if (zapTimeRecentMozzyInSeconds <= 0.1) {
        initialText = "Wow, you're a ninja - you can't zap faster than that!";
    } else if (zapTimeRecentMozzyInSeconds <= 0.2) {
        initialText = "Incredible speed - I can't believe how fast you zapped that mozzy!";
    } else if (zapTimeRecentMozzyInSeconds <= 0.3) {
        initialText = "Woah, that was fast!  Amazing speed!";
    } else if (zapTimeRecentMozzyInSeconds <= 0.4) {
        initialText = "Incredibly impressive - how did you zap that mozzy so quickly!?";
    } else if (zapTimeRecentMozzyInSeconds <= 0.5) {
        initialText = "Super speedy zapping - congrats!!!";
    } else if (zapTimeRecentMozzyInSeconds <= 0.7) {
        initialText = "Impressive reflexes - I didn't expect you to zap so quickly!";
    } else if (zapTimeRecentMozzyInSeconds <= 0.9) {
        initialText = "Wow, you zapped in under a second - very impressive!";
    } else if (zapTimeRecentMozzyInSeconds <= 1) {
        initialText = "They'll be calling you super-speedy " + userProfile.first_name + " with zapping that fast!";
    } else if (zapTimeRecentMozzyInSeconds <= 1.2) {
        initialText = "Very impressive speed!";
    } else if (zapTimeRecentMozzyInSeconds <= 1.5) {
        initialText = "Very speedy, I'm really impressed!";
    } else if (zapTimeRecentMozzyInSeconds <= 1.8) {
        initialText = "Boom - what a zap!  So stealthy!  I admire how you did that!";
    } else if (zapTimeRecentMozzyInSeconds <= 2) {
        initialText = "That mozzy didn't see you coming " + userProfile.first_name + "!";
    } else if (zapTimeRecentMozzyInSeconds <= 2.5) {
        initialText = "Another high velocity zap - good job " + userProfile.first_name + "!";
    } else if (zapTimeRecentMozzyInSeconds <= 3) {
        initialText = "Very respectable time - have you been practicing!?";
    } else if (zapTimeRecentMozzyInSeconds <= 3.5) {
        initialText = "Pretty fast - you must be pleased with those reactions!";
    } else if (zapTimeRecentMozzyInSeconds <= 4) {
        initialText = "Great effort - I'm impressed!";
    } else if (zapTimeRecentMozzyInSeconds <= 5) {
        initialText = "I can see you hustling to zap that mozzy - a little slow, so stay sharp for the next one!";
    } else if (zapTimeRecentMozzyInSeconds <= 6) {
        initialText = "Woah, it took you a little long to zap that one - be careful!!!";
    } else if (zapTimeRecentMozzyInSeconds <= 8) {
        initialText = "Woah, that was dangerously close to the 10 second window " + userProfile.first_name + " - stay more alert for the next one!";
    } else if (zapTimeRecentMozzyInSeconds <= 10) {
        initialText = "Aaahhh - you were JUST inside the 10 second window - you were incredibly close to getting stung and it'd be game over - be careful!";
    } else {
        initialText = "OH NO - it took you over 10 seconds to zap that mozzy and it stung you.  You now have malaria and you'll soon be dead 😢";
    }

    sendTimeAndPointsText(initialText, zapTimeRecentMozzyInSeconds, recipientID, userProfile, newNumZaps);

}

function sendTimeAndPointsText(initialText, zapTimeRecentMozzyInSeconds, recipientID, userProfile, newNumZaps) {

    var punctuation = "!";
    if (zapTimeRecentMozzyInSeconds >=1) {
        punctuation = ".";
    }

    send.sendMessage(recipientID,

        [
            200, initialText,
            500, "You zapped that mozzy in " + getReadableTime(zapTimeRecentMozzyInSeconds, false),
        ],

        function() {

            sendGroupOfMessages(recipientID, userProfile, newNumZaps, null);

        }

    , false);

}


function sendGroupOfMessages(recipientID, userProfile, newNumZaps, payload) {

    switch (newNumZaps) {

        case 0:

            send.sendMessage(recipientID,

                [
                    0, "Hi " + userProfile.first_name + "!",
                    3000, "There are Mosquitos ravaging the Messenger universe with Malaria and when one lands on your screen, make sure you tap it and zap it as fast as you can!",
                    4500, "Get ready, there's one coming now!!! ..."
                ],
        
                function() {
                    setTimeout(function() {
                        send.sendMozzy(recipientID);
                    }, 3000);
                }
            );

            break;

        case 1:

            send.sendMessage(recipientID,

                [
                    2000, "You’re lucky! - if it took you longer than 10 seconds you’d be dead!",
                    3000, "Did you know that in sub tropical countries, Mosquitoes can carry a blood parasite called Malaria.",
                    3000, "Here's another, it's even more deadly.  Get ready! ..."
                ],

                function() {
                    setTimeout(function() {
                        send.sendMozzy(recipientID);
                    }, 3000);
                }
        
            );

            break; 

        case 2:

            if (payload == "yes") {

                send.sendMessage(recipientID,

                    [
                        2000, "Great! ... Did you know it’s super easy to prevent? A mosquito net can keep one person safe for three years!",
                        3500, "These mosquitoes will keep coming at you unless you protect yourself!!!",
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendQuickReplies(
                                recipientID,
                                "Do you want to buy a net now for £1.50?",
                                "Yes", "yes2",
                                "No", "no2");
                        }, 3500);
                    }
            
                );

            } else if (payload == "no") {

                send.sendMessage(recipientID,

                    [
                        2000, "Malaria is an often deadly fever caused by a parasite that is spread by Mosquitoes in many tropical and subtropical regions.",
                        3000, "It kills half a million people every year!",
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendMozzy(recipientID);
                        }, 3000);
                    }
            
                );

            } else if (payload == "yes2") {

                congratsAfterBuyingNet(recipientID);

            } else if (payload == "no2") {

                send.sendMessage(recipientID,

                    [
                        2000, "Keep zapping then, you’re going to be here a while!"
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendMozzy(recipientID);
                        }, 3000);
                    }
            
                );

            } else {

                send.sendMessage(recipientID,

                    [
                        4500, "You’ve got it!"
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendQuickReplies(
                                recipientID,
                                "Do you know what Malaria is?",
                                "Yes", "yes",
                                "No", "no");
                        }, 3000);
                    }
            
                );

            }

            break; 

        case 3:

            if (payload == "yes") {

                congratsAfterBuyingNet(recipientID);

            } else if (payload == "no") {

                send.sendMessage(recipientID,

                    [
                        2000, "Really!? ... you're taking a massive risk!  These mosquitoes will keep coming at you and you'll have to zap them quickly to avoid contracting malaria! ..."
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendMozzy(recipientID);
                        }, 5000);
                    }
            
                );

            } else {

                send.sendMessage(recipientID,

                    [
                        2000, "Did you know that an insecticide-treated bed net only costs £1.50 and protects two people for three whole years!?",
                        3500, "If you buy a net now, these mozzys will stop coming at you!!",
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendQuickReplies(
                                recipientID,
                                "Do you want to buy a net now for £1.50?",
                                "Yes", "yes",
                                "No", "no");
                        }, 3500);
                    }
            
                );

            }

            break;
            
        case 4:

            if (payload == "yes") {

                congratsAfterBuyingNet(recipientID);

            } else if (payload == "no") {

                send.sendMessage(recipientID,

                    [
                        2000, "You gotta be kidding!! ... It's only £1.50 and this torturous stream of killer mosquitos will come to an end!",
                        3500, "Well, you're the one choosing to live on the edge ...",
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendMozzy(recipientID);
                        }, 3000);
                    }
            
                );

            } else {

                send.sendMessage(recipientID,

                    [
                        2000, "Here's the deadly sound a mosquito makes as it comes near you at night, ready to infect you with malaria ...",
                    ],
    
                    function() {
                        setTimeout(function() {

                            send.sendAudio(recipientID, "http://www.projectedgames.com/amf/mozzy-sound.m4a",
                            
                            function() {

                                send.sendMessage(recipientID,

                                    [
                                        8000, "If you buy a malaria net, you'll not only protect yourself, but you'll also protect a real person in Africa from real malaria-infected mosquitoes!!!",
                                    ],
                    
                                    function() {
                                        setTimeout(function() {
                                            send.sendQuickReplies(
                                                recipientID,
                                                "Are you ready to buy a net yet for just £1.50!?",
                                                "Yes", "yes",
                                                "No", "no");
                                        }, 4000);
                                    }
                            
                                );

                            });
                        }, 4000);
                    }
            
                );
            }

            break;

        case 5:

            if (payload == "yes") {

                congratsAfterBuyingNet(recipientID);

            } else if (payload == "no") {

                send.sendMessage(recipientID,

                    [
                        2000, "Wow - I have no words ...",
                    ],
    
                    function() {
                        setTimeout(function() {
                            send.sendMozzy(recipientID);
                        }, 2000);
                    }
            
                );

            } else {

                send.sendMessage(recipientID,

                    [
                        2000, "Here's a video from someone important ...",
                    ],
    
                    function() {
                        setTimeout(function() {

                            send.sendVideo(recipientID, "https://www.projectedgames.com/amf/mozzy-video.mov",
                            
                            function() {

                                send.sendMessage(recipientID,

                                    [
                                        20000, "Buy a malaria net today to stop this madness and get your life back! ...",
                                        3500, "You'll also protect two real people in Africa who are actually surrounded by real killer mosquitos every night!!!",
                                    ],
                    
                                    function() {
                                        setTimeout(function() {
                                            send.sendQuickReplies(
                                                recipientID,
                                                "Will you buy a net for £1.50?  Please!!??",
                                                "Yes", "yes",
                                                "No", "no");
                                        }, 4000);
                                    }
                            
                                );

                            });
                        }, 4000);
                    }
            
                );

            }

            break; 

    }



}


function congratsAfterBuyingNet(recipientID) {

    send.sendMessage(recipientID,

        [
            2000, "CONGRATULATIONS!!! You've bought a net!  These mosquitoes will stop now and you've also protected two people in Africa from malaria-infected mosquitoes!!!",
        ],

        null

    );

}


function getZapTimeInSeconds(zapTime) {

var zapTimeInSeconds = 0.1;

// If time <2300 ms, return 0.1
// If time between 2300ms and 5000ms, return between 0.1 and 0.5 (linear progression)
// If time >5000ms, return (x-5000)/1000 + 0.5 (i.e. time above 5s plus 0.5s)
// Always round to nearest 0.1 (single decimal place)

if (zapTime >= 2300 && zapTime <= 5000) {
    zapTimeInSeconds = 0.1 + (zapTime-2300)/2700*0.4;
} else if (zapTime > 5000) {
    zapTimeInSeconds = 0.5 + (zapTime-5000)/1000;
}

if (zapTimeInSeconds < 10) {
    zapTimeInSeconds = parseFloat((zapTimeInSeconds).toFixed(1));
} else {
    zapTimeInSeconds = parseInt((zapTimeInSeconds).toFixed(0));
}

return zapTimeInSeconds;
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

function getResponseToQuestionInput(userProfile) {
    
    // Get a random number between 1 and 5 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "What an interesting question ... to be honest with you, I'm not sure.";
    
    switch (randomNumber) {
        
        case 1:
            text = "What an interesting question ... to be honest with you, I'm not sure.";
            break;
        case 2:
            text = "I'm not sure";
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

function getAlreadyZappedText(userProfile) {
    
    // Get a random number between 1 and 10 inclusive
    var randomNumber = Math.floor(Math.random() * 5) + 1;
    
    var text = "Hey - it looks like you've already zapped this one!";
    
    switch (randomNumber) {
        
        case 1:
            text = "Hey - it looks like you've already zapped this one!";
            break;
        case 2:
            text = "Nice try " + userProfile.first_name + "!  You can't zap a zapped mozzy!";
            break;
        case 3:
            text = "You're welcome to zap a mozzy as many times as you want, but it won't matter as it's already dead!";
            break;
        case 4:
            text = "What have you got against this mozzy that you have to keep zapping him!?";
            break;
        case 5:
            text = "You really are on a zapping frenzy!  You'll have to wait for the next mozzy for the zap to count!";
            break;
            
    }
    
    return text;
    
}



/* Algorithmic functions */

function isNumber(obj) { return !isNaN(parseFloat(obj)) }

function getReadableTime(secondsTotal, shorthand) {
    
    var output;
    
    if (secondsTotal == 1) {
        output = secondsTotal + " second";
    }
    else if (secondsTotal < 60) {
        output = secondsTotal + " seconds";
    } else {
        
        var numyears = Math.floor(secondsTotal / 31536000);
        var numdays = Math.floor((secondsTotal % 31536000) / 86400); 
        var numhours = Math.floor(((secondsTotal % 31536000) % 86400) / 3600);
        var numminutes = Math.floor((((secondsTotal % 31536000) % 86400) % 3600) / 60);
        var numseconds = (((secondsTotal % 31536000) % 86400) % 3600) % 60;
        
        output =
            ( numyears > 0 ? ( numyears + ( (numyears > 1) ? " years" : " year" ) + ( (numdays > 0 || numhours > 0 || numminutes > 0 || numseconds > 0) ? ", " : "" ) ) : "" ) +
            ( numdays > 0 ? ( numdays + ( (numdays > 1) ? " days" : " day" ) + ( (numhours > 0 || numminutes > 0 || numseconds > 0) ? ", " : "" ) ) : "" ) +
            ( numhours > 0 ? ( numhours + ( (numhours > 1) ? " hours" : " hour" ) + ( (numminutes > 0 || numseconds > 0) ? ", " : "" ) ) : "" ) +
            ( numminutes > 0 ? ( numminutes + ( (numminutes > 1) ? " minutes" : " minute" ) + ( (numseconds > 0) ? ", " : "" ) ) : "" ) +
            ( numseconds > 0 ? ( numseconds + ( (numseconds > 1) ? " seconds" : " second" ) ) : "" );
    }
    
    if (shorthand == true) {
        output = output.replace("hour", "hr");
        output = output.replace("minute", "min");
        output = output.replace("second", "sec");
    }
    
    return output;
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)]
}

module.exports = {
  processMessage,
  processAttachment,
  processUnknownInput,
  sendIntroText,
  zap,
  sendGroupOfMessages
}

