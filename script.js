// format time as mm:ss.ms (2 digits milliseconds)
const fmt = (s) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms
    .toString()
    .padStart(2, '0')}`;
};

// update circular progress stroke
function updateRing(ring, fraction) {
  const radius = 98;
  const circ = 2 * Math.PI * radius;
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ * (1 - fraction);
}

// включаем / выключаем эффект конца таймера
function markFinished(display, ring, finished) {
  if (!display || !ring) return;
  if (finished) {
    display.classList.add('finished');
    ring.classList.add('finished');
  } else {
    display.classList.remove('finished');
    ring.classList.remove('finished');
  }
}

// ===== Timer Factory =====
function makeTimer(displayId, toggleId, resetId, ringId, buttonsSelector) {
  const display = document.getElementById(displayId);
  const toggle = document.getElementById(toggleId);
  const reset = document.getElementById(resetId);
  const ring = document.getElementById(ringId);
  let total = 30,
    left = 30,
    running = false,
    last = 0,
    raf;

  // пресет-кнопки для этого таймера (может быть пустой массив)
  const presetButtons = buttonsSelector
    ? Array.from(document.querySelectorAll(buttonsSelector))
    : [];

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left -= dt;
    if (left <= 0) {
      left = 0;
      running = false;
      cancelAnimationFrame(raf);
      display.textContent = fmt(left);
      toggle.textContent = 'Start';
      updateRing(ring, 0);
      markFinished(display, ring, true); // красный финиш
      return;
    }
    display.textContent = fmt(left);
    updateRing(ring, left / total);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || left <= 0) return;
    running = true;
    last = 0;
    markFinished(display, ring, false); // убираем красный, если был
    raf = requestAnimationFrame(loop);
    toggle.textContent = 'Pause';
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
  }

  function resetF() {
    pause();
    left = total;
    display.textContent = fmt(left);
    updateRing(ring, 1);
    markFinished(display, ring, false);
  }

  toggle.addEventListener('click', () => (running ? pause() : start()));
  reset.addEventListener('click', resetF);

  // обработка пресетов (Cooking / Sport / Study)
  if (presetButtons.length) {
    presetButtons.forEach((b) =>
      b.addEventListener('click', () => {
        const v = +b.dataset.cook || +b.dataset.sport || +b.dataset.study || 0;
        if (!v) return;
        total = v;
        left = total;
        display.textContent = fmt(left);
        updateRing(ring, 1);
        markFinished(display, ring, false);

        // подсветка выбранного пресета
        presetButtons.forEach((btn) => btn.classList.remove('is-active'));
        b.classList.add('is-active');
      }),
    );
  }

  updateRing(ring, 1);
  markFinished(display, ring, false);
}

// ===== Init three preset tabs =====
makeTimer('cookDisplay', 'cookToggle', 'cookReset', 'cookRing', '[data-cook]');
makeTimer('sportDisplay', 'sportToggle', 'sportReset', 'sportRing', '[data-sport]');
makeTimer('studyDisplay', 'studyToggle', 'studyReset', 'studyRing', '[data-study]');

// ===== General tab (with inputs) =====
(function () {
  const minI = document.getElementById('generalMin');
  const secI = document.getElementById('generalSec');
  const d = document.getElementById('generalDisplay');
  const t = document.getElementById('generalToggle');
  const r = document.getElementById('generalReset');
  const ring = document.getElementById('generalRing');
  let left = 30,
    total = 30,
    running = false,
    last = 0,
    raf;

  function sync() {
    total = (+minI.value || 0) * 60 + (+secI.value || 0);
    left = total;
    d.textContent = fmt(left);
    updateRing(ring, total > 0 ? 1 : 0);
    markFinished(d, ring, false);
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left -= dt;
    if (left <= 0) {
      left = 0;
      d.textContent = fmt(left);
      running = false;
      cancelAnimationFrame(raf);
      t.textContent = 'Start';
      updateRing(ring, 0);
      markFinished(d, ring, true);
      return;
    }
    d.textContent = fmt(left);
    updateRing(ring, left / total);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || left <= 0) return;
    running = true;
    last = 0;
    markFinished(d, ring, false);
    raf = requestAnimationFrame(loop);
    t.textContent = 'Pause';
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    t.textContent = 'Start';
  }

  function reset() {
    pause();
    sync();
  }

  minI.addEventListener('input', sync);
  secI.addEventListener('input', sync);
  sync();

  t.addEventListener('click', () => (running ? pause() : start()));
  r.addEventListener('click', reset);
})();

// ===== Tabs =====
(function () {
  const tabs = document.querySelectorAll('.tab');
  const panels = {
    cook: document.getElementById('panel-cook'),
    sport: document.getElementById('panel-sport'),
    study: document.getElementById('panel-study'),
    general: document.getElementById('panel-general'),
  };
  function show(name) {
    Object.entries(panels).forEach(([k, el]) => (el.hidden = k !== name));
    tabs.forEach((t) =>
      t.setAttribute('aria-selected', String(t.dataset.tab === name)),
    );
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  // при загрузке уже открыт Cooking, но синхронизируем aria-selected
  show('cook');
})();

// ===== Theme toggle (Light/Dark) =====
(function () {
  const btn = document.getElementById('themeToggle');
  const root = document.documentElement;
  const saved = localStorage.getItem('timerhub_theme');
  if (saved) {
    root.setAttribute('data-theme', saved);
  }
  btn.addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (cur === 'light') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', 'dark');
    localStorage.setItem(
      'timerhub_theme',
      root.getAttribute('data-theme') || 'light',
    );
  });
})();

// ===== Hotkeys: Space (start/pause), R (reset) =====
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return; // не мешаем вводу в General
  }

  const panel = document.querySelector('section.card:not([hidden])');
  if (!panel) return;

  if (e.code === 'Space') {
    e.preventDefault();
    const toggleBtn = panel.querySelector('button.primary');
    if (toggleBtn) toggleBtn.click();
  }

  if (e.key === 'r' || e.key === 'R') {
    const resetBtn = panel.querySelector('button[id$="Reset"]');
    if (resetBtn) resetBtn.click();
  }
});
