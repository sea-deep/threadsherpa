# Atlas is configured

Configured on October 23, 2026 IST through the authenticated Atlas CLI:

| Setting | Configured value |
| --- | --- |
| Project | ThreadSherpa |
| Cluster | `threadsherpa` |
| Tier | **M0 / Free** |
| Cloud / region | AWS Mumbai (`AP_SOUTH_1`) |
| Storage | 0.5 GB free-tier limit |
| Database | `threadsherpa` |
| Database access | `readWrite` on this database, restricted to this cluster |
| Network access | This Mac’s current public IP only (`/32`) |
| Vector index | `vector_index`, 768 dimensions, cosine similarity, server/status filters |
| Normal inference | Local Ollama: Gemma + EmbeddingGemma |

The connection string and generated database password are saved in the ignored local `.env`, with file permissions restricted to your account. Existing Discord and Paper keys were preserved. There are no credentials in the reports. Backups and point-in-time recovery are off. No paid cluster tier, dedicated search nodes, managed embedding API or paid hosting was enabled.

[Open this Atlas project](https://cloud.mongodb.com/v2/6ada82a2939a23b3162787ce#/clusters).

## Verified on the live database

`npm run verify:atlas` passed using two separate Node processes:

1. Process A generated an embedding locally, saved a synthetic answer, approved it and disconnected.
2. Process B read the approved answer and version and verified lexical and vector retrieval. The initial report also exercised a direct-copy path that has since been removed; the current verifier checks retrieval separately from LLM response generation.
3. Raw Atlas `$vectorSearch` retrieved the answer. A different-server filter returned no results. This check cannot silently pass using application-side vector ranking.
4. The check removed its uniquely identified synthetic records, keeping the database and indexes.

[Verification report](../data/atlas-verification.json) · [Free-tier settings snapshot](../data/atlas-deployment.json).

A first query reached the search index while the new search host was still initializing. The verifier waits for indexing and transient search-host startup errors before reporting success. These are synthetic database checks, not a Discord recording or a production traffic benchmark.

## Your remaining Discord steps

The current eight application commands have been registered globally. Message Content Intent is enabled, and a live Gateway connection accepted it. That connection was closed after verification without sending messages. The bot has not joined a server yet.

1. [Invite ThreadSherpa](https://discord.com/oauth2/authorize?client_id=1562837206442451056&scope=bot+applications.commands&permissions=274877991936&integration_type=0) and choose your test server.
2. Keep Ollama open and start the bot with `npm run dev`.
3. From a regular text channel, run `/setup channel:#your-support-forum autonomy_mode:auto`. Select the forum in the channel option; it can be empty. Then answer a sample post and right-click your reply → Apps → Save this answer.

The bot runs on your Mac. Atlas keeps reviewed answers when you stop it. Paper remains available through `npm run demo:paper`, but that optional command uses API credit; normal replies use local Ollama.

## If your network changes

Add your new current IP with:

```bash
atlas accessLists create --currentIp --projectId 6ada82a2939a23b3162787ce --comment 'ThreadSherpa local development machine'
npm run setup
```

Remove obsolete addresses in Atlas Network Access. Keep the list to the machines running your bot; a global access rule is unnecessary. You do not need to recreate the cluster or database user.
