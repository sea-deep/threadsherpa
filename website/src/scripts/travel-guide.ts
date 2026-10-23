import { easeGuide, guideRoutes, pointOnRoute, type GuideRoute } from './guide-route';

interface Stop {
  x: number; y: number; size: number; scroll: number; name: string; pose: string;
}
interface GuideState extends Stop { angle:number; }

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
  let easedScroll = window.scrollY;
  let scrollVelocity = 0;
  let lastTime = 0;
  let lastPosition: GuideState | undefined;
  let frozen: GuideState | undefined;

  function draw(time = performance.now()) {
    frame = 0;
    if (!stops.length || document.hidden) return;
    const scroll = window.scrollY;
    const elapsed = lastTime ? Math.min(48, time-lastTime) : 16;
    lastTime = time;
    // A short, frame-rate-independent catch-up absorbs wheel steps. Large jumps
    // arrive directly instead of flying across the page.
    if (Math.abs(scroll-easedScroll)>innerHeight*1.1 || paused()) {
      easedScroll=scroll;scrollVelocity=0;
    } else {
      // Critical damping gives wheel input a gentle start and no rebound.
      const previous=easedScroll,seconds=elapsed/1000,omega=7;
      const offset=easedScroll-scroll,step=(scrollVelocity+omega*offset)*seconds;
      const decay=Math.exp(-omega*seconds);
      easedScroll=scroll+(offset+step)*decay;
      scrollVelocity=(scrollVelocity-omega*step)*decay;
      if ((scroll-previous)*(scroll-easedScroll)<0) { easedScroll=scroll;scrollVelocity=0; }
    }
    if (Math.abs(scroll-easedScroll)<.1 && Math.abs(scrollVelocity)<1) { easedScroll=scroll;scrollVelocity=0; }
    let a = stops[0], b = a, t = 0, routeIndex = 0;
    if (paused()) {
      frozen ||= lastPosition || {...stops[0],angle:0};
      a = b = frozen;
    } else {
      frozen = undefined;
      for (let index = 1; index < stops.length; index++) {
        b = stops[index];
        if (easedScroll <= b.scroll) {
          routeIndex = index - 1;
          t = Math.max(0, Math.min(1, (easedScroll - a.scroll) / Math.max(1, b.scroll - a.scroll)));
          break;
        }
        a = b;
      }
    }
    const transit = t > .31 && t < .81;
    const travel = easeGuide((t-.31)/.5);
    const moving = transit && Math.abs(scroll-easedScroll)>.35;
    const position = transit ? pointOnRoute(routes[routeIndex], travel) : t >= .81 ? b : a;
    const {x,y} = position;
    const walkingSize = innerWidth > 650 ? 72 : 48;
    // Resize while resting in clear space, with a full pause before departure
    // and after arrival. Scale no longer pops at the ends of a route.
    const size = t <= .31 ? a.size + (walkingSize-a.size)*easeGuide((t-.18)/.13)
      : t >= .81 ? walkingSize + (b.size-walkingSize)*easeGuide((t-.81)/.13) : walkingSize;
    const desiredAngle = transit ? Math.sin(travel*Math.PI*2)*1.2 : 0;
    const tilt = paused() ? frozen!.angle : (lastPosition?.angle || 0)+(desiredAngle-(lastPosition?.angle || 0))*(1-Math.exp(-elapsed/120));
    traveler!.style.transform = `translate3d(${x - 80}px,${y - scroll - 80}px,0) rotate(${tilt}deg) scale(${size / 160})`;
    traveler!.dataset.ready = '';
    traveler!.dataset.scene = travel > .5 ? b.name : a.name;
    traveler!.dataset.moving = String(moving);
    guide!.dataset.pose = paused() ? frozen!.pose : transit ? 'check' : t >= .81 ? b.pose : a.pose;
    lastPosition = { x,y,size,scroll,angle:tilt,name:traveler!.dataset.scene,pose:guide!.dataset.pose };
    const visible = y - scroll + size > 0 && y - scroll - size < innerHeight;
    guide!.classList.toggle('in-view', visible);
    if (!paused() && (easedScroll!==scroll || Math.abs(tilt-desiredAngle)>.01)) frame=requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame) { lastTime=performance.now();frame=requestAnimationFrame(draw); }
  }
  function layoutRect(el:HTMLElement) {
    const r=el.getBoundingClientRect();
    const reveal=el.closest<HTMLElement>('[data-reveal]');
    const transform=reveal ? getComputedStyle(reveal).transform : 'none';
    const shift=transform==='none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    return {left:r.left,right:r.right,top:r.top-shift,bottom:r.bottom-shift,width:r.width,height:r.height};
  }
  function measure() {
    measureFrame = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
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
    easedScroll=window.scrollY;
    scrollVelocity=0;
    lastTime=0;
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
