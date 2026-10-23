# Save once, answer each person

In a configured support post, reply normally as a moderator. Right-click your answer → **Apps → Save this answer**. The bot takes the original question and exact message link. `/teach question:… solution:…` works without an existing message.

Saving is the approval: one action, then **Saved.** or **Already saved.** Ordinary conversation and bot replies never become approved knowledge automatically. Save public guidance; saved facts can be used anywhere in the same server.

Duplicate detection first checks identical facts with matching scope and expiry. It then retrieves related items using keywords and embeddings, and asks the local model whether all the new facts already exist. Different numeric facts cannot be discarded as duplicates. The comparison is conservative and fallible: uncertain or unavailable model checks preserve the new answer. Saves are serialized per server within one bot process to prevent duplicate clicks. Running multiple bot instances can still race.

The stored moderator wording, original question and starter context are evidence, not a response template. Saving an answer also clears its original question from the waiting queue without marking it solved. For every new supported question—even an identical repeat—the selected LLM writes a short answer grounded in current saved facts and the asker’s context. Citations must refer to retrieved evidence. Unknown questions wait quietly in `/queue`; account operations go to private human support. Saving never broadcasts to older posts.

`/answers` → choose an item → **Edit** updates facts, patterns and scope, creates a version and refreshes its embedding. **Remove** excludes it from future retrieval after confirmation. Old versions and posted replies remain. `/teach` supports optional scope and expiry for time-sensitive facts. Expired items are excluded from retrieval.

`/queue` is a compact list. Choose a question to open it, mark it solved, or retry against current knowledge. One-off questions need not become FAQs.

Clear confirmations such as “that worked, thanks” from the original asker resolve the case silently; gratitude alone does not. “That didn’t work” preserves the last suggestion and member’s feedback for a moderator, reopens a resolved case when needed, and queues it without another reply. A moderator retry includes failed suggestions in the model context and rejects an identical repeated answer. Paraphrased repetition remains dependent on model reasoning.

`/queue` groups similarly worded waiting questions within the same server and support channel. Counts include only posts the moderator and bot can access. Groups are navigation suggestions, not confirmed duplicates: no posts are merged, answered or closed together. Selecting a group rechecks access and opens its individual questions. Numbers and negative conditions keep distinct issues apart.
