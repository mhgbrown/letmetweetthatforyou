const test = require('node:test');
const assert = require('node:assert');
const { getBotIdentity, processDMs, setBotId, setClient } = require('./main.js');

test('Twitter/X Bot Unit Tests', async (t) => {
  // Reset botId before each test
  t.beforeEach(() => {
    setBotId(null);
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
  });

  await t.test('processDMs polls and tweets DMs successfully', async () => {
    let tweetCalledWith = null;
    let deleteDmEventCalledWith = null;

    const mockClient = {
      v2: {
        listDmEvents: async () => ({
          events: [
            {
              id: 'dm_999',
              event_type: 'MessageCreate',
              sender_id: 'user_sender_123',
              text: 'Hello, this is a test DM!',
            },
          ],
        }),
        tweet: async (text) => {
          tweetCalledWith = text;
          return { data: { id: 'tweet_id_111' } };
        },
        deleteDmEvent: async (id) => {
          deleteDmEventCalledWith = id;
          return { success: true };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123'); // Set self ID differently to mock sender

    await processDMs();

    assert.strictEqual(tweetCalledWith, 'Hello, this is a test DM!');
    assert.strictEqual(deleteDmEventCalledWith, 'dm_999');
  });

  await t.test('processDMs skips messages sent by the bot itself', async () => {
    let tweetCalled = false;
    let deleteCalled = false;

    const mockClient = {
      v2: {
        listDmEvents: async () => ({
          events: [
            {
              id: 'dm_self',
              event_type: 'MessageCreate',
              sender_id: 'bot_id_123', // Same as botId
              text: 'I sent this myself!',
            },
          ],
        }),
        tweet: async () => {
          tweetCalled = true;
          return { data: {} };
        },
        deleteDmEvent: async () => {
          deleteCalled = true;
          return { success: true };
        },
      },
    };

    setClient(mockClient);
    setBotId('bot_id_123');

    await processDMs();

    assert.strictEqual(tweetCalled, false, 'Should not tweet self-sent messages');
    assert.strictEqual(deleteCalled, false, 'Should not delete un-tweeted self-sent messages');
  });

  await t.test('processDMs skips non-MessageCreate events', async () => {
    let tweetCalled = false;

    const mockClient = {
      v2: {
        listDmEvents: async () => ({
          events: [
            {
              id: 'dm_non_message',
              event_type: 'ParticipantsJoined',
              sender_id: 'user_sender_123',
              text: 'Should be ignored',
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

    await processDMs();

    assert.strictEqual(tweetCalled, false, 'Should skip non-MessageCreate events');
  });
});
