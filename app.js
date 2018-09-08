/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request');

var app = express();
app.set('port', 5000);
// app.use(bodyParser.json());
app.use(bodyParser.json({verify: verifyRequestSignature}));
// verify before get page
// for req can get body

app.set('view engine', 'ejs');
app.use(express.static('public'));

/*
 * Open config/default.json and set your config values before running this server.
 * You can restart the *node server* without reconfiguring anything. However, whenever
 * you restart *ngrok* you will receive a new random url, so you must revalidate your
 * webhook url in your App Dashboard.
 */

// App Dashboard > Dashboard > click the Show button in the App Secret field
const APP_SECRET = config.get('appSecret');

// App Dashboard > Webhooks > Edit Subscription > copy whatever random value you decide to use in the Verify Token field
const VALIDATION_TOKEN = config.get('validationToken');

// App Dashboard > Messenger > Settings > Token Generation > select your page > copy the token that appears
const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

// In an early version of this bot, the images were served from the local public/ folder.
// Using an ngrok.io domain to serve images is no longer supported by the Messenger Platform.
// Github Pages provides a simple image hosting solution (and it's free)
const IMG_BASE_PATH = 'https://rodnolan.github.io/posterific-static-images/';

// make sure that everything has been properly configured
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

app.post('/webhook', function(req,res){
  var data = req.body;
  if (data.object == 'page'){
    console.log("messege recieved");
    data.entry.forEach(function(pageEntry){
      pageEntry.messaging.forEach(function(messagingEvent){
        let propertyNames  = Object.keys(messagingEvent);
        console.log("[app.post] webhook event props:", propertyNames.join());

        if(messagingEvent.message){
          processMessageFromPage(messagingEvent);
        }else{
          console.log("[app.post] not prepared to handle this event type");
        }

      })
    })

  }else{
    console.log("error not fb");
  }
  res.sendStatus(200);
});

app.get('/webhook', function(req, res){
  // res.sendStatus(200);
  if(req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN){
    console.log("[app.get] Validating webhook");
    res.status(200).send(req.query['hub.challenge'])
  } else{
    console.error("Valid don't pass");
    res.sendStatus(403);
  }

});

function verifyRequestSignature(req, res, buf){
  var signature = req.headers['x-hub-signature'];
  // console.log("hello");
  //fb request will contain x-hub-signature
  if (!signature){
    console.log("couldn't verify signature");
  }else{
    console.log("pass verify signature ");
    var elements = signature.split("=");
    var signatureHash = elements[1];
    var expextedHash = crypto.createHmac('sha1', APP_SECRET)
                             .update(buf)
                             .digest("hex");
    if(signatureHash != expextedHash){
      throw new Error("couldn't verify the request signature")
    }
  }
}

function processMessageFromPage(event){
  var senderID = event.sender.id;
  var pageID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  // console.log("[processMessageFromPage] user (%d) page (%d) timestamp (%d) and message (%s)",
             // senderID, pageID, timeOfMessage, JSON.stringify(message));
  var messageText = message.text;
  if(messageText){
    // console.log("[processMessageFromPage]: (%s)", messageText)
    sendMessage(senderID, messageText)
  }

}

function sendMessage(recipientId, messageText){
  var messageData = {
    recipient: {id: recipientId},
    message:{text: messageText}
  };
  console.log("[sendMessage]: (%s)", JSON.stringify(messageData));
  callSendAPI(messageData);
}

function callSendAPI(messageData){
  request({
    uri:"https://graph.facebook.com/v2.6/me/messages",
    qs:{access_token: PAGE_ACCESS_TOKEN},
    method: "POST",
    json: messageData
  }, function(error, response, body){
    if(!error && response.statusCode == 200){
       console.log("[callSendAPI] success");
    } else{
      console.log("[callSendAPI] failed");
    }
  });
}

/*
 * Start your server
 */
app.listen(app.get('port'), function() {
  console.log('[app.listen] Node app is running on port', app.get('port'));
});

module.exports = app;
