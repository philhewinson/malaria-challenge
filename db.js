
var mongo_db_url = 'malaria';
if (process.env.MONGODB_URI) {
    mongo_db_url = process.env.MONGODB_URI;
}

var collections = ['users', 'logs', 'messages'];
var mongojs = require('mongojs');

var SLEEP_MODE = process.env.SLEEP_MODE == "true"

var mongo = null;
if (SLEEP_MODE == false) {
    mongo = mongojs(mongo_db_url, collections);
}


function logError(error, userID) {

    if (userID == null) {
        userID = -1;
    }
    
    if (SLEEP_MODE == false) {

        mongo.logs.insert(
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


function purgeLogs() {
    
    var currentTimestamp = new Date().getTime();

    var numDaysToKeepLogsFor = 3;   // Variable for LOCAL TEST ENVIRONMENT ONLY
    if (process.env.NUM_DAYS_KEEP_LOGS) {
      numDaysToKeepLogsFor = parseFloat(process.env.NUM_DAYS_KEEP_LOGS);
    }

    console.log("Purging old logs more than " + numDaysToKeepLogsFor + " days old ...");
    
    mongo.logs.remove(
        {
            "timestamp": { $lte: parseInt(currentTimestamp - (numDaysToKeepLogsFor*24*60*60*1000)) }
        },
        function(err, results){

            if (err) { console.error("MongoDB error: " + err); }
            console.log("MongoDB results: " + JSON.stringify(results));
        }
    );
}



module.exports = {
  logError,
  purgeLogs,
  mongo,
}
