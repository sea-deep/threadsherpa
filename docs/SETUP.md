# Set up ThreadSherpa

You need a Discord bot token, a MongoDB connection string, and a model. Local Ollama inference is the default. Paper Instruments is optional and uses API credit.

## Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. On **Bot**, copy or reset the bot token. Put it in `DISCORD_BOT_TOKEN` in your local `.env`.
3. Enable **Message Content Intent**. Presence and Server Members intents are not required.
4. On **Installation**, enable **Guild Install**.
5. After running `npm run setup`, use the invite URL it prints to add the bot to your server. It requests channel and message permissions, not Administrator.

Never commit the bot token. Resetting a token invalidates the old one.

## Connect MongoDB

Use a local MongoDB instance or a [free MongoDB Atlas cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

1. Create a database user with `readWrite` access to the `threadsherpa` database. [Database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
2. Allow the IP of the machine running the bot. [Network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
3. Open the cluster's **Connect → Drivers** panel and copy its connection string into `MONGODB_URI`. Fill in the database username and password; percent-encode reserved password characters. [Connection guide](https://www.mongodb.com/docs/atlas/driver-connection/).

No Atlas project ID, API key, or organization ID is required. The bot creates its collections and regular indexes itself.

## Install and check

Use Node.js 22 or newer:

```bash
npm ci
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_BOT_TOKEN=your_bot_token
MONGODB_URI=your_mongodb_connection_string
MODEL_PROVIDER=ollama
```

Install [Ollama](https://ollama.com/download), keep it running, then pull the models:

```bash
ollama pull gemma4:e4b-it-qat
ollama pull embeddinggemma-2:270m
npm run setup
npm run dev
```

The setup checker validates connectivity without posting messages or requesting paid generation. It detects the Discord application ID and prints the bot invite URL.

To use Paper for replies, add a [Paper Instruments key](https://platform.paperinstruments.com/) and set:

```env
MODEL_PROVIDER=paper
PAPER_INSTRUMENTS_API_KEY=your_paper_key
```

Local Ollama embeddings and duplicate checks are still used in Paper mode.

## Connect a support forum

As a server administrator, run this in an ordinary text channel:

```text
/setup channel:#support autonomy_mode:auto
```

Select the actual forum in the **channel** option. The forum's top-level view has no normal message composer, so setup runs from a text channel. You do not need an initial forum post.

Allow the bot **View Channel**, **Read Message History**, **Send Messages**, **Send Messages in Threads / Posts**, and **Embed Links**. Check parent-forum permission overrides too.

For a normal text support channel, select it using the same `channel` option. Plain `/setup` uses on-request replies. Add a moderator role with `/setup admin_role:@Moderators` if needed; administrators can already save answers.

## Save the first answer

1. Post a question and answer it as a moderator.
2. Right-click the answer → **Apps → Save this answer**.
3. Ask the question again in a new post, using different words.

The bot should write a short sourced reply. Unsupported questions wait in `/queue` without a public filler message. Saving knowledge does not broadcast replies to older posts.

Use `/memory` to manage this server’s saved answers in a private moderator panel. Pick an answer to edit its wording, source, scope, or expiry. Search with `/memory query:submission`. Expired answers remain visible here but are excluded from replies.

**Import FAQs** opens a form for up to 4,000 characters and 10 answers. Paste Markdown with one question per `##` heading, or `Q:` / `A:` pairs:

```markdown
## Where do I submit?
Post the public repository in #submissions.

## Do I need a video?
A video is optional.
```

Review the preview and choose **Save answers**. Nothing is saved before confirmation. Re-importing the same answers skips duplicates. A failed import can resume from the unfinished answer. No extra API key or file upload is needed.

`/answers` and `/teach question:… solution:…` still work.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Token rejected | Use the Bot Token, not the client secret. Update `.env` after resetting it. |
| Cannot read messages | Enable Message Content Intent and check channel permissions. |
| Atlas connection fails | Check the database user, password encoding, and IP access list. |
| Commands missing | Use the setup checker's invite URL and restart. `DISCORD_DEV_GUILD_ID` can target a test server. |
| No automatic forum reply | Connect the parent forum with `autonomy_mode:auto`, then check `/queue` and thread permissions. |
| Local model unavailable | Start Ollama and pull both models above. |

For index-backed vector search, create `vector_index` on `knowledge_items` using [this definition](atlas-vector-index.json). The app also supports vector ranking without that index.

Keep the process running for the local bot to remain online. Atlas retains knowledge across restarts. See [deployment options](DEPLOYMENT.md) for hosting.
