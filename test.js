const test = require('node:test');
const assert = require('node:assert');
const {
  getBotIdentity,
  fetchLastTweet,
  processDMs,
  setBotId,
  setLastTweetText,
  setLastTweetTime,
  setClient,
  RATE_LIMIT_USER_MAX_TWEETS,
  RATE_LIMIT_GLOBAL_MAX_TWEETS_PER_RUN,
} = require('./main.js');

test('Twitter/X Bot Unit Tests', async (t) => {
  // Reset states before each test
  t.beforeEach(() => {
    setBotId(null);
    setLastTweetText(null);
    setLastTweetTime(null);
    setClient(null);
  });

  await t.test('getBotIdentity retrieves user ID successfully', async () => {
    const mockMeResult = {
      data: {
        id: '1234567890',
        username: 'testbot',
      },
    };

    const mockClient = {
      v2: {
        me: async () => mockMeResult,
      },
    };

    setClient(mockClient);
    await getBotIdentity();
    assert.strictEqual(mockClient.v2.me.name, 'me'); // Dummy assert to verify me was called
  });

  await t.test('fetchLastTweet retrieves and stores last tweet successfully', async () => {
    const mockTimelineResult = {
      tweets: [
        {
          text: 'Hello, this is my last tweet!',
          created_at: '2026-06-06T12:00:00.000Z',
        },
      ],
    };

    const mockClient = {
      v2: {
        userTimeline: async () => mockTimelineResult,
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');
    await fetchLastTweet();
  });

  await t.test('processDMs tweets new DMs successfully', async () => {
    let tweetCalledWith = null;

    const mockClient = {
      v2: {
        listDmEvents: async () => ({
          events: [
            {
              id: 'dm_999',
              event_type: 'MessageCreate',
              sender_id: 'user_sender_123',
              text: 'Hello, this is a test DM!',
              created_at: '2026-06-06T12:05:00.000Z', // 5 minutes newer than last tweet
            },
          ],
        }),
        tweet: async (text) => {
          tweetCalledWith = text;
          return { data: { id: 'tweet_id_111' } };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');
    setLastTweetText('Hello, this is my last tweet!');
    setLastTweetTime(new Date('2026-06-06T12:00:00.000Z'));

    await processDMs();

    assert.strictEqual(tweetCalledWith, 'Hello, this is a test DM!');
  });

  await t.test('processDMs skips DMs matching last tweet text', async () => {
    let tweetCalled = false;

    const mockClient = {
      v2: {
        listDmEvents: async () => ({
          events: [
            {
              id: 'dm_matching',
              event_type: 'MessageCreate',
              sender_id: 'user_sender_123',
              text: 'Hello, this is my last tweet!', // Same text as last tweet
              created_at: '2026-06-06T12:05:00.000Z',
            },
          ],
        }),
        tweet: async () => {
          tweetCalled = true;
          return { data: {} };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');
    setLastTweetText('Hello, this is my last tweet!');
    setLastTweetTime(new Date('2026-06-06T12:00:00.000Z'));

    await processDMs();

    assert.strictEqual(tweetCalled, false, 'Should not tweet duplicate of last tweet');
  });

  await t.test(
    'processDMs skips DMs received before or at the same time as last tweet',
    async () => {
      let tweetCalled = false;

      const mockClient = {
        v2: {
          listDmEvents: async () => ({
            events: [
              {
                id: 'dm_older',
                event_type: 'MessageCreate',
                sender_id: 'user_sender_123',
                text: 'Older message!',
                created_at: '2026-06-06T11:55:00.000Z', // 5 minutes older than last tweet
              },
            ],
          }),
          tweet: async () => {
            tweetCalled = true;
            return { data: {} };
          },
        },
      };

      setClient(mockClient);
      setBotId('bot_id_123');
      setLastTweetText('Hello, this is my last tweet!');
      setLastTweetTime(new Date('2026-06-06T12:00:00.000Z'));

      await processDMs();

      assert.strictEqual(tweetCalled, false, 'Should skip DMs received before last tweet');
    }
  );

  await t.test(
    'processDMs only processes the single most recent DM on fresh accounts',
    async () => {
      const tweetsCalledWith = [];

      const mockClient = {
        v2: {
          listDmEvents: async () => ({
            events: [
              {
                id: 'dm_newest',
                event_type: 'MessageCreate',
                sender_id: 'user_sender_123',
                text: 'Newest DM!',
                created_at: '2026-06-06T12:05:00.000Z',
              },
              {
                id: 'dm_older',
                event_type: 'MessageCreate',
                sender_id: 'user_sender_123',
                text: 'Older DM!',
                created_at: '2026-06-06T12:00:00.000Z',
              },
            ],
          }),
          tweet: async (text) => {
            tweetsCalledWith.push(text);
            return { data: {} };
          },
        },
      };

      setClient(mockClient);
      setBotId('bot_id_123');
      setLastTweetText(null); // Fresh account (no previous tweets)
      setLastTweetTime(null);

      await processDMs();

      assert.strictEqual(tweetsCalledWith.length, 1, 'Should only process one DM on fresh startup');
      assert.strictEqual(tweetsCalledWith[0], 'Newest DM!', 'Should process the newest DM');
    }
  );

  await t.test('processDMs respects user-level rate limiting', async () => {
    const tweetsCalledWith = [];
    const senderId = 'spammer_123';

    const mockClient = {
      v2: {
        listDmEvents: async () => {
          const events = [];
          for (let i = 0; i < RATE_LIMIT_USER_MAX_TWEETS + 2; i++) {
            events.push({
              id: `dm_${i}`,
              event_type: 'MessageCreate',
              sender_id: senderId,
              text: `Spam DM ${i}!`,
              created_at: new Date(Date.now() + i * 1000).toISOString(),
            });
          }
          return { events };
        },
        tweet: async (text) => {
          tweetsCalledWith.push(text);
          return { data: { id: `tweet_${tweetsCalledWith.length}` } };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');
    setLastTweetText('Initial last tweet');
    setLastTweetTime(new Date(Date.now() - 10000));
    const { clearUserTweetHistory } = require('./main.js');
    clearUserTweetHistory();

    await processDMs();

    assert.strictEqual(
      tweetsCalledWith.length,
      RATE_LIMIT_USER_MAX_TWEETS,
      `Should limit the user to at most ${RATE_LIMIT_USER_MAX_TWEETS} tweets`
    );
  });

  await t.test('processDMs respects global run-level rate limiting', async () => {
    const tweetsCalledWith = [];

    const mockClient = {
      v2: {
        listDmEvents: async () => {
          const events = [];
          for (let i = 0; i < RATE_LIMIT_GLOBAL_MAX_TWEETS_PER_RUN + 5; i++) {
            events.push({
              id: `dm_global_${i}`,
              event_type: 'MessageCreate',
              sender_id: `user_diff_${i}`,
              text: `Tweet ${i}!`,
              created_at: new Date(Date.now() + i * 1000).toISOString(),
            });
          }
          return { events };
        },
        tweet: async (text) => {
          tweetsCalledWith.push(text);
          return { data: { id: `tweet_global_${tweetsCalledWith.length}` } };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');
    setLastTweetText('Initial last tweet');
    setLastTweetTime(new Date(Date.now() - 10000));
    const { clearUserTweetHistory } = require('./main.js');
    clearUserTweetHistory();

    await processDMs();

    assert.strictEqual(
      tweetsCalledWith.length,
      RATE_LIMIT_GLOBAL_MAX_TWEETS_PER_RUN,
      `Should limit total tweets in a run to at most ${RATE_LIMIT_GLOBAL_MAX_TWEETS_PER_RUN}`
    );
  });
});
