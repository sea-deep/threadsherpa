For the shortest complete path, start with [Your minimum setup](START_HERE.md).

# Connect a test server

1. Create an application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under Bot, enable **Message Content Intent**. The app uses Guilds, Guild Messages, Message Content, and Guild Message Reactions intents. Server Members Intent is not required by this code.
3. Invite the bot with OAuth scopes `bot` and `applications.commands`. Grant View Channels, Send Messages, Send Messages in Threads, Read Message History, Embed Links in the channels where it should help. Administrator permission for the bot is unnecessary.
4. Copy `.env.example` to `.env`. Set `DISCORD_BOT_TOKEN`; the application ID is detected automatically. Optionally set `DISCORD_DEV_GUILD_ID` for immediate test-server command registration. Configure MongoDB and the local models.
5. Run `npm run build && npm start`. Commands register on ready.
6. As a server administrator, open a regular text channel (for example `#bot-commands`) and run `/setup channel:#your-forum autonomy_mode:auto`. Select the forum in the channel option. This works before the forum has any posts; commands do not run in its top-level view. A custom moderator role is optional.
7. Answer a synthetic forum question, then right-click your reply → Apps → Save this answer. Review it and ask again in a new post. Check `/queue` for unsupported questions. Try the solved and moderator buttons as the original asker, then as an unrelated member to verify permissions.
8. Automatic replies apply to new posts in the selected forum. To stop monitoring it, run `/setup remove_channel:#your-forum` from a regular text channel. On first setup, running the command inside an existing forum post also selects its parent forum.

Use a dedicated test server for demos. Do not import the MLH screenshot or its members’ messages as a knowledge base. The screenshot motivates the problem; it is not permission to ingest that community’s history or represent its policies.

The application reads new events; it does not backfill historical posts. New forum posts are owned by `threadCreate`; their initial `messageCreate` event does not create another case. Threads started by the bot are ignored by the thread-creation handler.

If commands seem stale, restart the bot and check command-registration logs. With one joined server, commands register in that server automatically. With multiple servers and no development guild configured, global registration can take time to propagate.
