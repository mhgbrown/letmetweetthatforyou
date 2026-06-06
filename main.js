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
      },
    ];
  } else {
    try {
      const dmPage = await client.v2.listDmEvents({
        'dm_event.fields': ['id', 'text', 'sender_id', 'event_type'],
        max_results: 50,
      });
      events = dmPage.events || [];
    } catch (error) {
      logError('Failed to fetch DM events from Twitter API:', error);
      return;
    }
  }

  log(`Retrieved ${events.length} DM events to analyze.`);

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

    const tweetText = event.text;
    log(`Processing DM ID ${event.id}: "${tweetText}"`);

    // 1. Tweet the DM text
    let tweetSuccess = false;
    if (dryRun) {
      log(`Dry Run [TWEET SUCCESS]: Simulated tweet of "${tweetText}"`);
      tweetSuccess = true;
    } else {
      try {
        const tweet = await client.v2.tweet(tweetText);
        log(`Successfully tweeted DM ${event.id}. Tweet ID: ${tweet.data.id}`);
        tweetSuccess = true;
      } catch (error) {
        logError(`Failed to tweet DM ${event.id}:`, error);
      }
    }

    // 2. Delete the DM if tweet succeeded (or if dry-run) to clean queue
    if (tweetSuccess) {
      if (dryRun) {
        log(`Dry Run [DELETE SUCCESS]: Simulated deletion of DM ${event.id}`);
      } else {
        try {
          // Deletes the DM event from the conversation for the bot
          await client.v1.deleteDm(event.id);
          log(`Successfully deleted DM ${event.id} from queue.`);
        } catch (error) {
          logError(`Failed to delete DM ${event.id} (will retry in next sweep):`, error);
        }
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
  processDMs,
  validateCredentials,
  setBotId: (id) => {
    botId = id;
  },
  getBotId: () => botId,
  setClient: (mockClient) => {
    client = mockClient;
  },
};
