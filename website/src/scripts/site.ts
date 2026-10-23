/* Global site behaviour: navigation, motion preference, copy actions, and
   selectable example scenes. Page-specific controllers are imported by their
   own pages. */

const doc = document.documentElement;
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function motionPaused(): boolean {
  return doc.classList.contains('motion-paused') || reduceQuery.matches;
}

function labelMotion() {
  const reduced = reduceQuery.matches;
  document.querySelectorAll<HTMLButtonElement>('[data-motion-toggle]').forEach((button) => {
    if (reduced) {
      button.textContent = 'Motion reduced';
      button.setAttribute('aria-pressed', 'true');
      button.disabled = true;
      button.title = 'Your system asks for reduced motion.';
      return;
    }
    button.disabled = false;
    button.removeAttribute('title');
    const paused = doc.classList.contains('motion-paused');
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
    button.setAttribute('aria-pressed', String(paused));
  });
}

function setMotion(paused: boolean) {
  doc.classList.toggle('motion-paused', paused);
  try {
    if (paused) localStorage.setItem('ts-motion', 'paused');
    else localStorage.removeItem('ts-motion');
  } catch {
    /* Storage can be unavailable; the setting still applies this visit. */
  }
  labelMotion();
  window.dispatchEvent(new CustomEvent('ts:motion', { detail: { paused: motionPaused() } }));
}

document.addEventListener('click', (event) => {
  const toggle = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-motion-toggle]');
  if (!toggle || toggle.disabled) return;
  setMotion(!doc.classList.contains('motion-paused'));
});

reduceQuery.addEventListener?.('change', () => {
  labelMotion();
  window.dispatchEvent(new CustomEvent('ts:motion', { detail: { paused: motionPaused() } }));
});
labelMotion();

/* Mobile menu ---------------------------------------------------------- */

const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menuPanel = document.querySelector<HTMLElement>('[data-menu-panel]');
const menuLabel = document.querySelector<HTMLElement>('[data-menu-label]');

function setMenu(open: boolean, restoreFocus = false) {
  if (!menuToggle || !menuPanel) return;
  menuPanel.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  if (menuLabel) menuLabel.textContent = open ? 'Close menu' : 'Open menu';
  if (open) {
    menuPanel.querySelector<HTMLElement>('a, button')?.focus();
  } else if (restoreFocus) {
    menuToggle.focus();
  }
}

menuToggle?.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

menuPanel?.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) setMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !menuPanel || menuPanel.hidden) return;
  setMenu(false, true);
});

document.addEventListener('pointerdown', (event) => {
  if (!menuPanel || menuPanel.hidden) return;
  const target = event.target as Node;
  if (menuPanel.contains(target) || menuToggle?.contains(target)) return;
  setMenu(false);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 1023 && menuPanel && !menuPanel.hidden) setMenu(false);
});

/* Copy controls -------------------------------------------------------- */

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (copied) resolve();
    else reject(new Error('copy failed'));
  });
}

document.addEventListener('click', async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!button) return;
  const scope = button.closest<HTMLElement>('.code-card, .code-block, [data-copy-scope]');
  const status = scope?.querySelector<HTMLElement>('[data-copy-status]');
  const text = button.dataset.copy ?? scope?.querySelector('pre')?.textContent ?? '';
  try {
    await copyText(text);
    if (status) status.textContent = 'Commands copied.';
    button.dataset.state = 'copied';
    window.setTimeout(() => {
      button.dataset.state = '';
    }, 1600);
  } catch {
    if (status) status.textContent = "Couldn't copy. Select the commands and copy them manually.";
    button.dataset.state = 'failed';
  }
});

/* Selectable difference scenes ---------------------------------------- */

const sceneButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-scene-button]')];
const scenePanels = [...document.querySelectorAll<HTMLElement>('[data-scene-panel]')];

function selectScene(id: string, focusButton = false) {
  if (!id) return;
  sceneButtons.forEach((button) => {
    const active = button.dataset.sceneButton === id;
    button.setAttribute('aria-expanded', String(active));
    button.closest('.behavior')?.setAttribute('aria-expanded', String(active));
    if (active && focusButton) button.focus();
  });
  scenePanels.forEach((panel) => {
    panel.hidden = panel.dataset.scenePanel !== id;
  });
}

sceneButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.dataset.sceneButton;
    if (id) selectScene(id);
  });
});

if (sceneButtons.length) {
  const first = sceneButtons.find((button) => button.getAttribute('aria-expanded') === 'true') ?? sceneButtons[0];
  if (first?.dataset.sceneButton) selectScene(first.dataset.sceneButton);
}

/* Keep anchors from clearing the sticky header. ----------------------- */
document.querySelectorAll<HTMLElement>('[data-anchor-focus]').forEach((element) => {
  element.addEventListener('click', () => {
    const target = document.querySelector<HTMLElement>('#playground');
    target?.scrollIntoView({ behavior: motionPaused() ? 'auto' : 'smooth', block: 'start' });
  });
});
