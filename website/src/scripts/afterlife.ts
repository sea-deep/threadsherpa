import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const paused = () =>
  reduced.matches ||
  document.documentElement.classList.contains("motion-paused");
const lifecycle = new AbortController();
const { signal } = lifecycle;
const story = document.querySelector<HTMLElement>("[data-walkthrough]")!;
const stage = document.querySelector<HTMLElement>("[data-discord-stage]")!;
const chapters = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-seek-step]"),
];
const scenes = [...document.querySelectorAll<HTMLElement>("[data-chat-scene]")];
const captions = [...document.querySelectorAll<HTMLElement>("[data-caption]")];
const peek = document.querySelector<HTMLElement>("[data-source-peek]")!;
const sourceButton =
  document.querySelector<HTMLButtonElement>("[data-peek-source]")!;
let storyTrigger: ScrollTrigger | undefined;
let motionContext: gsap.Context | undefined;
let step = -1;
let solved = false;

// Register only the two message components this page uses. The conversation
// remains readable as ordinary HTML if the component chunk cannot load.
async function loadMessages() {
  try {
    await Promise.all([
      import("@skyra/discord-components-core/discord-messages.js"),
      import("@skyra/discord-components-core/discord-message.js"),
    ]);
    await customElements.whenDefined("discord-message");
    for (const message of document.querySelectorAll<HTMLElement>(
      "discord-message",
    )) {
      await (message as HTMLElement & { updateComplete: Promise<boolean> })
        .updateComplete;
      const root = message.shadowRoot;
      if (!root) continue;
      const theme = document.createElement("style");
      theme.textContent = `
        :host{font-family:var(--font-body);color:#d2cbdc;padding:0;line-height:1.6}
        .discord-message-content{min-width:0;padding-top:0;line-height:1.6}
        :host .discord-message-body,:host .discord-message-markup{font:inherit;line-height:1.6}
        .discord-author-avatar{margin-right:12px;min-width:32px;margin-top:3px}
        .discord-author-avatar img{width:32px;height:32px;cursor:default}
        .discord-message-timestamp{font-size:10px;color:#95899f;margin-left:8px}
        :host(:hover){background:transparent}
        @media(max-width:600px){.discord-author-avatar{min-width:27px;margin-right:9px}
          .discord-author-avatar img{width:27px;height:27px}}
      `;
      // Lit's adopted styles have priority over ordinary <style> nodes.
      // Append our sheet after the library sheets so the compact UI sizes win.
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(theme.textContent);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
    // Message height changes when the custom elements upgrade.
    ScrollTrigger.refresh();
  } catch {
    stage.dataset.components = "fallback";
  }
}
const messageObserver = new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      messageObserver.disconnect();
      void loadMessages();
    }
  },
  { rootMargin: "700px" },
);
messageObserver.observe(story);

function closeSource(restoreFocus = false) {
  peek.hidden = true;
  sourceButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) sourceButton.focus({ preventScroll: true });
}

function setStep(next: number, enhanced = true) {
  if (step === next && enhanced) return;
  step = next;
  story.dataset.step = String(next);
  chapters.forEach((button, index) => {
    if (index === next) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  captions.forEach((caption, index) =>
    caption.setAttribute(
      "aria-hidden",
      String(enhanced ? index !== next : index !== 0),
    ),
  );
  const activeScene = next < 2 ? "source" : next < 4 ? "next" : "unknown";
  scenes.forEach((scene) => {
    const hidden = enhanced && scene.dataset.chatScene !== activeScene;
    scene.setAttribute("aria-hidden", String(hidden));
    scene.inert = hidden;
  });
  document
    .querySelector<HTMLElement>("[data-human-answer]")!
    .setAttribute("aria-hidden", String(enhanced && next === 0));
  document.querySelectorAll<HTMLElement>("[data-follow-up]").forEach((el) => {
    el.hidden = enhanced && next !== 3;
  });
  const menu = document.querySelector<HTMLElement>("[data-save-popover]")!;
  menu.inert = enhanced ? next !== 1 : true;
  menu.setAttribute("aria-hidden", String(menu.inert));
  document.querySelector("[data-memory-count]")!.textContent =
    next > 0 || !enhanced ? "1" : "0";
  document.querySelector("[data-story-topic]")!.textContent =
    next === 4
      ? "Can I submit late?"
      : next >= 2
        ? "Do I need a new link?"
        : "Can I update my project?";
  document.querySelector("[data-thread-status]")!.textContent =
    next === 4 ? "Waiting" : next >= 2 && solved ? "Resolved" : "Open";
  document.querySelector("[data-story-note]")!.textContent =
    next === 4
      ? "No matching facts. No public filler message."
      : next === 3
        ? "The next message belongs to the same conversation."
        : "The useful bit is the answer, not another dashboard.";
  closeSource();
  const nextScene = document.querySelector<HTMLElement>(".chat-scene--next")!;
  requestAnimationFrame(() =>
    nextScene.scrollTo({
      top: next === 3 ? nextScene.scrollHeight : 0,
      behavior: paused() ? "instant" : "smooth",
    }),
  );
}

function configureMotion() {
  motionContext?.revert();
  storyTrigger = undefined;
  story.classList.remove("is-enhanced");
  step = -1;
  const enhanced = !paused() && innerHeight >= (innerWidth <= 600 ? 820 : 740);
  story.classList.toggle("is-enhanced", enhanced);
  setStep(0, enhanced);
  motionContext = gsap.context(() => {
    if (enhanced) {
      storyTrigger = ScrollTrigger.create({
        trigger: story,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          setStep(Math.min(4, Math.floor(self.progress * 5)));
          gsap.set("[data-story-progress]", { scaleX: self.progress });
        },
        onRefresh: (self) => {
          setStep(Math.min(4, Math.floor(self.progress * 5)));
        },
      });
      gsap.fromTo(
        stage,
        { rotateX: 3, y: 14 },
        {
          rotateX: 0,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: story,
            start: "top bottom",
            end: "top top",
            scrub: 0.5,
          },
        },
      );
    }
    if (!paused()) {
      document
        .querySelectorAll<HTMLElement>("[data-architecture-step]")
        .forEach((item, index) => {
          ScrollTrigger.create({
            trigger: item,
            start: "top 55%",
            end: "bottom 55%",
            onEnter: () => selectNode(index),
            onEnterBack: () => selectNode(index),
          });
        });
      gsap.fromTo(
        "[data-wire-current]",
        { "--wire-progress": 0 },
        {
          "--wire-progress": 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".architecture-steps",
            start: "top 65%",
            end: "bottom 65%",
            scrub: 0.5,
          },
        },
      );
      gsap.to("[data-hero-line]", {
        y: -28,
        ease: "none",
        scrollTrigger: {
          trigger: ".intro",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      document
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((item) => {
          gsap.from(item, {
            y: 24,
            opacity: 0.25,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: item, start: "top 94%", once: true },
          });
        });
    }
  });
  measureWires();
  ScrollTrigger.refresh();
  syncField();
}

chapters.forEach((button, index) =>
  button.addEventListener(
    "click",
    () => {
      if (storyTrigger) {
        window.scrollTo({
          top:
            storyTrigger.start +
            (storyTrigger.end - storyTrigger.start) *
              [0.08, 0.28, 0.48, 0.68, 0.9][index],
          behavior: paused() ? "instant" : "smooth",
        });
      } else {
        const scene =
          index === 4 ? scenes[2] : index >= 2 ? scenes[1] : scenes[0];
        scene.scrollIntoView({
          block: "center",
          behavior: paused() ? "instant" : "smooth",
        });
      }
    },
    { signal },
  ),
);

sourceButton.setAttribute("aria-expanded", "false");
sourceButton.addEventListener(
  "click",
  () => {
    peek.hidden = !peek.hidden;
    sourceButton.setAttribute("aria-expanded", String(!peek.hidden));
    if (!peek.hidden)
      peek
        .querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
  },
  { signal },
);
document
  .querySelector("[data-close-source]")
  ?.addEventListener("click", () => closeSource(true), { signal });
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !peek.hidden) closeSource(true);
  },
  { signal },
);
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      !peek.hidden &&
      !peek.contains(event.target as Node) &&
      !sourceButton.contains(event.target as Node)
    )
      closeSource();
  },
  { signal },
);
document.querySelector("[data-mark-solved]")?.addEventListener(
  "click",
  (event) => {
    solved = !solved;
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.toggle("is-solved", solved);
    button.setAttribute("aria-pressed", String(solved));
    document.querySelector("[data-solve-label]")!.textContent = solved
      ? "Resolved"
      : "Solved";
    document.querySelector("[data-thread-status]")!.textContent = solved
      ? "Resolved"
      : "Open";
  },
  { signal },
);

// Small character currents, drawn at 30fps only while visible. This leaves
// native scroll and the rest of the page's transforms under their own control.
const canvas = document.querySelector<HTMLCanvasElement>(
  "[data-thread-field]",
)!;
const context = canvas.getContext("2d");
let fieldWidth = 0;
let fieldHeight = 0;
let frame = 0;
let fieldVisible = true;
let lastDraw = 0;
let pointerX = 0;
let pointerY = 0;
function resizeField() {
  const bounds = canvas.getBoundingClientRect();
  fieldWidth = bounds.width;
  fieldHeight = bounds.height;
  const dpr = Math.min(devicePixelRatio, 1.5);
  canvas.width = Math.round(fieldWidth * dpr);
  canvas.height = Math.round(fieldHeight * dpr);
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawField(time: number) {
  frame = 0;
  if (!context || paused() || !fieldVisible || document.hidden) return;
  frame = requestAnimationFrame(drawField);
  if (time - lastDraw < 32) return;
  lastDraw = time;
  context.clearRect(0, 0, fieldWidth, fieldHeight);
  context.font = "11px monospace";
  const t = time * 0.00016;
  const columns = innerWidth < 600 ? 43 : 75;
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < columns; col++) {
      const u = col / (columns - 1);
      const wave = Math.sin(u * 8 + t + row * 0.19);
      const x = u * fieldWidth + pointerX * row * 0.28;
      const y =
        fieldHeight * 0.43 + row * 12 + wave * (21 + row * 2.8) + pointerY * 7;
      context.fillStyle =
        row % 4 === 0 ? "rgba(215,245,156,.36)" : "rgba(184,169,206,.26)";
      context.fillText(
        (col + row) % 7 === 0 ? "+" : (col + row) % 3 === 0 ? ":" : "·",
        x,
        y,
      );
    }
  }
}
function syncField() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (!paused() && fieldVisible && !document.hidden)
    frame = requestAnimationFrame(drawField);
}
const fieldObserver = new IntersectionObserver(([entry]) => {
  fieldVisible = entry.isIntersecting;
  syncField();
});
fieldObserver.observe(canvas);
document.querySelector(".intro")?.addEventListener(
  "pointermove",
  ((event: PointerEvent) => {
    if (!finePointer.matches || paused()) return;
    pointerX = event.clientX / innerWidth - 0.5;
    pointerY = event.clientY / innerHeight - 0.5;
  }) as EventListener,
  { signal, passive: true },
);
document.addEventListener("visibilitychange", syncField, { signal });

// The diagram follows the implementation. Nodes can also be inspected directly,
// without requiring a precise scroll position or a pointer.
interface ArchitectureStep {
  text: string;
  file: string;
}
const architectureSteps: ArchitectureStep[] = JSON.parse(
  document.querySelector("[data-architecture-data]")!.textContent!,
);
const nodeButtons = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-machine-node]"),
];
const architecture = document.querySelector<HTMLElement>(
  "[data-architecture]",
)!;
let selectedNode = 0;
let quietRoute = false;
function selectNode(index: number) {
  selectedNode = index;
  architecture.dataset.active = String(index);
  nodeButtons.forEach((button, i) =>
    button.setAttribute("aria-pressed", String(i === index)),
  );
  document.querySelector("[data-route-count]")!.textContent =
    `0${index + 1} / 04`;
  document.querySelector("[data-node-detail]")!.textContent =
    quietRoute && index === 2
      ? "No usable evidence was found. Skip the reply-generation call instead of asking the model to guess."
      : architectureSteps[index].text;
  document.querySelector("[data-node-file]")!.textContent =
    architectureSteps[index].file;
  document.querySelector<HTMLAnchorElement>("[data-node-source]")!.href =
    "https://github.com/sea-deep/threadsherpa/blob/main/" +
    architectureSteps[index].file;
}
nodeButtons.forEach((button, index) =>
  button.addEventListener("click", () => selectNode(index), { signal }),
);
document.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((button) =>
  button.addEventListener(
    "click",
    () => {
      quietRoute = button.dataset.route === "quiet";
      architecture.dataset.route = quietRoute ? "quiet" : "answer";
      document
        .querySelectorAll<HTMLButtonElement>("[data-route]")
        .forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button)),
        );
      document.querySelector("[data-route-outcome]")!.textContent = quietRoute
        ? "No usable evidence → skip generation → quiet moderator queue."
        : "Reply in Discord, with the original source.";
      selectNode(selectedNode);
    },
    { signal },
  ),
);
function measureWires() {
  const route = document.querySelector<HTMLElement>("[data-machine-route]")!;
  const svg = document.querySelector<SVGSVGElement>("[data-machine-wires]")!;
  const rect = route.getBoundingClientRect();
  const ports = [...route.querySelectorAll<HTMLElement>(".machine-port")].map(
    (port) => {
      const r = port.getBoundingClientRect();
      return {
        x: r.left - rect.left + r.width / 2,
        y: r.top - rect.top + r.height / 2,
      };
    },
  );
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  const d = ports
    .map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  document
    .querySelectorAll<SVGPathElement>("[data-wire-base],[data-wire-current]")
    .forEach((path) => path.setAttribute("d", d));
}
document.querySelector("[data-story-save]")?.addEventListener(
  "click",
  () => {
    const button =
      document.querySelector<HTMLButtonElement>("[data-story-save]")!;
    button.classList.add("is-saved");
    button.setAttribute("aria-label", "Answer saved. Show the next question.");
    if (storyTrigger)
      window.scrollTo({
        top:
          storyTrigger.start + (storyTrigger.end - storyTrigger.start) * 0.48,
        behavior: paused() ? "instant" : "smooth",
      });
  },
  { signal },
);
document
  .querySelectorAll<HTMLDetailsElement>(".limits-list details")
  .forEach((detail) =>
    detail.addEventListener(
      "toggle",
      () => {
        if (detail.open && !paused())
          gsap.fromTo(
            detail.querySelector("p"),
            { opacity: 0.3, y: 5 },
            {
              opacity: 1,
              y: 0,
              duration: 0.25,
              clearProps: "transform,opacity",
            },
          );
      },
      { signal },
    ),
  );
selectNode(0);

let resizeTimer = 0;
window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeField();
      configureMotion();
    }, 180);
  },
  { signal },
);
window.addEventListener("ts:motion", configureMotion, { signal });
resizeField();
configureMotion();
if (!paused())
  gsap.from("[data-hero-line], [data-hero-copy]", {
    opacity: 0.3,
    duration: 0.85,
    stagger: 0.09,
    ease: "power3.out",
    clearProps: "opacity",
  });
void document.fonts.ready.then(() => {
  measureWires();
  ScrollTrigger.refresh();
});
window.addEventListener(
  "pagehide",
  () => {
    lifecycle.abort();
    clearTimeout(resizeTimer);
    cancelAnimationFrame(frame);
    fieldObserver.disconnect();
    messageObserver.disconnect();
    motionContext?.revert();
  },
  { once: true },
);
