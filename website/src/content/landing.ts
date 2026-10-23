export const nav = [
  { label: 'Try it', href: '/#playground' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Setup', href: '/setup/' },
] as const;

export const hero = {
  lineOne: 'Answer once.',
  lineTwo: 'Help the next person.',
  kicker: 'For Discord support teams',
  supporting:
    "ThreadSherpa turns a moderator's answer into short, personal replies for your Discord community. Save the useful facts. Let the next question arrive.",
  primary: { label: 'Set up ThreadSherpa', href: '/setup/' },
  secondary: { label: 'Try a support thread', href: '/#playground' },
  reassurance: 'Open source. Self-hosted. Start with one channel.',
  stageHeading: 'Meet Campfire.',
  stageIntro:
    'A fictional community with a familiar support problem. Open a thread and try the whole flow.',
  disclosure: 'Campfire is fictional. Nothing here posts to Discord.',
} as const;

export const howItWorks = {
  heading: 'Good support should leave something behind.',
  body:
    'Your community already has useful answers. ThreadSherpa gives moderators a way to keep them working after the original conversation ends.',
  steps: [
    {
      heading: 'Answer normally.',
      body: 'Help someone in their Discord thread, just as you do today.',
      visual: 'answer',
    },
    {
      heading: 'Save the answer.',
      body: 'Right-click the reply, open Apps, and choose Save this answer. You decide what becomes knowledge.',
      visual: 'save',
    },
    {
      heading: 'Help the next person.',
      body: 'When a new question matches, ThreadSherpa writes a short reply from those facts and links back to the source.',
      visual: 'reply',
    },
  ],
  link: { label: 'Try that flow in Campfire', href: '/#playground' },
} as const;

export const difference = {
  heading: 'Keep the conversation. Lose the repeat work.',
  items: [
    {
      id: 'reply',
      heading: 'A reply for the person asking.',
      body: 'New wording gets a fresh response from saved facts. The original answer stays one click away.',
      equivalent:
        'Two differently worded questions receive two short replies, each linked to the same saved answer.',
    },
    {
      id: 'quiet',
      heading: "Quiet when it doesn't know.",
      body: 'Unsupported questions wait for a moderator. No public filler message to scroll past.',
      equivalent:
        'A member question stays unanswered in the thread while the moderator queue gains one item.',
    },
    {
      id: 'follow',
      heading: 'Help that follows the thread.',
      body: 'Follow-up questions keep their context. A clear “that worked” can close the case without another bot message.',
      equivalent:
        'A follow-up gets one reply, then the member confirms it worked and the case is marked resolved.',
    },
    {
      id: 'corrections',
      heading: 'Corrections that carry forward.',
      body: 'Edit saved knowledge when guidance changes. Future questions use the update, while earlier conversations stay as they were.',
      equivalent:
        'Saved guidance moves to version 2 and a later question uses the corrected fact. The earlier reply is unchanged.',
    },
  ],
  panelLabel: 'Example conversation',
} as const;

export interface Capture {
  id: string;
  tab: string;
  caption: string;
  alt: string;
  src960: string;
  src1600: string;
  original: string;
  width: number;
  height: number;
  annotation?: {
    label: string;
    description: string;
    x: number;
    y: number;
  };
}

export const captures: Capture[] = [
  {
    id: 'human-answer',
    tab: 'The human answer',
    caption: 'A moderator answers the original question.',
    alt: 'A Discord forum post asks whether a project can be updated after submitting. The moderator answer is behind an open message menu with the Apps action visible.',
    src960: '/evidence/960/human-answer.webp',
    src1600: '/evidence/1600/human-answer.webp',
    original: '/evidence/original/human-answer.png',
    width: 1600,
    height: 1011,
  },
  {
    id: 'answer-saved',
    tab: 'Saved once',
    caption: 'The native action confirms the answer was saved.',
    alt: 'ThreadSherpa posts Saved. below the moderator answer after the native Save this answer action.',
    src960: '/evidence/960/answer-saved.webp',
    src1600: '/evidence/1600/answer-saved.webp',
    original: '/evidence/original/answer-saved.png',
    width: 1600,
    height: 1198,
    annotation: {
      label: 'Saved answer',
      description: 'The native confirmation that the answer is now saved.',
      x: 8.8,
      y: 79.7,
    },
  },
  {
    id: 'tailored-reply',
    tab: 'The next question',
    caption: 'ThreadSherpa responds to different wording using saved guidance.',
    alt: 'A reworded question receives a short ThreadSherpa answer with an Original answer link and Solved and Need help buttons.',
    src960: '/evidence/960/tailored-reply.webp',
    src1600: '/evidence/1600/tailored-reply.webp',
    original: '/evidence/original/tailored-reply.png',
    width: 1600,
    height: 1011,
    annotation: {
      label: 'Source link',
      description: 'The Original answer link that returns to the human reply.',
      x: 15.8,
      y: 86.1,
    },
  },
  {
    id: 'follow-up',
    tab: 'The follow-up',
    caption: 'The conversation continues with the original context.',
    alt: 'A member asks whether to explain the fix. ThreadSherpa replies in the same thread and links to the original answer.',
    src960: '/evidence/960/follow-up.webp',
    src1600: '/evidence/1600/follow-up.webp',
    original: '/evidence/original/follow-up.png',
    width: 1600,
    height: 1591,
  },
  {
    id: 'conversation-confirmed',
    tab: 'A confirmed solve',
    caption: 'The member says it worked. The case was recorded as resolved.',
    alt: 'The member writes That worked, thanks! after two ThreadSherpa answers in the same thread.',
    src960: '/evidence/960/conversation-confirmed.webp',
    src1600: '/evidence/1600/conversation-confirmed.webp',
    original: '/evidence/original/conversation-confirmed.png',
    width: 1600,
    height: 1591,
    annotation: {
      label: 'Member confirmation',
      description: "The member's message that closes the case.",
      x: 23,
      y: 93.4,
    },
  },
];

export const evidenceCopy = {
  heading: 'Here it is in Discord.',
  body:
    'These captures show the working bot saving an answer, helping with a new question, and following the conversation. Campfire is a fictional scenario posted for this walkthrough.',
  note: 'Captured in Discord on October 23, 2026. Message content was not edited.',
  annotations: [
    { label: 'Saved answer', capture: 'answer-saved' },
    { label: 'Source link', capture: 'tailored-reply' },
    { label: 'Member confirmation', capture: 'conversation-confirmed' },
  ],
} as const;

export const setup = {
  heading: 'Start with one support channel.',
  body:
    'Run ThreadSherpa yourself, connect your Discord bot and database, then choose where it can help. Use a local model with Ollama or configure Paper Instruments for replies.',
  steps: [
    {
      heading: 'Connect your bot.',
      body: 'Create a Discord application and add its bot token to your local environment.',
    },
    {
      heading: 'Choose storage and a model.',
      body: 'Connect MongoDB, then choose Ollama or Paper Instruments. The setup guide includes the links and required values.',
    },
    {
      heading: 'Pick a channel. Save an answer.',
      body: 'Run setup from a text channel, select your support forum, and save the first useful moderator reply.',
    },
  ],
  commands: 'npm ci\nnpm run setup\nnpm run dev',
  commandNote: 'Run these from a local project checkout after configuration.',
  costNote: 'The code is free. Hosting, model providers, and local hardware can have costs.',
  privacyNote:
    'Local inference is available. Hosted model providers receive the questions and evidence used for replies.',
  primary: { label: 'Open the setup guide', href: '/setup/' },
  secondary: { label: 'Read the security boundaries', href: '/security/' },
} as const;

export const faq = [
  {
    question: 'Does it learn from every message?',
    answer:
      'No. A moderator explicitly saves an answer, or adds knowledge with /teach. Ordinary chat does not automatically become approved knowledge.',
  },
  {
    question: "What happens when it can't answer?",
    answer:
      'In automatic support channels, the question waits quietly in the moderator queue. A member can also choose Need help on a reply. That marks the case for review; it does not page a staffed help desk.',
  },
  {
    question: 'Does it work in forum channels?',
    answer:
      'Yes. Run /setup from a regular text channel and select the support forum. ThreadSherpa can then help in its posts.',
  },
  {
    question: 'Can moderators update or remove knowledge?',
    answer:
      'Yes. Use /answers to edit or remove saved knowledge. New questions use the current facts. Earlier posted replies stay in place.',
  },
  {
    question: 'Is this a hosted bot?',
    answer:
      'ThreadSherpa is currently self-hosted. The setup guide walks through the Discord token, database, model, and channel configuration.',
  },
  {
    question: 'Will it always get the answer right?',
    answer:
      'No. Replies use saved knowledge and selected sources, but generated answers can still be wrong. Members can inspect the source and ask for human help.',
  },
  {
    question: 'Is the Campfire server connected to Discord?',
    answer:
      "No. Campfire is an isolated website sandbox. It does not join your server, post to Discord, or change the real bot's knowledge.",
  },
] as const;

export const closing = {
  heading: 'Keep the next answer from starting at zero.',
  body: 'Give one good reply somewhere to stay.',
  primary: { label: 'Set up ThreadSherpa', href: '/setup/' },
  secondary: { label: 'Try a support thread', href: '/#playground' },
} as const;

export const footer = {
  line: 'ThreadSherpa. Answer once. Help the next person.',
  links: [
    { label: 'Setup guide', href: '/setup/' },
    { label: 'Security', href: '/security/' },
    { label: 'Apache-2.0 license', href: '/LICENSE.txt' },
  ],
  independence:
    'Independent open-source project. Not affiliated with or endorsed by Discord, MLH, or DEV.',
  build: 'Built with AI assistance. Reviewed by the project author.',
} as const;
