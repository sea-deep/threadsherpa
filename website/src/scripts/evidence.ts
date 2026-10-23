/* Evidence explorer: inspect real captures without flattening them into
   decoration. Every transform also has a visible button equivalent. */

type Annotation = {
  label: string;
  description: string;
  x: number;
  y: number;
};

type Capture = {
  id: string;
  tab: string;
  caption: string;
  alt: string;
  src960: string;
  src1600: string;
  original: string;
  width: number;
  height: number;
  annotation?: Annotation;
};

const root = document.querySelector<HTMLElement>('[data-evidence]');
const dataNode = document.querySelector<HTMLScriptElement>('[data-evidence-data]');

function start(explorer: HTMLElement, captures: Capture[]) {
  const tabs = [...explorer.querySelectorAll<HTMLButtonElement>('[data-capture]')];
  const panel = explorer.querySelector<HTMLElement>('[data-evidence-panel]');
  const frame = explorer.querySelector<HTMLElement>('[data-viewer]');
  const zoomLayer = explorer.querySelector<HTMLElement>('[data-zoom]');
  const image = explorer.querySelector<HTMLImageElement>('[data-evidence-img]');
  const marker = explorer.querySelector<HTMLElement>('[data-capture-marker]');
  const captionTitle = explorer.querySelector<HTMLElement>('[data-caption-title]');
  const captionBody = explorer.querySelector<HTMLElement>('[data-caption-body]');
  const handle = explorer.querySelector<HTMLElement>('[data-drag-handle]');
  const zoomIn = explorer.querySelector<HTMLButtonElement>('[data-zoom-in]');
  const zoomOut = explorer.querySelector<HTMLButtonElement>('[data-zoom-out]');
  const reset = explorer.querySelector<HTMLButtonElement>('[data-reset]');
  const panButtons = [...explorer.querySelectorAll<HTMLButtonElement>('[data-pan]')];
  const full = explorer.querySelector<HTMLButtonElement>('[data-open-full]');
  const annotationButtons = [...explorer.querySelectorAll<HTMLButtonElement>('[data-annotation]')];
  const status = explorer.querySelector<HTMLElement>('[data-evidence-status]');

  const dialog = document.querySelector<HTMLDialogElement>('[data-capture-dialog]');
  const dialogImage = dialog?.querySelector<HTMLImageElement>('[data-dialog-img]');
  const dialogTitle = dialog?.querySelector<HTMLElement>('[data-dialog-title]');
  const dialogCaption = dialog?.querySelector<HTMLElement>('[data-dialog-caption]');
  const dialogMarker = dialog?.querySelector<HTMLElement>('[data-dialog-marker]');
  const dialogOriginal = dialog?.querySelector<HTMLAnchorElement>('[data-dialog-original]');
  const dialogBody = dialog?.querySelector<HTMLElement>('[data-dialog-body]');

  if (!frame || !zoomLayer || !image || !captures.length) return;

  let current = captures[0]!;
  let scale = 1;
  let x = 0;
  let y = 0;
  let selectedAnnotation: Annotation | null = current.annotation ?? null;
  let dragging = false;
  let dragStart = { x: 0, y: 0, originX: 0, originY: 0 };
  let moved = false;
  let pointerId: number | null = null;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const maxOffset = () => ({
    x: ((scale - 1) * frame.clientWidth) / 2,
    y: ((scale - 1) * frame.clientHeight) / 2,
  });

  function apply(animate = false) {
    const bounds = maxOffset();
    x = clamp(x, -bounds.x, bounds.x);
    y = clamp(y, -bounds.y, bounds.y);
    zoomLayer!.style.transition = animate ? 'transform 220ms cubic-bezier(0.22,1,0.36,1)' : 'none';
    zoomLayer!.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    frame!.classList.toggle('is-zoomed', scale > 1.01);
    if (zoomIn) zoomIn.disabled = scale >= 3;
    if (zoomOut) zoomOut.disabled = scale <= 1;
    panButtons.forEach((button) => {
      button.disabled = scale <= 1.01;
    });
    if (reset) reset.disabled = scale <= 1.01 && x === 0 && y === 0;
    placeMarker();
  }

  function placeMarker() {
    if (!marker) return;
    if (!selectedAnnotation) {
      marker.hidden = true;
      return;
    }
    marker.hidden = false;
    const width = frame!.clientWidth;
    const height = frame!.clientHeight;
    const natural = current.width / current.height;
    const box = width / height;
    let imageWidth = width;
    let imageHeight = height;
    if (natural > box) imageHeight = width / natural;
    else imageWidth = height * natural;
    const offsetX = (width - imageWidth) / 2;
    const offsetY = (height - imageHeight) / 2;
    marker.style.left = `${offsetX + (selectedAnnotation.x / 100) * imageWidth}px`;
    marker.style.top = `${offsetY + (selectedAnnotation.y / 100) * imageHeight}px`;
    marker.setAttribute('title', selectedAnnotation.label);
  }

  function setScale(next: number, animate = true) {
    scale = clamp(next, 1, 3);
    if (scale === 1) {
      x = 0;
      y = 0;
    }
    apply(animate);
    if (status) status.textContent = scale === 1 ? 'Full capture visible.' : `${Math.round(scale * 100)}% zoom.`;
  }

  function resetView() {
    scale = 1;
    x = 0;
    y = 0;
    apply(true);
    if (status) status.textContent = 'Full capture visible.';
  }

  function pan(dx: number, dy: number) {
    if (scale <= 1) return;
    x += dx;
    y += dy;
    apply(true);
  }

  function selectCapture(id: string, focus = false) {
    const next = captures.find((capture) => capture.id === id);
    if (!next) return;
    current = next;
    selectedAnnotation = next.annotation ?? null;
    scale = 1;
    x = 0;
    y = 0;
    tabs.forEach((tab) => {
      const active = tab.dataset.capture === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    if (panel) panel.setAttribute('aria-labelledby', `evidence-tab-${id}`);
    image!.src = next.src960;
    image!.srcset = `${next.src960} 960w, ${next.src1600} 1600w`;
    image!.alt = next.alt;
    image!.width = next.width;
    image!.height = next.height;
    frame!.style.setProperty('--capture-ratio', String(clamp(next.width / next.height, 1.08, 1.72)));
    if (captionTitle) captionTitle.textContent = next.tab;
    if (captionBody) captionBody.textContent = next.caption;
    annotationButtons.forEach((button) => {
      const active = button.dataset.annotation === id && Boolean(next.annotation);
      button.setAttribute('aria-pressed', String(active));
      button.hidden = !captures.find((capture) => capture.id === button.dataset.annotation)?.annotation;
    });
    apply(false);
    window.requestAnimationFrame(placeMarker);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.capture) selectCapture(tab.dataset.capture);
    });
  });

  const tablist = explorer.querySelector<HTMLElement>('[data-evidence-tabs]');
  tablist?.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else next = (index - 1 + tabs.length) % tabs.length;
    const id = tabs[next]?.dataset.capture;
    if (id) selectCapture(id, true);
  });

  annotationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.annotation;
      if (id) selectCapture(id, true);
    });
  });

  zoomIn?.addEventListener('click', () => setScale(scale + 0.5));
  zoomOut?.addEventListener('click', () => setScale(scale - 0.5));
  reset?.addEventListener('click', resetView);
  panButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const amount = 70;
      const direction = button.dataset.pan;
      if (direction === 'up') pan(0, amount);
      if (direction === 'down') pan(0, -amount);
      if (direction === 'left') pan(amount, 0);
      if (direction === 'right') pan(-amount, 0);
    });
  });

  frame.addEventListener('dblclick', () => setScale(scale > 1.01 ? 1 : 2));

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    dragStart = { x: event.clientX, y: event.clientY, originX: x, originY: y };
    frame!.classList.add('is-dragging');
    frame!.setPointerCapture?.(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (scale > 1) {
      event.preventDefault();
      x = dragStart.originX + dx;
      y = dragStart.originY + dy;
      apply(false);
    }
  }

  function up(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    frame!.classList.remove('is-dragging');
    if (scale > 1 && moved) apply(true);
  }

  frame.addEventListener('pointerdown', down);
  frame.addEventListener('pointermove', move, { passive: false });
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', up);
  handle?.addEventListener('pointerdown', down);
  handle?.addEventListener('pointermove', move, { passive: false });
  handle?.addEventListener('pointerup', up);

  frame.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setScale(scale + 0.5);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      setScale(scale - 0.5);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    } else if (scale > 1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const amount = event.shiftKey ? 40 : 16;
      if (event.key === 'ArrowUp') pan(0, amount);
      if (event.key === 'ArrowDown') pan(0, -amount);
      if (event.key === 'ArrowLeft') pan(amount, 0);
      if (event.key === 'ArrowRight') pan(-amount, 0);
    }
  });

  function openDialog() {
    if (!dialog || !dialogImage) return;
    dialogImage.src = current.original;
    dialogImage.alt = current.alt;
    if (dialogTitle) dialogTitle.textContent = current.tab;
    if (dialogCaption) dialogCaption.textContent = `${current.caption} ${current.annotation?.description ?? ''}`.trim();
    if (dialogOriginal) {
      dialogOriginal.href = current.original;
      dialogOriginal.setAttribute('download', '');
    }
    if (dialogMarker) {
      dialogMarker.hidden = !current.annotation;
      window.requestAnimationFrame(() => {
        if (!current.annotation || !dialogBody) return;
        const imageRect = dialogImage.getBoundingClientRect();
        const bodyRect = dialogBody.getBoundingClientRect();
        dialogMarker.style.left = `${imageRect.left - bodyRect.left + (current.annotation.x / 100) * imageRect.width}px`;
        dialogMarker.style.top = `${imageRect.top - bodyRect.top + (current.annotation.y / 100) * imageRect.height}px`;
      });
    }
    dialog.showModal();
  }

  full?.addEventListener('click', openDialog);

  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
  dialog?.querySelectorAll<HTMLElement>('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => dialog?.close());
  });

  const observer = new ResizeObserver(() => {
    apply(false);
    placeMarker();
  });
  observer.observe(frame);
  window.addEventListener('resize', placeMarker);

  selectCapture(current.id);
  if (status) status.textContent = 'Full capture visible.';
}

if (root && dataNode) {
  try {
    const captures = JSON.parse(dataNode.textContent ?? '[]') as Capture[];
    if (Array.isArray(captures) && captures.length) start(root, captures);
  } catch {
    /* The static image and captions remain usable without the explorer. */
  }
}
