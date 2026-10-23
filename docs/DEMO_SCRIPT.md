# A simple demo

Use synthetic questions in your own test server.

1. Ask a question with no saved knowledge. Show it waiting quietly in `/queue`.
2. Answer as a moderator. Right-click → **Apps → Save this answer**. One confirmation: **Saved.**
3. Save it again: **Already saved.** No messages broadcast to old posts.
4. Ask two differently worded questions. Show short replies tailored by the LLM to each question, using the same saved facts.
5. Click **Solved** on one reply. Show `/stats`.
6. Open `/answers`, choose the fact, click **Edit**. Ask again to demonstrate the correction.
7. Ask “Please reset my 2FA” without real credentials. Show the private human-support handoff.

`npm run demo` runs deterministic fixtures with real repository and policy code. It explicitly labels the provider scripted; it is not an AI quality measurement. `npm run demo:live` uses local Ollama on synthetic, temporary-memory data without Discord messages. `npm run demo:paper` uses paid Paper credit and must be chosen explicitly.

Every new supported question now uses inference, including exact repeats. Earlier zero-generation timings and Paper usage reports describe a removed direct-copy path. They do not measure the current experience. Record current outputs and latency before making performance claims.

`npm run verify:atlas` checks separate-process persistence, exact retrieval, real vector queries and server isolation. Answer generation is tested separately. Neither a fixture demo nor database verification proves live Discord UI behavior or broad answer accuracy.
