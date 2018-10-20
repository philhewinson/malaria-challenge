
var request = require('request');

var db = require('./db')

var SLEEP_MODE = process.env.SLEEP_MODE == "true"
var PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 

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
                        subtitle: "Climb the global leaderboard when your friends and their friends buy malaria nets!",
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



module.exports = {
  sendTypingIndicator,
  sendMessage,
  sendImage,
  share,
}
