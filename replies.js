
var request = require('request');

var db = require('./db')

var PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
var SLEEP_MODE = process.env.SLEEP_MODE == "true"


function processUnknownInput(recipientID, userProfile) {
  sendMessage(recipientID, [500, getResponseToUnknownInput(userProfile)], null, true);
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
                db.mongo.logs.insert(
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
                    db.mongo.users.findAndModify(
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
                    
                    db.mongo.users.findAndModify(
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

                    db.mongo.users.findAndModify(
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

            db.mongo.messages.insert(
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



/* Algorithmic functions */

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


module.exports = {
  processMessage,
  processAttachment,
  processUnknownInput,

  sendTypingIndicator,
}

