# Your minimum setup

This workspace currently uses **Paper for support replies**, as requested. Atlas keeps the saved knowledge; Ollama still handles embeddings and duplicate checks. The instructions below also cover switching to the free local option.

This workspace now has Atlas configured. See [the completed setup and remaining Discord steps](ATLAS_SETUP.md); you do not need to create another cluster. The instructions below also explain setup from scratch.

Run ThreadSherpa on your Mac, with a free Atlas M0 cluster saving the answers and local Gemma handling AI.

For the free setup you need **two values** in `.env`: your Discord bot token and Atlas connection string. Use `MODEL_PROVIDER=ollama`. Your existing Paper key can stay saved for optional Paper demos.

| Variable | What to paste | Where to get it |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | The bot token | [Discord Developer Portal](https://discord.com/developers/applications) → your application → Bot |
| `MONGODB_URI` | The complete `mongodb+srv://…` connection string | [MongoDB Atlas](https://cloud.mongodb.com/) → cluster → Connect → Drivers |
| `PAPER_INSTRUMENTS_API_KEY` (optional) | Only for Paper demos, which use API credit | [Paper console](https://platform.paperinstruments.com/) |

**An “Atlas ID” is not needed.** Use the connection string, database username, and database password. The bot detects its Discord application ID and creates its database collections and regular indexes itself.

## 1. Get the Discord bot token

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application**, and name it **ThreadSherpa**. Open the existing application if you already created one.
2. Open **Bot** in the sidebar. Under Token, click **Reset Token** if needed, then copy the token into `DISCORD_BOT_TOKEN` in `.env`. Resetting invalidates the previous token.
3. On that same page, enable **Message Content Intent** under Privileged Gateway Intents and save. Leave Presence Intent and Server Members Intent off; this bot does not request them.
4. Open **Installation** and enable **Guild Install**. This bot goes in a server.

You do not need a public key, client secret, Interactions Endpoint URL, ngrok tunnel, or website for this Gateway-based bot. [Discord’s bot setup reference](https://docs.discord.com/developers/quick-start/getting-started).

## 2. Get the Atlas connection string

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/). Create a project named `ThreadSherpa` if you do not have one.
2. Choose **Create / Build a Database** and select the **Free / M0** option. Choose a nearby region and create the cluster. Sample data is unnecessary. [Free cluster instructions](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
3. Under **Database Access / Database Users**, create a database user. Use a username such as `threadsherpa` and keep its password. Give it the `readWrite` role on the database named `threadsherpa`. This is separate from your Atlas website login. [Database-user instructions](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
4. Under **Network Access / IP Access List**, choose **Add IP Address → Add Current IP Address**, then confirm. Add the IP of the machine running the bot; update it if you change networks or VPNs. [IP access instructions](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
5. Open your cluster → **Connect → Drivers** → choose **Node.js**. Copy the connection string into `MONGODB_URI` in `.env`. Replace the username/password placeholders with the database user from step 3. Password characters reserved in URLs must be percent-encoded. Keep the cluster hostname and query parameters Atlas gives you. [Connection instructions](https://www.mongodb.com/docs/atlas/driver-connection/).

It will look roughly like this; use your actual Atlas string:

```env
MONGODB_URI=mongodb+srv://threadsherpa:YOUR_DATABASE_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
```

No separate Atlas API key, organization ID, project ID, or cluster ID goes into this bot. Leave `MONGODB_DB_NAME` at its default, `threadsherpa`.

## 3. Check the values

From the project folder:

```bash
npm ci
npm run setup
```

The checker creates `.env` from the template only if `.env` does not exist. It never overwrites your existing keys. If a value is missing, edit `.env` in your editor and run the checker again.

A minimal `.env` is:

```env
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
MONGODB_URI=YOUR_COMPLETE_ATLAS_CONNECTION_STRING
MODEL_PROVIDER=ollama
```

The checker tests access without posting Discord messages or requesting paid generation. When your Discord token works, it prints a ready-to-use **invite URL**. Open it, select your test server, and authorize the bot. It requests channel/message/thread permissions, not Administrator. If the bot has not joined a server, opening this URL and selecting your server is still required. Channel-specific permission overrides can still block it; allow it in your support channel.

## 4. Make sure Ollama is running

If you already ran the local demo, these models may already be installed. Otherwise install [Ollama for macOS](https://ollama.com/download/mac), open it, and run:

```bash
ollama pull gemma4:e4b-it-qat
ollama pull embeddinggemma-2:270m
```

Run `npm run setup` again. You want Discord, MongoDB and the local models to show **OK**. Paper is only checked when you explicitly choose Paper mode.

## 5. Start the bot and choose one channel

Invite it before starting, then run:

```bash
npm run dev
```

For a **forum channel**, run setup from a regular text channel such as `#bot-commands`, as a server administrator:

```text
/setup channel:#ask-mlh autonomy_mode:auto
```

Select your actual forum in the command’s **channel** option. The command runs in the text channel, but connects the selected forum. This works even when the forum has no posts. You do not need to create a setup post or repeat setup for every question.

The bot replies inside new posts when it finds a supported answer. Unknown questions wait quietly in `/queue`. It needs **View Channel**, **Read Message History**, **Send Messages in Threads / Send Messages in Posts**, and **Embed Links** there. Channel-specific overrides must allow those permissions.

A forum’s top-level view has no normal message composer, so do not try to run `/setup` there. If you already have a forum post, you can alternatively run `/setup autonomy_mode:auto` **inside that post on first setup**; the bot selects its parent forum. Using the explicit `channel` option from a text channel works even if you have configured another support channel already.

For an ordinary text support channel, run `/setup autonomy_mode:auto` directly in it on first setup, or select it explicitly with the `channel` option. Plain `/setup` uses on-request replies. No moderator role ID is required; server administrators can save answers. Add a moderator role later with `/setup admin_role:@Moderators`.

1. Make a sample question. Unknown questions wait quietly in `/queue`.
2. Reply as a moderator, then right-click your answer → **Apps → Save this answer**.
3. You’ll see **Saved.** or **Already saved.** No extra approval.
4. Ask a new question. The LLM writes a short reply using the saved facts and the new question’s context.

`/answers` → choose an answer → **Edit** or **Remove**. `/queue` → choose a question → **Open post**, **Solved** or **Retry**. Saving knowledge does not post to older questions. Clear “that worked” confirmations close a question quietly. “That didn’t work” queues the attempted answer and feedback for a moderator; `/queue` groups repeated waiting topics.

`/teach question:… solution:…` is a fallback when there is no existing answer message. For a small official FAQ, optionally add its exact page with `/setup source_url:https://…`. The bot does not search the open web.

Keep the terminal and your Mac running while using this local bot. Use Ctrl+C to stop it. Atlas retains saved answers across restarts.

## If something blocks you

| What you see | What to check |
| --- | --- |
| Discord token rejected | Copy the **Bot Token**, not the client secret or application ID. If you reset it, update `.env`. |
| Bot cannot read posts / disallowed intent | Enable **Message Content Intent** on the Bot page. |
| MongoDB cannot connect | Database user/password, password encoding, and **Add Current IP Address** in Atlas. |
| Slash commands missing | Invite the bot with the URL from the checker, then restart it. One-server setups register commands directly in that server. For multiple servers, optionally set `DISCORD_DEV_GUILD_ID` to your test server ID. |
| No reply in forum posts | From a regular text channel, run `/setup channel:#your-forum autonomy_mode:auto`. Unknown questions are intentionally quiet: check `/queue` first. For reviewed questions, check View Channel, Read Message History, Send Messages in Posts/Threads, and Embed Links on the selected forum. |
| Ollama missing | Open Ollama and pull the two models above. |

## Later, only if you need it

Paper, Sentry, Render hosting, and a custom moderator role are optional. `npm run demo:paper` uses Paper API credit even when normal bot replies use local Ollama. They are not required to get the bot working.

For Atlas Vector Search specifically, create a vector search index named `vector_index` on `threadsherpa.knowledge_items` using [this JSON](atlas-vector-index.json). The bot works before this: it can rank the stored embeddings itself. Add the Atlas vector index before demonstrating that specific feature in your challenge entry.

## Verify Atlas after connecting

Run `npm run verify:atlas`. It creates the supplied vector index if missing, writes and approves a uniquely named synthetic answer, exits that Node process, then retrieves it in a fresh process. It also runs real Atlas vector queries with server filtering. It removes its own test records and saves a report to `data/atlas-verification.json`. This requires your Atlas connection and local embedding model; it posts no Discord messages and requests no paid inference. Do not run it against `memory://`.
