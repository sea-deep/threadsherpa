import { gsap } from 'gsap';
interface Phase {
    name: string;
    title: string;
    text: string;
    tech: string;
    file: string;
}
const root = document.querySelector<HTMLElement>('[data-mechanism]')!;
const theatre = root.querySelector<HTMLElement>('[data-mechanism-theatre]')!;
const phases: Phase[] = JSON.parse(document.querySelector('[data-mechanism-data]')!.textContent!);
const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-mechanism-step]')];
const objects = new Map([...theatre.querySelectorAll<HTMLElement>('[data-object]')].map(el => [el.dataset.object!, el]));
const play = root.querySelector<HTMLButtonElement>('[data-mechanism-play]')!;
const replay = root.querySelector<HTMLButtonElement>('[data-mechanism-replay]')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const lifecycle = new AbortController();
const { signal } = lifecycle;
let quiet = false;
let index = 0;
let visible = false;
let userPaused = false;
let clock: gsap.core.Timeline;
let movement: gsap.core.Timeline | undefined;
let transport: gsap.core.Tween | undefined;
const duration = 5.2;
const globallyPaused = () => reduced.matches || document.documentElement.classList.contains('motion-paused');
const active = () => visible && !userPaused && !globallyPaused() && !document.hidden;
const quietPhases: Partial<Phase>[] = [
    {},
    { title: 'This question is different.', text: 'A late submission is not the same as updating a project. The saved answer does not cover it.' },
    { title: 'Nothing useful matches.', text: 'There is guidance about updates, but no approved answer about a missed deadline.' },
    { title: 'No facts? No guessing.', text: 'Skip the generation call. The bot does not ask the model to invent a deadline exception.', tech: 'Generation skipped' },
    { title: 'Leave it for a person.', text: 'The case waits in the moderator queue. A person can give the right answer.', tech: 'Response policy · moderator queue' },
    { title: 'The thread stays quiet.', text: 'No filler reply. No copied advice. The next useful human answer can become saved knowledge.', tech: 'Discord · no bot reply' },
];
const useCaptionTravel = () => globallyPaused() ? 0 : 6;
type Position = {
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
};
function renderPhase(next: number, instant = false) {
    index = next;
    root.dataset.phase = String(next);
    const info = { ...phases[next], ...(quiet ? quietPhases[next] : {}) };
    root.querySelector('[data-mechanism-title]')!.textContent = info.title;
    root.querySelector('[data-mechanism-copy]')!.textContent = info.text;
    root.querySelector('[data-mechanism-tech]')!.textContent = info.tech;
    root.querySelector('[data-mechanism-file]')!.textContent = info.file;
    root.querySelector<HTMLAnchorElement>('[data-mechanism-source]')!.href = 'https://github.com/sea-deep/threadsherpa/blob/main/' + info.file;
    root.querySelector('[data-visual-question]')!.textContent = quiet ? 'Can I submit late?' : 'New fix. New link?';
    root.querySelector('[data-quiet-caption]')!.textContent = next === 3 ? 'No model call.' : next === 4 ? 'A moderator takes it.' : 'Waiting for a person.';
    buttons.forEach((button, i) => { if (i === next)
        button.setAttribute('aria-current', 'step');
    else
        button.removeAttribute('aria-current'); });
    const mobile = theatre.clientWidth < 560;
    const w = theatre.clientWidth;
    const spread = Math.min(w * .28, 270);
    const positions: Record<string, Position> = {};
    if (next === 0) {
        positions.guide = { x: mobile ? 65 : 150, y: mobile ? 100 : 55 };
        positions.evidence = { x: mobile ? -18 : -150, y: mobile ? -95 : -15, rotation: -3 };
        positions.memory = { x: mobile ? 90 : 170, y: mobile ? 20 : -80, scale: .75, opacity: .55 };
    }
    else if (next === 1) {
        positions.guide = { x: mobile ? -65 : -spread + 30, y: mobile ? 110 : 55 };
        positions.question = { x: mobile ? 5 : spread - 20, y: mobile ? -80 : -20, rotation: 3 };
        positions.memory = { x: mobile ? 85 : -spread + 45, y: mobile ? 70 : -100, scale: .7, opacity: .6 };
        positions.trail = { x: mobile ? 5 : 0, y: mobile ? 30 : 0, rotation: mobile ? 90 : 0 };
    }
    else if (next === 2) {
        positions.guide = { x: mobile ? -65 : 0, y: mobile ? 110 : 80 };
        positions.facts = { x: 0, y: mobile ? -65 : -70, scale: mobile ? .84 : 1, opacity: quiet ? .32 : 1 };
        if (!mobile)
            positions.question = { x: spread, y: 40, scale: .77 };
        positions.trail = { x: mobile ? 40 : 0, y: mobile ? 50 : 0, rotation: 90 };
    }
    else if (next === 3) {
        if (quiet) {
            positions.guide = { x: mobile ? -70 : -180, y: mobile ? 105 : 70 };
            positions.quiet = { x: mobile ? 0 : 130, y: mobile ? -75 : -20 };
        }
        else {
            positions.guide = { x: mobile ? -85 : -spread, y: mobile ? 130 : 75, scale: mobile ? .82 : 1 };
            if (!mobile)
                positions.evidence = { x: -spread, y: -100, scale: .65, rotation: -5 };
            positions.model = { x: mobile ? 85 : 0, y: mobile ? 110 : 10, scale: mobile ? .8 : 1 };
            positions.reply = { x: mobile ? 0 : spread, y: mobile ? -65 : 0, scale: mobile ? .92 : 1 };
            positions.trail = { x: mobile ? 0 : 110, y: mobile ? 110 : 0 };
        }
    }
    else if (next === 4) {
        positions.guide = { x: mobile ? -85 : -spread, y: mobile ? 115 : 65, scale: mobile ? .85 : 1 };
        if (quiet) {
            positions.quiet = { x: mobile ? 0 : 100, y: mobile ? -70 : -20 };
        }
        else {
            positions.reply = { x: mobile ? 0 : 70, y: mobile ? -65 : 0 };
            positions.check = { x: mobile ? 85 : spread + 60, y: mobile ? 95 : -60, scale: mobile ? .9 : 1 };
            if (!mobile)
                positions.evidence = { x: -spread, y: -100, scale: .65, rotation: -5 };
        }
    }
    else {
        positions.guide = { x: mobile ? 95 : -spread, y: mobile ? 125 : 65, scale: mobile ? .7 : 1 };
        positions.question = { x: mobile ? 0 : 75, y: mobile ? -135 : -115, scale: .8 };
        if (quiet) {
            positions.quiet = { x: mobile ? -30 : 75, y: mobile ? 10 : 50, scale: .85 };
        }
        else {
            positions.reply = { x: mobile ? 0 : 75, y: mobile ? 0 : 60 };
        }
    }
    gsap.fromTo(root.querySelectorAll('[data-mechanism-title],[data-mechanism-copy]'), { y: useCaptionTravel(), opacity: .5 }, { y: 0, opacity: 1, duration: globallyPaused() || instant ? 0 : .35, ease: 'power2.out' });
    const guide = root.querySelector<HTMLElement>('[data-guide]')!;
    guide.dataset.pose = next === 0 ? 'save' : next === 1 ? 'walk' : next === 5 ? 'sleep' : quiet && next > 1 ? 'quiet' : next === 4 ? 'check' : next === 3 ? 'reply' : 'idle';
    movement?.kill();
    transport?.kill();
    const useMotion = !instant && !globallyPaused();
    movement = gsap.timeline();
    objects.forEach((el, name) => {
        const p = positions[name];
        if (p)
            movement!.to(el, { x: p.x, y: p.y, scale: p.scale ?? 1, rotation: p.rotation ?? 0, autoAlpha: p.opacity ?? 1, duration: useMotion ? .65 : 0, ease: 'power3.out' }, 0);
        else
            movement!.to(el, { autoAlpha: 0, duration: useMotion ? .25 : 0 }, 0);
    });
    if (active() && (next === 0 || next === 2 && !quiet || next === 3 && !quiet)) {
        const note = objects.get('transport')!;
        const from = next === 0 ? positions.evidence : next === 2 ? positions.facts : positions.model;
        const to = next === 0 ? positions.guide : next === 2 ? positions.guide : positions.reply;
        gsap.set(note, { x: from.x + 30, y: from.y, scale: .6, rotation: -12, autoAlpha: 0 });
        transport = gsap.fromTo(note, { x: from.x + 30, y: from.y, autoAlpha: 0 }, { x: to.x + 25, y: to.y - 20, rotation: 15, autoAlpha: 1, duration: 1.35, delay: .8, ease: 'power2.inOut', repeat: 1, repeatDelay: .7, onRepeat: () => gsap.set(note, { autoAlpha: 0 }) });
    }
}
function syncPlayback() {
    const playing = active();
    clock?.paused(!playing);
    transport?.paused(!playing);
    root.classList.toggle('is-active', playing);
    play.disabled = globallyPaused();
    const state = !userPaused && !globallyPaused();
    play.dataset.playing = String(state);
    play.setAttribute('aria-label', state ? 'Pause explanation' : 'Play explanation');
    root.querySelector('[data-play-label]')!.textContent = globallyPaused() ? 'Paused' : userPaused ? 'Play' : 'Pause';
    if (!playing && (!visible || globallyPaused() || document.hidden))
        movement?.progress(1);
}
gsap.set([...objects.values()], { xPercent: -50, yPercent: -50, autoAlpha: 0 });
root.classList.add('is-ready');
play.hidden = false;
replay.hidden = false;
clock = gsap.timeline({ paused: true, repeat: -1, onRepeat: () => gsap.set(root.querySelectorAll('.chapter-fill'), { scaleX: 0 }) });
phases.forEach((_, i) => {
    clock.call(() => renderPhase(i), [], i * duration);
    clock.fromTo(buttons[i].querySelector('.chapter-fill'), { scaleX: 0 }, { scaleX: 1, duration, ease: 'none', immediateRender: false }, i * duration);
});
renderPhase(0, true);
buttons.forEach((button, i) => button.addEventListener('click', () => {
    userPaused = true;
    clock.pause(i * duration + .01);
    renderPhase(i);
    syncPlayback();
}, { signal }));
play.addEventListener('click', () => { userPaused = !userPaused; syncPlayback(); }, { signal });
replay.addEventListener('click', () => { userPaused = false; clock.pause(0); gsap.set(root.querySelectorAll('.chapter-fill'), { scaleX: 0 }); renderPhase(0); syncPlayback(); }, { signal });
root.querySelectorAll<HTMLButtonElement>('[data-mechanism-route]').forEach(button => button.addEventListener('click', () => {
    quiet = button.dataset.mechanismRoute === 'quiet';
    root.dataset.route = quiet ? 'quiet' : 'answer';
    root.querySelectorAll<HTMLButtonElement>('[data-mechanism-route]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    clock.pause(duration + .01);
    renderPhase(1);
    syncPlayback();
}, { signal }));
const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); }, { threshold: .3 });
observer.observe(root);
// The same small character lives in the navigation, the conversation and here.
// Offscreen and background-tab loops sleep rather than spending frames unseen.
const guides = [...document.querySelectorAll<HTMLElement>('[data-guide]')];
const guideObserver = new IntersectionObserver(entries => { entries.forEach(entry => entry.target.classList.toggle('in-view', entry.isIntersecting && !document.hidden)); });
guides.forEach(guide => guideObserver.observe(guide));
document.addEventListener('visibilitychange', () => { syncPlayback(); if (document.hidden)
    guides.forEach(guide => guide.classList.remove('in-view'));
else
    guides.forEach(guide => { const r = guide.getBoundingClientRect(); guide.classList.toggle('in-view', r.bottom > 0 && r.top < innerHeight); }); }, { signal });
window.addEventListener('ts:motion', () => { if (globallyPaused()) {
    transport?.kill();
    renderPhase(index, true);
} syncPlayback(); }, { signal });
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => renderPhase(index, true), 150); }, { signal });
syncPlayback();
window.addEventListener('pagehide', () => { lifecycle.abort(); clearTimeout(resizeTimer); clock.kill(); movement?.kill(); transport?.kill(); observer.disconnect(); guideObserver.disconnect(); }, { once: true });
