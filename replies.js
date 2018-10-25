
var request = require('request');

var db = require('./db')
var send = require('./send')

var {parseIntent} = require('./grammar')


var quickReplyMessages = ['tellmemore', 'notnow', 'yes', 'notyet'];


function sendIntroMessages(recipientID, userProfile) {
    
    sendGroupOfMessages(recipientID, userProfile, 0, null, "");
    
}


function sendIntroText(recipientID, userProfile, inviter) {
    console.log("sendIntroText");
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
        update: { $setOnInsert: { "user": parseInt(recipientID), "bought_net": false, 
                                "told_more": false, "referred_by": inviterForQuery, 
                                "first_name": userProfile.first_name, "last_name": userProfile.last_name,
                                "profile_pic": userProfile.profile_pic, "locale": userProfile.locale, "timezone": parseInt(userProfile.timezone),
                                "gender": userProfile.gender, "num_starts": 1,
                                "status": "active", "time_joined": currentTimestamp,
                                "num_messages": 0, "num_message_attachments": 0,
                                "num_referrals" : 0, "num_recursive_referrals" : 0,
                                "num_zaps": 0, "num_nets": 0, "inviter": inviter } },
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
                            // Update some fields for this user in the users table
                            // Send intro messages

                        // Increment the num_starts field and reset num_zaps to 0
                        db.mongo.users.findAndModify(
                            {
                                query: { "user": parseInt(recipientID) },
                                update: { $inc: { "num_starts": 1 },
                                          $set: { "status": "active", "num_zaps": 0 } }
                            },
                            function(err, results){
                                if (err) { console.error("MongoDB error: " + err); }

                                sendIntroMessages(recipientID, userProfile);
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
    // case 'score':
    //   send.sendMessage(recipientID, getResponseToLeaderboard(recipientID, userProfile), null, true);
    //   return

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
    case 'name':
            send.sendMessage(recipientID,
        [
            500, "My name is midge the mozz and I've set my friends on you.",
            2200, "Why don't you buy a mozzie net?",
        ]);
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
 
      case 'leaderboard':
        send.sendMessage(recipientID, getResponseToLeaderboard(recipientID, userProfile), null, true);
        return


      case 'reset':
      console.log("reset");
        sendIntroText(recipientID, userProfile, null);
        return

      case 'invite':
        send.share(recipientID);
        return

      case 'greeting':
        send.sendMessage(recipientID, [1000, "Hi " + userProfile.first_name + ", Midge here, coming to get you."], function() { send.sendMozzie(recipientID);}, true);
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

    // Find how if the user has zapped this mozzie before ...

    db.mongo.mozzies.findAndModify(
        {
            query: { "recipient": parseInt(recipientID),
                     "time_sent": parseInt(payloadTimestamp),
                     "time_zapped": null },
            update: { $set: { "time_zapped": parseInt(currentTimestamp) } }
        },
        function(err, results){
            
            if (err) { console.error("MongoDB error: " + err); }

            if (results == null) {

                // An unzapped mozzie with this payloadTimestamp doesn't exist, so find out if there is a zapped one or not and return the appropriate messge

                db.mongo.mozzies.find(
                {
                    "recipient": parseInt(recipientID),
                    "time_sent": parseInt(payloadTimestamp)
                }, function(err, mongoMozzieResults){    
                    
                    if (err) { console.error("MongoDB error: " + err); }
                    
                    if (mongoMozzieResults.length <= 0) {

                        // There is no mozzie with the payloadTimestamp specified ...

                        send.sendMessage(recipientID, [500, "That's weird - you're trying to zap a mozzie that doesn't exist!"], null, false);

                    } else if (mongoMozzieResults[0].time_zapped != null) {

                        // Previously zapped ...
                        send.sendMessage(recipientID, [500, getAlreadyZappedText(userProfile)], null, false);

                        // FOR TESTING ONLY ...
                        //sendGroupOfMessages(recipientID, userProfile, 4, null);

                    }
                });

            } else {

                // Found the unzapped mozzie and marked it as zapped ...

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

    // Get the zapTime of the most recent mozzie

    var zapTimeRecentMozzie = currentTimestamp - parseInt(payloadTimestamp);
    var zapTimeRecentMozzieInSeconds = getZapTimeInSeconds(zapTimeRecentMozzie);

    var initialText = "";

    if (zapTimeRecentMozzieInSeconds <= 0.1) {
        initialText = "Wow, you're a ninja - you can't zap faster than that!";
    } else if (zapTimeRecentMozzieInSeconds <= 0.2) {
        initialText = "Incredible speed - I can't believe how fast you zapped that mozzie!";
    } else if (zapTimeRecentMozzieInSeconds <= 0.3) {
        initialText = "Woah, that was fast!  Amazing speed!";
    } else if (zapTimeRecentMozzieInSeconds <= 0.4) {
        initialText = "Incredibly impressive - how did you zap that mozzie so quickly!?";
    } else if (zapTimeRecentMozzieInSeconds <= 0.5) {
        initialText = "Super speedy zapping - congrats!!!";
    } else if (zapTimeRecentMozzieInSeconds <= 0.7) {
        initialText = "Impressive reflexes - I didn't expect you to zap so quickly!";
    } else if (zapTimeRecentMozzieInSeconds <= 0.9) {
        initialText = "Wow, you zapped in under a second - very impressive!";
    } else if (zapTimeRecentMozzieInSeconds <= 1) {
        initialText = "They'll be calling you super-speedy " + userProfile.first_name + " with zapping that fast!";
    } else if (zapTimeRecentMozzieInSeconds <= 1.2) {
        initialText = "Very impressive speed!";
    } else if (zapTimeRecentMozzieInSeconds <= 1.5) {
        initialText = "Very speedy, I'm really impressed!";
    } else if (zapTimeRecentMozzieInSeconds <= 1.8) {
        initialText = "Boom - what a zap!  So stealthy!  I admire how you did that!";
    } else if (zapTimeRecentMozzieInSeconds <= 2) {
        initialText = "That mozzie didn't see you coming " + userProfile.first_name + "!";
    } else if (zapTimeRecentMozzieInSeconds <= 2.5) {
        initialText = "Another high velocity zap - good job " + userProfile.first_name + "!";
    } else if (zapTimeRecentMozzieInSeconds <= 3) {
        initialText = "Very respectable time - have you been practicing!?";
    } else if (zapTimeRecentMozzieInSeconds <= 3.5) {
        initialText = "Pretty fast - you must be pleased with those reactions!";
    } else if (zapTimeRecentMozzieInSeconds <= 4) {
        initialText = "Great effort - I'm impressed!";
    } else if (zapTimeRecentMozzieInSeconds <= 5) {
        initialText = "I can see you hustling to zap that mozzie - a little slow, so stay sharp for the next one!";
    } else if (zapTimeRecentMozzieInSeconds <= 6) {
        initialText = "Woah, it took you a little long to zap that one - be careful!!!";
    } else if (zapTimeRecentMozzieInSeconds <= 8) {
        initialText = "Woah, that was dangerously close to the 10 second window " + userProfile.first_name + " - stay more alert for the next one!";
    } else if (zapTimeRecentMozzieInSeconds <= 10) {
        initialText = "Aaahhh - you were JUST inside the 10 second window - you were incredibly close to getting stung and it'd be game over - be careful!";
    } else {
        initialText = "OH NO - it took you over 10 seconds to zap that mozzie and it stung you.  You now have malaria and you'll soon be dead 😢";
    }

    sendTimeAndPointsText(initialText, zapTimeRecentMozzieInSeconds, recipientID, userProfile, newNumZaps);

}

function sendTimeAndPointsText(initialText, zapTimeRecentMozzieInSeconds, recipientID, userProfile, newNumZaps) {

    var punctuation = "!";
    if (zapTimeRecentMozzieInSeconds >=1) {
        punctuation = ".";
    }

    send.sendMessage(recipientID,

        [
            200, initialText,
            500, "You zapped that mozzie in " + getReadableTime(zapTimeRecentMozzieInSeconds, false),
        ],

        function() {

            sendGroupOfMessages(recipientID, userProfile, newNumZaps, null, "");

        }

    , false);

}


function sendGroupOfMessages(recipientID, userProfile, newNumZaps, payload, messageTextLowerCaseAlphanumericOnly) {

    // Firstly get necessary attributes from the users table ...

    db.mongo.users.find({ "user": parseInt(recipientID) }, function(err, mongoUserResults){

        if (err) { console.error("MongoDB error: " + err); }

        var toldMore = mongoUserResults[0].told_more;

        if (payload == "tell_me_more" || messageTextLowerCaseAlphanumericOnly == "tellmemore") {

            // Mark this user as having been told more
            db.mongo.users.findAndModify({
                query: { "user": parseInt(recipientID) },
                update: {
                    $set: { "told_more": true }
                },
            },
            function(err, results) {
                if (err) { console.error("MongoDB error: " + err); }
            })
    
            send.sendMessage(recipientID,
    
                [
                    1000, "Your £1.50 will be sent to the Against Malaria Foundation",
                    3000, "They will use your £1.50 to buy a malaria net for someone in need",
                    3000, "100% of your money goes towards buying the net",
                    2000, "Oh, here comes a message from the CEO of the Against Malaria Foundation!! ... bear with us as we establish a connection ...",
                ],
    
                function() {
                    setTimeout(function() {
    
                        send.sendVideo(recipientID, "https://www.projectedgames.com/amf/video2_small.mp4",
                        
                        function() {
    
                            send.sendMessage(recipientID,
    
                                [
                                    10000, "Once the video arrives, just press play to watch it!"
                                ],
                
                                function() {
                                    setTimeout(function() {
                                        send.sendQuickReplies(
                                            recipientID,
                                            "Are you ready to buy a malaria net and make an enormous difference in someone’s life?",
                                            "Yes", "yes",
                                            "Not yet", "not_yet");
                                    }, 20000);
                                }
                        
                            );
    
                        });
                    }, 50);
                }
        
            );
    
        } else if (payload == "yes" || messageTextLowerCaseAlphanumericOnly == "yes") {
    
            send.sendMessage(recipientID,
    
                [
                    1000, "That’s fantastic!",
                    1500, "Thank you so much!",
                    1500, "You’re amazing!",
                    1500, "Ok, this step shouldn’t take more than a minute ...",
                    3000, "You just need to grab your credit or debit card ...",
                    3000, "Then tap the button below and type in your email and card details",
                ],
    
                function() {
                    setTimeout(function() {
    
                        send.sendPayButton(
                            recipientID,
                            "Ready to make a massive difference in someone’s life? ...",
                            "https://www.projectedgames.com/amf/amf_payment.html",
                            "Buy a net for £1.50",
                            null);
                    }, 2000);
                }
        
            );
    
        } else if (payload == "not_yet" || payload == "not_now" ||
                   messageTextLowerCaseAlphanumericOnly == "notyet" ||
                   messageTextLowerCaseAlphanumericOnly == "notnow") {

            if (newNumZaps < 6) {

                send.sendMessage(recipientID,
    
                    [
                        1000, "Ok",
                        1000, "But these mozzies will keep coming at you until you buy a net!! ..."
                    ],
        
                    function() {
                        setTimeout(function() {
                            send.sendMozzie(recipientID);
                        }, 3000);
                    }
            
                );

            } else {

                send.sendMessage(recipientID,
    
                    randomChoice([
                        [1000, "Keep zapping then - you’re gonna be here a while!"],
                        [1000, "Really!? … you’re taking a massive risk!", 2500, "These mosquitoes will keep coming at you and you'll have to zap them quickly to avoid contracting malaria! ..."],
                        [1000, "You’ve gotta be kidding!! ... It's only £1.50 and this torturous stream of killer mosquitos will come to an end!", 3500, "Well, you’re the one choosing to live on the edge ..."],
                        [1000, "You can’t zap forever! ... you’ll need to buy a net eventually ..."],
                        [1000, "What if you get distracted and don’t zap fast enough!?", 3000, "It’s just not worth the risk!! ..."]
                    ]),
        
                    function() {
                        setTimeout(function() {
                            send.sendMozzie(recipientID);
                        }, 4000);
                    }
            
                );

            }
    
        } else {
    
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
                                send.sendMozzie(recipientID);
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
                                send.sendMozzie(recipientID);
                            }, 3000);
                        }
                
                    );
    
                    break; 
    
                case 2:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "Great zapping so far!!",
                            1500, "Malaria is an often deadly fever which can leave an infected person with brain damage and respiratory issues.",
                            4500, "It kills half a million people every year!"
                        ],
    
                        function() {
                            setTimeout(function() {
                                send.sendMozzie(recipientID);
                            }, 3000);
                        }
                
                    );
    
                    break; 
    
                case 3:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "The crazy thing about malaria is that it’s entirely preventable!",
                            3000, "That’s why you and your friends have probably never had it.",
                            3000, "But about 1 in 5 people in sub saharan Africa are infected with malaria!"
                        ],
    
                        function() {
                            setTimeout(function() {
                                send.sendMozzie(recipientID);
                            }, 5500);
                        }
                
                    );
    
                    break; 
                    
                case 4:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "Malaria nets protect people from mosquitoes at night",
                            2500, "They’re the most effective way of preventing malaria because mosquitoes usually bite between 10pm and 2am",
                            5000, "Imagine sleeping in a room with a malaria-infected mosquito and not having the protection of a net - terrifying right!?"
                        ],
    
                        function() {
                            setTimeout(function() {
                                send.sendMozzie(recipientID);
                            }, 6000);
                        }
                
                    );
    
                    break;
    
                case 5:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "Here's the deadly sound a mosquito makes as it comes near you at night, ready to infect you with malaria ...",
                        ],
    
                        function() {
                            setTimeout(function() {
    
                                send.sendAudio(recipientID, "http://www.projectedgames.com/amf/mozzie-sound.m4a",
                                
                                function() {
    
                                    send.sendMessage(recipientID,
    
                                        [
                                            3000, "Just press play to hear the sound",
                                            8000, "A single malaria net usually protects two people for three whole years!",
                                            3500, "And the most amazing thing is they only cost £1.50 each!",
                                            3000, "If you buy a net now, not only will you protect two people, but these mozzies will also stop coming at you too!!",
                                        ],
                        
                                        function() {
                                            setTimeout(function() {
                                                send.sendQuickReplies(
                                                    recipientID,
                                                    "Do you want to buy a net for £1.50?",
                                                    "Tell me more", "tell_me_more",
                                                    "Not now", "not_now");
                                            }, 4000);
                                        }
                                
                                    );
    
                                });
                            }, 50);
                        }
                
                    );
    
                    break;
    
                case 6:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "Someone important wants to share a message with you!! ... bear with us as we establish a connection ...",
                        ],
        
                        function() {

                            setTimeout(function() {
    
                                send.sendVideo(recipientID, "https://www.projectedgames.com/amf/video1_small.mp4",
                                
                                function() {
    
                                    send.sendMessage(recipientID,
    
                                        [
                                            10000, "Once the video arrives, just press play to watch it!",
                                            20000, "Buy a malaria net now to stop this madness and get your life back!",
                                            3500, "You’ll also protect two real people in Africa who are actually surrounded by killer mosquitoes every night!!!"
                                        ],
                        
                                        function() {

                                            showBuyNetQuickReplies(recipientID, toldMore, 5000, "Do you want to buy a net for £1.50?");

                                        }
                                
                                    );
    
                                });

                            }, 50);
                        }
                
                    );
    
                    break; 

                case 7:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "400 million people fall ill with malaria every year!",
                            2500, "But before bed nets, the situation was three times worse!",
                            3000, "Let’s get more bed nets to people who need them to put an end to this tragic disease!"
                        ],
    
                        function() {

                            showBuyNetQuickReplies(recipientID, toldMore, 4000, "Will you buy a net for £1.50?");

                        }
                
                    );
    
                    break;

                case 8:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "Each bed net that is bought has a massive economic impact too!",
                            3000, "Every £1.50 spent on malaria results in £18 improvement in the African economy!",
                            4000, "What a crazy return on investment right!?"
                        ],
    
                        function() {

                            showBuyNetQuickReplies(recipientID, toldMore, 4000, "Will you buy a net for £1.50?");

                        }
                
                    );
    
                    break;

                case 9:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "The total funding gap for bed nets for 2018 - 2020 appears to be hundreds of millions of pounds!",
                            4500, "So this is an enormous funding need!",
                            2000, "That means someone won’t be sleeping under a net unless you buy one!"
                        ],
    
                        function() {

                            showBuyNetQuickReplies(recipientID, toldMore, 3500, "Will you buy a net for £1.50?");

                        }
                
                    );
    
                    break;

                case 10:
    
                    send.sendMessage(recipientID,
    
                        [
                            2000, "What’s most devastating is that children are most vulnerable",
                            3000, "A child under the age of 5 dies every two minutes in Africa from Malaria",
                            3500, "For every 100 - 1,000 nets we put over heads and beds, one child doesn't die",
                            3000, "Every net matters!"
                        ],
    
                        function() {

                            showBuyNetQuickReplies(recipientID, toldMore, 1500, "Will you buy a net for £1.50?");

                        }
                
                    );
    
                    break;

                case 11:

                    showBuyNetQuickReplies(recipientID, toldMore, 1500, "Are you ready to stop this mad onslaught of killer mozzies by buying a mosquito net for £1.50?");

                    break;

                default:

                    var randomNumber = Math.floor(Math.random() * 5) + 1;
                    
                    switch (randomNumber) {
                        
                        case 1:

                            send.sendMessage(recipientID,
            
                                [
                                    2000, "You must love this zapping business",
                                    1500, "If you like this zapping game so much, you should try this whack-a-mole game! ..."
                                ],
        
                                function() {
        
                                    setTimeout(function() {

                                        send.sendGenericTemplate(
            
                                            recipientID,
                                            "How fast can you whack a mole!?!",
                                            "http://www.projectedgames.com/whack/images/mole.png",
                                            "Play this fun game by whacking moles as fast as you can!",
                                            "https://m.me/whackamolebot",
                                            "Play Now!",
            
                                            function() {
            
                                                send.sendMessage(recipientID,
                
                                                    [
                                                        4000, "You can buy a net for £1.50 to protect someone from malaria",
                                                        3000, "And even though mosquitoes will stop here, you can still play a fun tapping game!"
                                                    ],
                                
                                                    function() {
                            
                                                        showBuyNetQuickReplies(recipientID, toldMore, 1500, "Do you want to buy a net for £1.50?");
                            
                                                    }
                                            
                                                );
                    
                                        });

                                    }, 3500);
        
                                }
                        
                            );

                            break;

                        case 2:

                            send.sendMessage(recipientID,
        
                                [
                                    2000, "You know, if you buy a net for £1.50, you’ll unlock a whole other game to play!"
                                ],
            
                                function() {
        
                                    showBuyNetQuickReplies(recipientID, toldMore, 3000, "Do you want to buy a net for £1.50?");
        
                                }
                        
                            );

                            break;

                        default:

                            showBuyNetQuickReplies(recipientID, toldMore, 3000, "Do you want to buy a net for £1.50?");

                            break;

                    }

                    break;
    
            }
    
        }

    });

}


function showBuyNetQuickReplies(recipientID, toldMore, timeInMillisecondsToShow, ask) {

    if (toldMore == false) {

        setTimeout(function() {
            send.sendQuickReplies(
                recipientID,
                ask,
                "Tell Me More", "tell_me_more",
                "Not now", "not_now");
        }, timeInMillisecondsToShow);

    } else {

        setTimeout(function() {
            send.sendQuickReplies(
                recipientID,
                ask,
                "Yes", "yes",
                "Not yet", "not_yet");
        }, timeInMillisecondsToShow);

    }

}


function congratsAfterBuyingNet(recipientID, userProfile) {
    send.sendMessage(recipientID,
        [
            2000, "CONGRATULATIONS!!!",
            3000, "You've bought a net!",
            4000, "These mosquitoes will stop now and you've also protected two people in Africa from malaria-infected mosquitoes!!!",
        ],
        null
    );

    // Mark this user as having bought a net
    db.mongo.users.findAndModify({
        query: { "user": parseInt(recipientID) },
        update: {
          "bought_net": true,
          $inc: {"num_nets": 1},
        },
    },
    function(err, results) {
      if (err) { console.error("MongoDB error: " + err); }
    })

    // If no-one invited us, then there's nothing more to do
    if (!userProfile.referred_by) {
      console.log("User wasn't referred by anyone")
      return
    }
    var inviter = userProfile.referred_by

    // Update their inviter's score
    db.mongo.users.findAndModify({
        query: { "user": parseInt(inviter) },
        update: {
          $inc: {"num_nets": 1},
        },
        new: true,
    },
    function(err, results) {
      if (err) { console.error("MongoDB error: " + err); }

      var inviterProfile = results[0]

      // Tell their inviter they bought a net
      send.sendMessage(inviter,
          [
            0, userProfile.first_name + " bought a net!",
            1000, "You've saved " + (2 * inviterProfile.num_nets) + " lives"
          ],
          null
      );

    })
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


//Count how many times you've referred...
function getResponseToLeaderboard(recipientID, userProfile) {
//This isn't capturing the mongodb user table profile (with updated referrals) - it is only capturing the facebook profile
  console.log(userProfile)


  //  userProfile = db.mongo.users.find({"user": recipientID});
  //console.log(recipientID)
    // direct_referrals = db.mongo.coll.find({"num_referrals":{"$exists":recipientID}}).count()


    //                 db.mongo.users.find(
    //                     {
    //                         query: { "user": parseInt(inviter) },
    //                         update: { $inc: { "num_referrals": 1, "num_recursive_referrals": 1 } },
    //                         new: true
                        // }

  // db.mongo.users.count({'num_referrals': { $gt: userProfile.num_referrals }}, function(err, peopleAhead) {
  //   if (err) { console.error("MongoDB error: " + err); }

  //   var score = peopleAhead + 1;

  //   return [
  //     200, "You've referred " + userProfile.num_referrals + " people",
  //     600, "Together you've saved " + (2 * userProfile.num_nets) + " lives",
  //     1200, "That puts you in #" + score + " place",
  //   ]
  // })
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
            text = "Nice try " + userProfile.first_name + "!  You can't zap a zapped mozzie!";
            break;
        case 3:
            text = "You're welcome to zap a mozzie as many times as you want, but it won't matter as it's already dead!";
            break;
        case 4:
            text = "What have you got against this mozzie that you have to keep zapping him!?";
            break;
        case 5:
            text = "You really are on a zapping frenzy!  You'll have to wait for the next mozzie for the zap to count!";
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

function arrayContains(needle, arrhaystack) {

    return (arrhaystack.indexOf(needle) > -1);
}

module.exports = {
  processMessage,
  processAttachment,
  processUnknownInput,
  sendIntroText,
  zap,
  sendGroupOfMessages,
  quickReplyMessages,
  arrayContains
}

