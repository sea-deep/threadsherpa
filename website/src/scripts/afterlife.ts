import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const paused = () => reduced.matches || document.documentElement.classList.contains('motion-paused');
const lifecycle = new AbortController();
const { signal } = lifecycle;
let motion: gsap.Context | undefined;
const repeatMap = document.querySelector<HTMLElement>('[data-repeat-map]')!;
const matchAnswer = document.querySelector<HTMLElement>('[data-match-answer]')!;
function positionConnections() {
    const map = repeatMap.getBoundingClientRect();
    const answer = matchAnswer.getBoundingClientRect();
    const question = document.querySelector('[data-match-question]')!.getBoundingClientRect();
    const reply = document.querySelector('[data-match-reply]')!.getBoundingClientRect();
    const forum = document.querySelector('.forum-thread')!.getBoundingClientRect();
    let questionPath: string, replyPath: string;
    if (innerWidth <= 650) {
        const x = answer.left - map.left + 28;
        questionPath = `M ${x} ${answer.bottom - map.top + 9} L ${x} ${forum.top - map.top - 8}`;
        replyPath = '';
    } else {
        const left = answer.right - map.left + 8;
        const right = forum.left - map.left - 8;
        const mid = (left + right) / 2;
        const q = question.top - map.top + question.height * .5;
        const a = answer.top - map.top + answer.height * .35;
        const b = answer.top - map.top + answer.height * .8;
        const r = reply.top - map.top + reply.height * .5;
        questionPath = `M ${right} ${q} C ${mid} ${q}, ${mid} ${a}, ${left} ${a}`;
        replyPath = `M ${left} ${b} C ${mid} ${b}, ${mid} ${r}, ${right} ${r}`;
    }
    repeatMap.querySelectorAll('[data-connection="question"]').forEach(path => path.setAttribute('d', questionPath));
    repeatMap.querySelectorAll('[data-connection="reply"]').forEach(path => path.setAttribute('d', replyPath));
}
// Content never changes on a timer. Scroll gives the still composition a little
// depth; all of the explanation is present before any animation runs.
function configureMotion() {
    motion?.revert();
    motion = gsap.context(() => {
        if (paused())
            return;
        gsap.to('[data-hero-line]', { y: -24, ease: 'none', scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: 1 } });
        const matchTrace = gsap.timeline({ scrollTrigger: { trigger: repeatMap, start: 'top 85%', end: 'bottom 45%', scrub: .7 } });
        matchTrace.fromTo('.connection-current[data-connection="question"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 1, ease: 'none' })
            .fromTo('.connection-current[data-connection="reply"]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 1, ease: 'none' });
        gsap.fromTo('.repeat-guide', { y: 18 }, { y: -12, ease: 'none', scrollTrigger: { trigger: '.support-repeat', start: 'top bottom', end: 'bottom top', scrub: 1 } });
        gsap.fromTo('.quiet-companion', { y: 12, rotate: 3 }, { y: -8, rotate: -3, ease: 'none', scrollTrigger: { trigger: '.support-quiet', start: 'top bottom', end: 'bottom top', scrub: 1 } });
        for (const item of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
            gsap.from(item, { y: 18, opacity: .45, duration: .6, ease: 'power3.out', scrollTrigger: { trigger: item, start: 'top 94%', once: true } });
        }
    });
    syncField();
}
const visibleObserver = new IntersectionObserver(entries => {
    for (const entry of entries)
        entry.target.classList.toggle('in-view', entry.isIntersecting && !document.hidden);
});
const animated = [...document.querySelectorAll<HTMLElement>('[data-guide],.support-repeat,.support-inside')];
animated.forEach(el => visibleObserver.observe(el));
const saveButton = document.querySelector<HTMLButtonElement>('[data-save-answer]')!;
const saveIllustration = document.querySelector<HTMLElement>('[data-save-illustration]')!;
let saved = false;
let noteTween: gsap.core.Tween | undefined;
document.querySelector('#saved-reply .discord-message')?.addEventListener('contextmenu', event => {
    event.preventDefault();
    saveButton.focus({ preventScroll: true });
}, { signal });
saveButton.addEventListener('click', () => {
    saved = !saved;
    saveButton.setAttribute('aria-pressed', String(saved));
    saveIllustration.classList.toggle('is-saved', saved);
    document.querySelector('[data-save-label]')!.textContent = saved ? 'Answer saved' : 'Save this answer';
    document.querySelector('[data-save-status]')!.textContent = saved ? 'Answer saved.' : '';
    noteTween?.kill();
    if (saved && !paused())
        noteTween = gsap.fromTo('.save-note', { y: 0, x: -45, rotate: -8, autoAlpha: 1 }, { y: 105, x: 0, rotate: 12, autoAlpha: 0, duration: .8, ease: 'power2.inOut' });
}, { signal });
document.querySelector('[data-show-source]')?.addEventListener('click', () => {
    if (paused())
        return;
    gsap.fromTo('.moderator-reply', { scale: .98 }, { scale: 1, duration: .5, ease: 'power2.out', delay: .25, clearProps: 'transform' });
}, { signal });
const exampleSolve = document.querySelector<HTMLButtonElement>('[data-example-solve]')!;
const exampleHelp = document.querySelector<HTMLButtonElement>('[data-example-help]')!;
function finishExample(action: 'solve' | 'help') {
    exampleSolve.disabled = true;
    exampleHelp.disabled = true;
    if (action === 'solve') exampleSolve.textContent = 'Marked solved';
    else exampleHelp.textContent = 'Queued';
    document.querySelector('[data-example-status]')!.textContent = action === 'solve'
        ? 'Question marked as solved.' : 'Question queued for a moderator.';
}
exampleSolve.addEventListener('click', () => finishExample('solve'), { signal });
exampleHelp.addEventListener('click', () => finishExample('help'), { signal });
// The saved note responds to the pointer, while the question and reply stay still.
// The connection endpoints belong to the untransformed layout, so their routes
// remain attached when the note tilts.
const noteTilt = gsap.quickTo(matchAnswer, 'rotationY', { duration: .45, ease: 'power2.out' });
const noteLean = gsap.quickTo(matchAnswer, 'rotationX', { duration: .45, ease: 'power2.out' });
matchAnswer.addEventListener('pointermove', e => {
    if (paused() || !matchMedia('(pointer:fine)').matches) return;
    const r = matchAnswer.getBoundingClientRect();
    noteTilt((e.clientX - r.left) / r.width * 8 - 4);
    noteLean(4 - (e.clientY - r.top) / r.height * 8);
}, { signal, passive: true });
function resetNote() {
    if (paused()) {
        noteTilt.tween.pause(); noteLean.tween.pause();
        gsap.set(matchAnswer, { rotationX: 0, rotationY: 0 });
    } else { noteTilt(0); noteLean(0); }
}
matchAnswer.addEventListener('pointerleave', resetNote, { signal });
window.addEventListener('ts:motion', resetNote, { signal });
// Keep the existing quiet current in the hero. It draws only while visible.
const canvas = document.querySelector<HTMLCanvasElement>('[data-thread-field]')!;
const context = canvas.getContext('2d');
let width = 0, height = 0, frame = 0, lastDraw = 0, fieldVisible = false, pointerX = 0, pointerY = 0;
function resizeField() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawField(time: number) {
    frame = 0;
    if (!context || paused() || !fieldVisible || document.hidden)
        return;
    frame = requestAnimationFrame(drawField);
    if (time - lastDraw < 32)
        return;
    lastDraw = time;
    context.clearRect(0, 0, width, height);
    context.font = '11px monospace';
    const t = time * .00016, columns = innerWidth < 600 ? 43 : 75;
    for (let row = 0; row < 13; row++)
        for (let col = 0; col < columns; col++) {
            const u = col / (columns - 1), wave = Math.sin(u * 8 + t + row * .19);
            context.fillStyle = row % 4 === 0 ? 'rgba(215,245,156,.36)' : 'rgba(184,169,206,.26)';
            context.fillText((col + row) % 7 === 0 ? '+' : (col + row) % 3 === 0 ? ':' : '·', u * width + pointerX * row * .28, height * .43 + row * 12 + wave * (21 + row * 2.8) + pointerY * 7);
        }
}
function syncField() { if (frame)
    cancelAnimationFrame(frame); frame = 0; if (!paused() && fieldVisible && !document.hidden)
    frame = requestAnimationFrame(drawField); }
const fieldObserver = new IntersectionObserver(([entry]) => { fieldVisible = entry.isIntersecting; syncField(); });
fieldObserver.observe(canvas);
document.querySelector('.intro')?.addEventListener('pointermove', ((e: PointerEvent) => { if (paused() || !matchMedia('(pointer:fine)').matches)
    return; pointerX = e.clientX / innerWidth - .5; pointerY = e.clientY / innerHeight - .5; }) as EventListener, { signal, passive: true });
document.addEventListener('visibilitychange', () => {
    syncField();
    animated.forEach(el => { const r = el.getBoundingClientRect(); el.classList.toggle('in-view', !document.hidden && r.bottom > 0 && r.top < innerHeight); });
}, { signal });
window.addEventListener('ts:motion', configureMotion, { signal });
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { resizeField(); positionConnections(); ScrollTrigger.refresh(); }, 150); }, { signal });
resizeField();
positionConnections();
configureMotion();
void document.fonts.ready.then(() => { positionConnections(); ScrollTrigger.refresh(); });
window.addEventListener('pagehide', () => { lifecycle.abort(); motion?.revert(); visibleObserver.disconnect(); fieldObserver.disconnect(); cancelAnimationFrame(frame); noteTween?.kill(); noteTilt.tween.kill(); noteLean.tween.kill(); clearTimeout(resizeTimer); }, { once: true });
