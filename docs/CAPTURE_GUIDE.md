# Campfire support walkthrough

Open [#ask-campfire](https://discord.com/channels/1539567434673946655/1563057629536850010). It is empty, connected to ThreadSherpa, and automatic replies are on. Its access matches your existing private support forum.

Campfire is a fictional coding community. This is a scripted walkthrough using your own account for both the questions and moderator answer.

## 1. Ask the first question

Create a post. Tag: **Projects**.

**Title**

```text
How do I submit my Campfire project?
```

**Message**

```text
My app is ready! Do I post the GitHub link here, and do I need to record a walkthrough video too?
```

The bot should stay quiet while it has no Campfire answer. Reply to your own post:

```text
For Campfire, post your public GitHub repo here with a short description. Add screenshots and setup steps to the README. Videos are optional, and solo projects are welcome.
```

Right-click **that answer** → **Apps → Save this answer**. You should see **Saved.** Do it again to check **Already saved.**

## 2. Ask about the video

Create a new post. Tag: **Projects**.

**Title**

```text
Can I submit Campfire without a video?
```

**Message**

```text
I have the code and screenshots ready, but I haven't recorded anything. Is that okay, or do I need a video before I can submit?
```

Let ThreadSherpa answer. It should focus on the optional video and the repo requirement. **Capture this post with the actual bot reply.**

## 3. Ask a different question from the same knowledge

Create a new post. Tag: **Getting started**.

**Title**

```text
What should I put in my README for Campfire?
```

**Message**

```text
I've added a short description of the app. What else should I include so someone can try it?
```

Let the bot answer. It should focus on screenshots and setup steps. **Capture this reply beside the previous one** to show that one saved answer supports different questions.

## 4. Ask about joining alone

Create a new post. Tag: **Getting started**.

**Title**

```text
Can I submit a solo project to Campfire?
```

**Message**

```text
I built this on my own and don't have a team. Can I still submit it?
```

Wait for the bot, then reply **“That worked, thanks!”** to close the question quietly. **Solved** is still available. It should answer the solo-project question without repeating the full submission instructions.

## The shots to keep

- The original human question and your answer.
- The video question with ThreadSherpa’s focused response and source link.
- The README or solo question with a different response from the same saved knowledge.
- The forum overview with the new posts.

Capture the actual bot replies. The descriptions above explain what to expect; they are not responses to paste.

To inspect the saved knowledge: `/answers query:Campfire` → choose the answer. No additional setup or commands are needed for new posts.

## Two extra interactions

- On an answered question, say **“That didn’t work. I still need help.”** The bot stays quiet and saves the failed advice for the moderator. `/queue` → select the question shows what was tried.
- For repeated questions without a saved answer, `/queue` groups similar titles with a count. Open a group to handle each post individually.
