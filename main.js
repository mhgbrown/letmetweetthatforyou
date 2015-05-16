var Twit = require('twit'),
  OARequest = require('twit/lib/oarequest'),
  opts = require('commander');

  opts.version('0.0.1')
  .option('-v, --verbose', 'Log some debug info to the console')
  .parse(process.argv);

// Initialize Twitter API keys
var twitter = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });

// Verify the credentials
twitter.get('/account/verify_credentials', function(error, data) {

  // if there was an error authenticating, bail
  if(error) {
    console.error(JSON.stringify(error));
    throw error;
  }

  if(opts.verbose) {
    console.log("credential verification: " + JSON.stringify(data));
  }

});

var stream = twitter.stream('user');

stream.on('direct_message', function(directMessage) {
  var currentMessage = directMessage.direct_message;

  if(opts.verbose) {
    console.log(JSON.stringify(currentMessage));
  }

  // bail if there is no direct message to check out
  if(!currentMessage) {
    console.warn("no message to read");
    return;
  }

  // tweet the message
  twitter.post('statuses/update', { status: currentMessage.text, possibly_sensitive: true },  function(error, tweet) {

    if(error) {
      console.error("status update: " + JSON.stringify(error));
    }

    if(opts.verbose) {
      console.log(JSON.stringify(tweet));
    }

  });

  // delete the message
  // NOTE: funny that id_str is the actual id of the message
  twitter.post('direct_messages/destroy', { id: currentMessage.id_str },  function(error, data) {

    if(error) {
      console.error("message destroy: " + JSON.stringify(error));
    }

    if(opts.verbose) {
      console.log(JSON.stringify(data));
    }

  });
});

stream.on('warning', function(warning) {
  console.warn("stream warning: " + JSON.stringify(warning));
});

stream.on('disconnect', function(disconnect) {
  console.error("stream disconnect: " + JSON.stringify(disconnect));
});

// Handle exit signals
process.on('SIGINT', function() {
  process.exit(1);
});

process.on('exit', function() {
  console.log("Exiting...");
});
