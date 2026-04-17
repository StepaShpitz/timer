/* =====================================================
   TimerHub — Full Script
   Features: Cooking, Sport, HIIT, Pomodoro, Stopwatch, Custom
   ===================================================== */

'use strict';

// ─── Audio ───────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function beep(freq = 880, duration = 0.15, type = 'sine', gain = 0.4) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.start(); osc.stop(ac.currentTime + duration);
  } catch(e) { /* silently ignore */ }
}

function playFinish() {
  // 3 rising beeps
  beep(660, 0.12, 'sine', 0.4);
  setTimeout(() => beep(880, 0.12, 'sine', 0.4), 150);
  setTimeout(() => beep(1100, 0.25, 'sine', 0.5), 300);
}

function playTick() { beep(1200, 0.05, 'square', 0.15); }
function playPhase() { beep(770, 0.18, 'triangle', 0.4); }

// wake AudioContext on first user gesture
document.addEventListener('pointerdown', () => getCtx(), { once: true });

// ─── Helpers ─────────────────────────────────────────
const $ = id => document.getElementById(id);

function fmtMS(sec) {
  sec = Math.max(0, sec);
  const m  = Math.floor(sec / 60);
  const s  = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtMSms(sec) {
  sec = Math.max(0, sec);
  const m  = Math.floor(sec / 60);
  const s  = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
}

function setRing(ringEl, fraction, totalFraction = fraction) {
  const r    = 98;
  const circ = 2 * Math.PI * r;
  ringEl.style.strokeDasharray  = circ;
  ringEl.style.strokeDashoffset = circ * (1 - Math.max(0, Math.min(1, fraction)));
}

function setFinished(displayEl, ringEl, yes) {
  displayEl.classList.toggle('finished', yes);
  ringEl.classList.toggle('finished', yes);
}

// ─── Generic Countdown Factory ────────────────────────
function makeCountdown({ displayId, toggleId, resetId, ringId, labelId, defaultSec, presetsSelector, onFinish }) {
  const display  = $(displayId);
  const toggle   = $(toggleId);
  const reset    = $(resetId);
  const ring     = $(ringId);
  const label    = labelId ? $(labelId) : null;
  const presets  = presetsSelector ? Array.from(document.querySelectorAll(presetsSelector)) : [];

  let total = defaultSec, left = defaultSec;
  let running = false, last = 0, raf;

  function render() {
    display.textContent = fmtMS(left);
    setRing(ring, total > 0 ? left / total : 0);
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left = Math.max(0, left - dt);
    render();
    if (left <= 0) {
      running = false;
      toggle.textContent = 'Start';
      setFinished(display, ring, true);
      if (label) label.textContent = 'done!';
      playFinish();
      if (onFinish) onFinish();
      return;
    }
    // tick in last 3 seconds
    if (left < 3.5 && Math.floor(left + dt) !== Math.floor(left)) playTick();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || left <= 0) return;
    running = true; last = 0;
    setFinished(display, ring, false);
    if (label) label.textContent = 'running';
    toggle.textContent = 'Pause';
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
    if (label) label.textContent = 'paused';
  }
  function doReset() {
    pause(); left = total;
    setFinished(display, ring, false);
    if (label) label.textContent = 'ready';
    render();
  }

  toggle.addEventListener('click', () => running ? pause() : start());
  reset.addEventListener('click', doReset);

  presets.forEach(b => {
    const v = +(b.dataset.cook || b.dataset.sport || b.dataset.study || 0);
    b.addEventListener('click', () => {
      if (!v) return;
      total = v; left = v;
      presets.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      setFinished(display, ring, false);
      if (label) label.textContent = 'ready';
      if (running) pause();
      render();
    });
  });

  render();
  return { start, pause, doReset, getLeft: () => left, isRunning: () => running };
}

// ─── COOKING ──────────────────────────────────────────
makeCountdown({
  displayId: 'cookDisplay', toggleId: 'cookToggle', resetId: 'cookReset',
  ringId: 'cookRing', labelId: 'cookLabel',
  defaultSec: 180, presetsSelector: '[data-cook]'
});

// ─── SPORT ────────────────────────────────────────────
makeCountdown({
  displayId: 'sportDisplay', toggleId: 'sportToggle', resetId: 'sportReset',
  ringId: 'sportRing', labelId: 'sportLabel',
  defaultSec: 30, presetsSelector: '[data-sport]'
});

// ─── HIIT ─────────────────────────────────────────────
(function () {
  const display   = $('hiitDisplay');
  const toggle    = $('hiitToggle');
  const reset     = $('hiitReset');
  const ring      = $('hiitRing');
  const badge     = $('hiitPhaseBadge');
  const roundDisp = $('hiitRoundDisplay');
  const totalDisp = $('hiitTotalDisplay');
  const workI     = $('hiitWork');
  const restI     = $('hiitRest');
  const roundsI   = $('hiitRounds');

  let workSec, restSec, totalRounds, curRound, phase, left, total;
  let running = false, last = 0, raf;

  function getInputs() {
    workSec     = Math.max(1, +workI.value  || 20);
    restSec     = Math.max(1, +restI.value  || 10);
    totalRounds = Math.max(1, +roundsI.value || 8);
    totalDisp.textContent = totalRounds;
  }

  function init() {
    getInputs();
    curRound = 1; phase = 'work';
    left = workSec; total = workSec;
    roundDisp.textContent = curRound;
    badge.textContent = 'WORK';
    badge.className = 'hiit-phase-badge';
    setFinished(display, ring, false);
    display.textContent = fmtMS(left);
    setRing(ring, 1);
  }

  function nextPhase() {
    if (phase === 'work') {
      phase = 'rest';
      left = restSec; total = restSec;
      badge.textContent = 'REST';
      badge.className = 'hiit-phase-badge rest';
      playPhase();
    } else {
      curRound++;
      if (curRound > totalRounds) {
        // done!
        running = false;
        toggle.textContent = 'Start';
        badge.textContent = 'DONE';
        badge.className = 'hiit-phase-badge done';
        setFinished(display, ring, true);
        playFinish();
        return false;
      }
      roundDisp.textContent = curRound;
      phase = 'work';
      left = workSec; total = workSec;
      badge.textContent = 'WORK';
      badge.className = 'hiit-phase-badge';
      playPhase();
    }
    return true;
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left = Math.max(0, left - dt);
    display.textContent = fmtMS(left);
    setRing(ring, total > 0 ? left / total : 0);
    if (left <= 0) {
      if (!nextPhase()) return;
    }
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true; last = 0;
    setFinished(display, ring, false);
    toggle.textContent = 'Pause';
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
  }

  toggle.addEventListener('click', () => running ? pause() : start());
  reset.addEventListener('click', () => { pause(); init(); });
  [workI, restI, roundsI].forEach(el => el.addEventListener('input', () => { if (!running) init(); }));

  init();
})();

// ─── POMODORO ─────────────────────────────────────────
(function () {
  const display    = $('pomDisplay');
  const toggle     = $('pomToggle');
  const skip       = $('pomSkip');
  const reset      = $('pomReset');
  const ring       = $('pomRing');
  const phaseLabel = $('pomPhaseLabel');
  const dotsEl     = $('pomDots');
  const focusI     = $('pomFocusMin');
  const shortI     = $('pomShortMin');
  const longI      = $('pomLongMin');

  // Phases: focus → short → focus → short → focus → short → focus → long (repeat)
  let completed = 0; // completed focus sessions
  let phase = 'focus'; // 'focus' | 'short' | 'long'
  let left, total;
  let running = false, last = 0, raf;

  function getSec(phase) {
    if (phase === 'focus') return Math.max(1, +focusI.value || 25) * 60;
    if (phase === 'short') return Math.max(1, +shortI.value || 5)  * 60;
    return Math.max(1, +longI.value || 15) * 60;
  }

  function renderDots() {
    dotsEl.innerHTML = '';
    const total = 4;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = 'pom-dot' + (i < completed % 4 ? ' done' : '');
      dotsEl.appendChild(d);
    }
  }

  function setPhase(p) {
    phase = p;
    left = getSec(p); total = left;
    const labels = { focus: 'Focus 🎯', short: 'Short Break ☕', long: 'Long Break 🛌' };
    phaseLabel.textContent = labels[p];
    display.textContent = fmtMS(left);
    setRing(ring, 1);
    setFinished(display, ring, false);
  }

  function nextPhase() {
    if (phase === 'focus') {
      completed++;
      renderDots();
      playPhase();
      // every 4 pomodoros → long break
      setPhase(completed % 4 === 0 ? 'long' : 'short');
    } else {
      playPhase();
      setPhase('focus');
    }
  }

  function init() {
    completed = 0;
    setPhase('focus');
    renderDots();
    if (running) { running = false; cancelAnimationFrame(raf); toggle.textContent = 'Start'; }
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left = Math.max(0, left - dt);
    display.textContent = fmtMS(left);
    setRing(ring, total > 0 ? left / total : 0);
    if (left < 3.5 && Math.floor(left + dt) !== Math.floor(left)) playTick();
    if (left <= 0) {
      playFinish();
      running = false; toggle.textContent = 'Start';
      nextPhase();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true; last = 0;
    setFinished(display, ring, false);
    toggle.textContent = 'Pause';
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
  }

  toggle.addEventListener('click', () => running ? pause() : start());
  skip.addEventListener('click', () => { pause(); nextPhase(); });
  reset.addEventListener('click', () => { pause(); init(); });
  [focusI, shortI, longI].forEach(el => el.addEventListener('input', () => { if (!running) setPhase(phase); }));

  init();
})();

// ─── STOPWATCH ────────────────────────────────────────
(function () {
  const display = $('swDisplay');
  const toggle  = $('swToggle');
  const lapBtn  = $('swLap');
  const reset   = $('swReset');
  const ring    = $('swRing');
  const lapList = $('lapList');

  let elapsed = 0, lapStart = 0, running = false, last = 0, raf;
  let lapTimes = [];

  const RING_CYCLE = 60; // ring loops every 60 sec

  function render() {
    display.textContent = fmtMSms(elapsed);
    setRing(ring, (elapsed % RING_CYCLE) / RING_CYCLE);
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    elapsed += dt;
    render();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true; last = 0;
    toggle.textContent = 'Pause';
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
  }

  function addLap() {
    if (!running && elapsed === 0) return;
    const lapTime = elapsed - lapStart;
    lapStart = elapsed;
    lapTimes.push({ total: elapsed, lap: lapTime });
    const li = document.createElement('li');
    li.className = 'lap-item';
    const num = lapTimes.length;
    const best = num > 1 ? lapTimes.reduce((a,b) => a.lap < b.lap ? a : b) : null;
    const worst = num > 1 ? lapTimes.reduce((a,b) => a.lap > b.lap ? a : b) : null;
    let color = '';
    if (num > 1) {
      if (lapTime === best.lap)  color = 'color: var(--success)';
      if (lapTime === worst.lap) color = 'color: var(--danger)';
    }
    li.innerHTML = `
      <span class="lap-num">Lap ${num}</span>
      <span class="lap-time" style="${color}">${fmtMSms(lapTime)}</span>
      <span class="lap-delta">${fmtMSms(elapsed)}</span>
    `;
    lapList.prepend(li);
    playTick();
  }

  function doReset() {
    pause();
    elapsed = 0; lapStart = 0; lapTimes = [];
    lapList.innerHTML = '';
    render();
    toggle.textContent = 'Start';
  }

  toggle.addEventListener('click', () => running ? pause() : start());
  lapBtn.addEventListener('click', addLap);
  reset.addEventListener('click', doReset);

  render();
})();

// ─── CUSTOM (General) ─────────────────────────────────
(function () {
  const display = $('generalDisplay');
  const toggle  = $('generalToggle');
  const reset   = $('generalReset');
  const ring    = $('generalRing');
  const label   = $('generalLabel');
  const hourI   = $('generalHour');
  const minI    = $('generalMin');
  const secI    = $('generalSec');

  let total = 30, left = 30, running = false, last = 0, raf;

  function sync() {
    total = (+hourI.value||0)*3600 + (+minI.value||0)*60 + (+secI.value||0);
    left = total;
    display.textContent = fmtMS(left);
    setRing(ring, total > 0 ? 1 : 0);
    setFinished(display, ring, false);
    if (label) label.textContent = 'ready';
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    left = Math.max(0, left - dt);
    display.textContent = fmtMS(left);
    setRing(ring, total > 0 ? left / total : 0);
    if (left < 3.5 && Math.floor(left + dt) !== Math.floor(left)) playTick();
    if (left <= 0) {
      running = false; toggle.textContent = 'Start';
      setFinished(display, ring, true);
      if (label) label.textContent = 'done!';
      playFinish();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || left <= 0) return;
    running = true; last = 0;
    setFinished(display, ring, false);
    if (label) label.textContent = 'running';
    toggle.textContent = 'Pause';
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf);
    toggle.textContent = 'Start';
    if (label) label.textContent = 'paused';
  }
  function doReset() { pause(); sync(); }

  [hourI, minI, secI].forEach(el => el.addEventListener('input', () => { if (!running) sync(); }));
  toggle.addEventListener('click', () => running ? pause() : start());
  reset.addEventListener('click', doReset);
  sync();
})();

// ─── TAB SWITCHING ────────────────────────────────────
(function () {
  const tabs   = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.card');

  function show(name) {
    panels.forEach(p => { p.hidden = p.id !== `panel-${name}`; });
    tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
  }

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  show('cook');
})();

// ─── THEME ────────────────────────────────────────────
(function () {
  const btn  = $('themeToggle');
  const root = document.documentElement;
  const icon = btn.querySelector('.theme-icon');

  function apply(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      icon.textContent = '🌙';
    } else {
      root.removeAttribute('data-theme');
      icon.textContent = '☀️';
    }
    localStorage.setItem('timerhub_theme', theme);
  }

  const saved = localStorage.getItem('timerhub_theme') || 'dark';
  apply(saved);

  btn.addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(cur);
  });
})();

// ─── HOTKEYS ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const panel = document.querySelector('.card:not([hidden])');
  if (!panel) return;

  if (e.code === 'Space') {
    e.preventDefault();
    panel.querySelector('.btn-primary')?.click();
  }
  if (e.key === 'r' || e.key === 'R') {
    panel.querySelector('[id$="Reset"]')?.click();
  }
  if (e.key === 'l' || e.key === 'L') {
    $('swLap')?.click();
  }
});
