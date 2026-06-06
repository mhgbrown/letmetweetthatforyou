const { TwitterApi } = require('twitter-api-v2');

// Parse command line arguments simply and natively
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const dryRun = args.includes('--dry-run') || args.includes('-d');
const once = args.includes('--once') || args.includes('-1');

const SWEEP_INTERVAL = 60000; // Poll every 60 seconds

// Logger helper
function log(...msg) {
  if (verbose || dryRun) {
    console.log(`[${new Date().toISOString()}]`, ...msg);
  }
}

function logError(...msg) {
  console.error(`[${new Date().toISOString()}] ERROR:`, ...msg);
}

// Validation helper for credentials
function validateCredentials() {
  if (dryRun) return true;

  const required = [
    'TWITTER_CONSUMER_KEY',
    'TWITTER_CONSUMER_SECRET',
    'TWITTER_ACCESS_TOKEN_KEY',
    'TWITTER_ACCESS_TOKEN_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Initialize client (or mock in dry run)
let client;
let botId = null;
let lastTweetText = null;
let lastTweetTime = null;

function initializeClient() {
  if (!dryRun && !client) {
    client = new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY,
      appSecret: process.env.TWITTER_CONSUMER_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN_KEY,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
  }
}

// Fetch Bot identity to avoid processing self-sent DMs
async function getBotIdentity() {
  if (dryRun) {
    botId = 'MOCK_BOT_12345';
    log(`Dry Run: Mock bot identity set to ${botId}`);
    return;
  }

  try {
    const me = await client.v2.me();
    botId = me.data.id;
    log(`Authenticated successfully as @${me.data.username} (ID: ${botId})`);
  } catch (error) {
    logError('Failed to verify credentials / fetch bot identity:', error);
    throw error;
  }
}

// Fetch the bot's own last tweet to establish state tracking
async function fetchLastTweet() {
  if (dryRun) {
    lastTweetText = 'This is a mock tweet from dry-run mode!';
    lastTweetTime = new Date();
    return;
  }

  try {
    const timeline = await client.v2.userTimeline(botId, {
      max_results: 5,
      'tweet.fields': ['created_at', 'text'],
    });

    if (timeline && timeline.tweets && timeline.tweets.length > 0) {
      const lastTweet = timeline.tweets[0];
      lastTweetText = lastTweet.text;
      lastTweetTime = new Date(lastTweet.created_at);
      log(`Fetched last tweet: "${lastTweetText}" (created_at: ${lastTweetTime.toISOString()})`);
    } else {
      log('No previous tweets found in timeline (fresh account).');
    }
  } catch (error) {
    logError('Failed to fetch user timeline / last tweet:', error);
  }
}

// Core processing function
async function processDMs() {
  log('Checking for new Direct Messages...');

  let events = [];

  if (dryRun) {
    // Mock incoming messages for dry-run testing
    log('Dry Run: Simulating incoming Direct Messages.');
    events = [
      {
        id: 'mock_dm_001',
        event_type: 'MessageCreate',
        sender_id: 'mock_user_abc',
        text: 'This is a mock tweet from dry-run mode! ' + Math.floor(Math.random() * 1000),
        created_at: new Date().toISOString(),
      },
    ];
  } else {
    try {
      const dmPage = await client.v2.listDmEvents({
        'dm_event.fields': ['id', 'text', 'sender_id', 'event_type', 'created_at'],
        max_results: 50,
      });
      events = dmPage.events || [];
    } catch (error) {
      logError('Failed to fetch DM events from Twitter API:', error);
      return;
    }
  }

  log(`Retrieved ${events.length} DM events to analyze.`);

  const dmsToTweet = [];

  for (const event of events) {
    // Only process MessageCreate type events
    if (event.event_type !== 'MessageCreate') {
      log(`Skipping non-MessageCreate event: ${event.id} (type: ${event.event_type})`);
      continue;
    }

    // Skip messages sent by the bot itself to prevent infinite feedback loops
    if (event.sender_id === botId) {
      log(`Skipping self-sent message: ${event.id}`);
      continue;
    }

    // Stop if we hit a DM that matches our last tweet's text (meaning we processed this and everything older)
    if (lastTweetText && event.text === lastTweetText) {
      log(`Found DM matching last tweet text: "${event.text}". Stopping older DM processing.`);
      break;
    }

    // Stop if we hit a DM received before or at the same time as our last tweet
    if (lastTweetTime && new Date(event.created_at) <= lastTweetTime) {
      log(
        `Found DM received at/before last tweet time (${event.created_at} <= ${lastTweetTime.toISOString()}). Stopping older DM processing.`
      );
      break;
    }

    dmsToTweet.push(event);
  }

  // If no tweets exist yet, only process the single most recent DM to establish initial state
  if (!lastTweetTime && dmsToTweet.length > 1) {
    log(
      'Fresh account (no previous tweets). Only processing the single most recent DM to establish timeline.'
    );
    const mostRecent = dmsToTweet[0]; // First in list is the newest
    dmsToTweet.length = 0;
    dmsToTweet.push(mostRecent);
  }

  // Reverse to process in chronological order (oldest first)
  dmsToTweet.reverse();

  log(`Identified ${dmsToTweet.length} new DM(s) to tweet.`);

  for (const event of dmsToTweet) {
    const tweetText = event.text;
    log(`Processing DM ID ${event.id}: "${tweetText}"`);

    // Tweet the DM text
    if (dryRun) {
      log(`Dry Run [TWEET SUCCESS]: Simulated tweet of "${tweetText}"`);
    } else {
      try {
        const tweet = await client.v2.tweet(tweetText);
        log(`Successfully tweeted DM ${event.id}. Tweet ID: ${tweet.data.id}`);

        // Update the tracked state so subsequent iterations / runs are in sync
        lastTweetText = tweetText;
        lastTweetTime = new Date();
      } catch (error) {
        logError(`Failed to tweet DM ${event.id}:`, error);
      }
    }
  }

  log('Finished processing DMs.');
}

// Main execution block
async function main() {
  validateCredentials();
  initializeClient();
  try {
    await getBotIdentity();
    await fetchLastTweet();
  } catch (error) {
    logError('Bot startup failed:', error);
    process.exit(1);
  }

  if (once) {
    log('Running in single-execution mode (--once)...');
    await processDMs();
    log('Done! Exiting single-execution mode.');
    process.exit(0);
  }

  log(`Starting daemon mode (polling every ${SWEEP_INTERVAL / 1000} seconds)...`);
  // Process immediately on start, then start polling interval
  await processDMs();
  const intervalId = setInterval(processDMs, SWEEP_INTERVAL);

  // Handle termination signals cleanly
  const shutdown = () => {
    log('Shutting down bot daemon...');
    clearInterval(intervalId);
    log('Exited.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main();
}

module.exports = {
  getBotIdentity,
  fetchLastTweet,
  processDMs,
  validateCredentials,
  setBotId: (id) => {
    botId = id;
  },
  getBotId: () => botId,
  setLastTweetText: (text) => {
    lastTweetText = text;
  },
  getLastTweetText: () => lastTweetText,
  setLastTweetTime: (time) => {
    lastTweetTime = time;
  },
  getLastTweetTime: () => lastTweetTime,
  setClient: (mockClient) => {
    client = mockClient;
  },
};
