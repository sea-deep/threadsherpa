/* Scroll changes the illustration, never the real sandbox or its knowledge. */
const story = document.querySelector<HTMLElement>("[data-walkthrough]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const progress = document.querySelector<HTMLElement>("[data-story-progress]");
let pending = false;
let previousStep = -1;
let paused = document.documentElement.classList.contains("motion-paused");

function updateStory() {
  pending = false;
  if (!story) return;
  const staticMode = reduced.matches || paused || window.innerHeight < 720;
  story.classList.toggle("is-enhanced", !staticMode);
  const rect = story.getBoundingClientRect();
  const fraction = Math.max(
    0,
    Math.min(
      1,
      -rect.top / Math.max(1, story.offsetHeight - window.innerHeight),
    ),
  );
  const step = staticMode ? 2 : Math.min(2, Math.floor(fraction * 3));
  story.dataset.step = String(step);
  if (progress) progress.style.transform = `scaleX(${fraction})`;
  if (step === previousStep) return;
  previousStep = step;
  const count = story.querySelector<HTMLElement>("[data-step-number]");
  const memory = story.querySelector<HTMLElement>("[data-memory-count]");
  const topic = story.querySelector<HTMLElement>("[data-story-topic]");
  if (count) count.textContent = String(step + 1);
  if (memory) memory.textContent = step > 0 ? "1" : "0";
  if (topic)
    topic.textContent =
      step === 2
        ? "Do I need to submit a new link?"
        : "Can I update my project?";
  story.querySelectorAll<HTMLElement>("[data-caption]").forEach((caption) => {
    caption.setAttribute(
      "aria-hidden",
      String(Number(caption.dataset.caption) !== (staticMode ? 0 : step)),
    );
  });
  story
    .querySelector(".story-scene--original")
    ?.setAttribute("aria-hidden", String(!staticMode && step === 2));
  story
    .querySelector(".story-scene--next")
    ?.setAttribute("aria-hidden", String(!staticMode && step !== 2));
}
function scheduleStory() {
  if (!pending) {
    pending = true;
    requestAnimationFrame(updateStory);
  }
}
window.addEventListener("scroll", scheduleStory, { passive: true });
window.addEventListener("resize", scheduleStory);
reduced.addEventListener("change", scheduleStory);
window.addEventListener("ts:motion", ((
  event: CustomEvent<{ paused: boolean }>,
) => {
  paused = event.detail.paused;
  previousStep = -1;
  scheduleStory();
}) as EventListener);
updateStory();

/* A small projected ribbon of characters. No WebGL, assets, or input required. */
const canvas = document.querySelector<HTMLCanvasElement>("[data-thread-field]");
if (canvas) {
  const ctx = canvas.getContext("2d");
  let visible = true;
  let frame = 0;
  let time = 0;
  let width = 1;
  let height = 1;
  let last = 0;
  const glyphs = ["·", ":", "+", "·", "·"];
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const draw = (now: number) => {
    frame = 0;
    if (!ctx || !visible || reduced.matches || paused || document.hidden)
      return;
    if (now - last >= 40) {
      last = now;
      time += 0.007;
      ctx.clearRect(0, 0, width, height);
      ctx.font = "11px monospace";
      for (let line = 0; line < 9; line++) {
        for (let i = 0; i < 100; i++) {
          const t = i / 99;
          const angle = t * Math.PI * 2.4 + time + line * 0.065;
          const z = Math.sin(angle);
          const x = width * (0.08 + t * 0.91);
          const y =
            height * 0.53 +
            Math.cos(angle) * height * (0.14 + 0.15 * Math.sin(t * Math.PI)) +
            (line - 4) * 4.5;
          ctx.fillStyle = `rgba(113, 124, 98, ${0.12 + (z + 1) * 0.13})`;
          ctx.fillText(glyphs[(i + line) % glyphs.length], x, y);
        }
      }
    }
    frame = requestAnimationFrame(draw);
  };
  const resume = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  new ResizeObserver(() => {
    resize();
    resume();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    resume();
  }).observe(canvas);
  document.addEventListener("visibilitychange", resume);
  reduced.addEventListener("change", resume);
  window.addEventListener("ts:motion", resume);
  resize();
  resume();
}
