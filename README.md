# Let Me Tweet That For You

A modern, lightweight Twitter/X bot that polls Direct Messages (DMs), automatically tweets them, and deletes them from the bot's inbox to protect user privacy and manage state flawlessly.

This version has been completely revived using **Twitter/X API v2** (`twitter-api-v2`) and is designed to run **100% free** using GitHub Actions as a scheduler.

---

## Key Features

- **Twitter/X API v2 Integration**: Uses the latest modern API wrapper with robust performance.
- **Privacy-First Stateless Queue**: Messages are immediately deleted from the bot's end after a successful tweet, keeping your inbox clean and completely avoiding the need for a database.
- **Node.js Native Features**: Zero-dependency environment file loading using native Node 20.6.0+ features (`--env-file`).
- **Dry-Run / Simulation Mode**: Test the bot completely offline without having to register or call the live Twitter/X API.
- **Automated Testing Suite**: High test coverage using Node's native lightweight test runner (no bulky testing frameworks required).
- **100% Free Hosting via GitHub Actions**: Runs on a cron scheduler inside GitHub completely for free, requiring no hosting accounts, servers, or credit cards.

---

## Setup & Configuration

### Prerequisites
- Node.js **>= 20.6.0** and npm installed.
- A Twitter/X Developer account.

### 1. Configure Twitter/X App Permissions (Crucial Step!)
To allow the bot to read, tweet, and delete DMs, you must configure your Developer App correctly:
1. Go to the [Twitter Developer Portal](https://developer.twitter.com/).
2. Select your App, and click **User authentication settings** to edit them.
3. Set the **App Permissions** to **"Read and Write and Direct Messages"**. *(By default, new apps are write-only, so this must be changed manually).*
4. Go to the **Keys and Tokens** tab and generate your tokens.
   - **Note**: If you set your DM permissions *after* generating your Access Token/Secret, you **must** regenerate them so they carry the DM permissions.

### 2. Local Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment configuration template to create your local development settings:
   ```bash
   cp .env.example .env.development
   ```
3. Open `.env.development` and paste your development/test credentials:
   ```env
   TWITTER_CONSUMER_KEY=your_api_key_here
   TWITTER_CONSUMER_SECRET=your_api_key_secret_here
   TWITTER_ACCESS_TOKEN_KEY=your_access_token_here
   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
   ```

---

## Running the Bot Locally

### Running in Dry-Run Mode (Simulation)
You can run and test the bot's entire polling, tweeting, and deleting loop completely **offline** without using live credentials:
```bash
npm run dev -- --dry-run --verbose
```

### Running in Live Daemon Mode
To start the bot as a continuously running local server that polls Twitter for new DMs every 60 seconds using your development credentials:
```bash
npm run dev -- --verbose
```

### Single Execution Mode
To poll and process pending DMs exactly once and then exit cleanly:
```bash
npm run dev -- --once --verbose
```

---

## Development & Quality Assurance

### Code Quality (Linter & Formatter)
Ensure clean, standard JavaScript code styling before pushing:
```bash
# Check code style with ESLint
npm run lint

# Format code automatically with Prettier
npm run format
```

### Running Automated Tests
Run the unit test suite offline using Node's native test runner:
```bash
npm test
```

---

## Free Production Deployment (GitHub Actions)

This bot is fully pre-configured to run as a scheduled task every 15 minutes using GitHub Actions, costing you **$0.00/month**.

### Deployment Steps:
1. **Push your code** to your personal GitHub repository.
2. Open your repository on **GitHub.com** in your browser.
3. Click the **Settings** tab.
4. On the left sidebar, navigate to **Secrets and variables** > **Actions**.
5. Click **New repository secret** (green button) and add your production Twitter API keys with these exact names:
   - `TWITTER_CONSUMER_KEY`
   - `TWITTER_CONSUMER_SECRET`
   - `TWITTER_ACCESS_TOKEN_KEY`
   - `TWITTER_ACCESS_TOKEN_SECRET`
6. Click the **Actions** tab on your GitHub repository.
7. Select the **Poll and Tweet DMs** workflow.
8. If you want to test it immediately, click the **Run workflow** dropdown and trigger it manually! Otherwise, it will automatically wake up and run on schedule every 15 minutes.

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
