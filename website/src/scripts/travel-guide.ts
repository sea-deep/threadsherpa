import { guideRoutes, pointOnRoute, type GuideRoute } from './guide-route';

interface Stop {
  x: number; y: number; size: number; scroll: number; name: string; pose: string;
}

/** The same SVG follows measured resting places. Native scroll is never pinned or intercepted. */
export function createGuideTraveler(signal: AbortSignal, paused: () => boolean) {
  const traveler = document.querySelector<HTMLElement>('[data-travel-guide]');
  const guide = traveler?.querySelector<HTMLElement>('[data-guide]');
  if (!traveler || !guide) return;
  const anchors = [...document.querySelectorAll<HTMLElement>('[data-guide-stop]')];
  let stops: Stop[] = [];
  let routes: GuideRoute[] = [];
  let frame = 0;
  let measureFrame = 0;
  let previousX = 0;
  let lastPosition: Stop | undefined;
  let frozen: Stop | undefined;

  function draw() {
    frame = 0;
    if (!stops.length || document.hidden) return;
    const scroll = window.scrollY;
    let a = stops[0], b = a, t = 0, routeIndex = 0;
    if (paused()) {
      frozen ||= lastPosition || stops[0];
      a = b = frozen;
    } else {
      frozen = undefined;
      for (let index = 1; index < stops.length; index++) {
        b = stops[index];
        if (scroll <= b.scroll) {
          routeIndex = index - 1;
          const progress = Math.max(0, Math.min(1, (scroll - a.scroll) / Math.max(1, b.scroll - a.scroll)));
          // Linger beside the content, then move through the space between sections.
          const travel = Math.max(0, Math.min(1, (progress - .12) / .76));
          t = travel * travel * (3 - 2 * travel);
          break;
        }
        a = b;
      }
    }
    const moving = t > .02 && t < .98;
    const position = moving ? pointOnRoute(routes[routeIndex], t) : t > .5 ? b : a;
    const {x,y} = position;
    const walkingSize = innerWidth > 650 ? 72 : 48;
    const blend = (value:number) => { const n = Math.min(1, Math.max(0,value)); return n*n*(3-2*n); };
    const size = t <= .5 ? a.size + (walkingSize-a.size)*blend(t/.045)
      : walkingSize + (b.size-walkingSize)*blend((t-.955)/.045);
    const tilt = moving ? Math.sin(t * Math.PI * 2) * 3 : 0;
    traveler!.style.transform = `translate3d(${x - 80}px,${y - scroll - 80}px,0) rotate(${tilt}deg) scale(${size / 160})`;
    traveler!.dataset.ready = '';
    traveler!.dataset.scene = t > .5 ? b.name : a.name;
    traveler!.dataset.moving = String(moving);
    if (moving && Math.abs(x - previousX) > .2) traveler!.dataset.direction = x < previousX ? 'left' : 'right';
    else if (!moving) traveler!.dataset.direction = 'right';
    guide!.dataset.pose = moving ? 'walk' : t > .5 ? b.pose : a.pose;
    lastPosition = { x,y,size,scroll,name:traveler!.dataset.scene,pose:guide!.dataset.pose };
    const visible = y - scroll + size > 0 && y - scroll - size < innerHeight;
    guide!.classList.toggle('in-view', visible);
    previousX = x;
  }
  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  function layoutRect(el:HTMLElement) {
    const r=el.getBoundingClientRect();
    const reveal=el.closest<HTMLElement>('[data-reveal]');
    const transform=reveal ? getComputedStyle(reveal).transform : 'none';
    const shift=transform==='none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    return {left:r.left,right:r.right,top:r.top-shift,bottom:r.bottom-shift,width:r.width,height:r.height};
  }
  function measure() {
    measureFrame = 0;
    const end = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    stops = anchors.map((el, index) => {
      const r = layoutRect(el);
      const y = r.top + scrollY + r.height / 2;
      return { x: r.left + r.width / 2, y, size:r.width,
        scroll: index === 0 ? 0 : Math.min(end, Math.max(1, y - innerHeight * .64)),
        name:el.dataset.guideStop!, pose:el.dataset.guidePose || 'idle' };
    });
    const obstacles = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,p,summary,a,button,.discord-surface,.discord-channel,.discord-byline,.uncovered-question,.no-reply-mark,.repeat-footnote')]
      .filter(el => !el.closest('[data-travel-guide]'))
      .map(layoutRect).filter(r => r.width && r.height)
      .map(r => ({left:r.left,right:r.right,top:r.top+scrollY,bottom:r.bottom+scrollY}));
    routes = guideRoutes(stops, innerWidth, document.documentElement.scrollHeight, innerWidth > 650 ? 72 : 48, obstacles);
    draw();
  }
  function requestMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }
  window.addEventListener('scroll', requestDraw, { signal, passive:true });
  window.addEventListener('resize', requestMeasure, { signal, passive:true });
  window.addEventListener('ts:motion', requestMeasure, { signal });
  document.addEventListener('visibilitychange', requestDraw, { signal });
  document.addEventListener('toggle', requestMeasure, { signal, capture:true });
  const observer = new ResizeObserver(requestMeasure);
  observer.observe(document.querySelector('main')!);
  void document.fonts.ready.then(requestMeasure);
  measure();
  signal.addEventListener('abort', () => {
    observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(measureFrame);
  }, { once:true });
}
