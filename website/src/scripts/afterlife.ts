import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const paused = () => reduced.matches || document.documentElement.classList.contains('motion-paused');
const lifecycle = new AbortController();
const { signal } = lifecycle;
let motion: gsap.Context | undefined;
// Content never changes on a timer. Scroll gives the still composition a little
// depth; all of the explanation is present before any animation runs.
function configureMotion() {
    motion?.revert();
    motion = gsap.context(() => {
        if (paused())
            return;
        gsap.to('[data-hero-line]', { y: -24, ease: 'none', scrollTrigger: { trigger: '.intro', start: 'top top', end: 'bottom top', scrub: 1 } });
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
saveButton.addEventListener('click', () => {
    saved = !saved;
    saveButton.setAttribute('aria-pressed', String(saved));
    saveIllustration.classList.toggle('is-saved', saved);
    document.querySelector('[data-save-label]')!.textContent = saved ? 'Saved to memory' : 'Save this answer';
    document.querySelector('[data-save-status]')!.textContent = saved ? 'Approved' : 'Original reply';
    noteTween?.kill();
    if (saved && !paused())
        noteTween = gsap.fromTo('.save-note', { y: 0, x: -45, rotate: -8, autoAlpha: 1 }, { y: 105, x: 0, rotate: 12, autoAlpha: 0, duration: .8, ease: 'power2.inOut' });
}, { signal });
document.querySelector('[data-show-source]')?.addEventListener('click', () => {
    if (paused())
        return;
    gsap.fromTo('.moderator-reply', { scale: .98 }, { scale: 1, duration: .5, ease: 'power2.out', delay: .25, clearProps: 'transform' });
}, { signal });
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
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { resizeField(); ScrollTrigger.refresh(); }, 150); }, { signal });
resizeField();
configureMotion();
void document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('pagehide', () => { lifecycle.abort(); motion?.revert(); visibleObserver.disconnect(); fieldObserver.disconnect(); cancelAnimationFrame(frame); noteTween?.kill(); clearTimeout(resizeTimer); }, { once: true });
