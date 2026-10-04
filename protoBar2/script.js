const bpm = 140;
const barMS = (4 * 60000) / bpm;
const slots = 10;
const head = 5;
const phrase = 4;

const colours = ['#43a047', '#fb8c00', '#fdd835', '#e53935'];

const timeline = document.getElementById('timeline');
const dots = new Map();
const start = performance.now();
let lastBar = null;

function colourOf(bar) {
  return colours[Math.floor(bar / phrase) % colours.length];
}

function slotLeft(slot) {
  return 'calc(var(--slot) * ' + slot + ')';
}

for (let i = 0; i < slots; i++) {
  const slotEl = document.createElement('div');
  slotEl.className = 'slot';
  slotEl.style.left = slotLeft(i);
  slotEl.innerHTML = '<div class="ring"></div>';
  timeline.appendChild(slotEl);
}

function update(current) {
  const first = current - head;
  const last = current + (slots - 1 - head);
  const fresh = [];

  for (let bar = Math.max(0, first); bar <= last; bar++) {
    if (dots.has(bar)) continue;

    const el = document.createElement('div');
    el.className = 'slot dot-slot';
    el.style.left = slotLeft(slots);
    el.style.opacity = '0';
    el.innerHTML = '<div class="dot"></div>';
    el.firstChild.style.setProperty('--colour', colourOf(bar));
    el.style.transitionDelay = lastBar === null ? fresh.length * 0.11 + 's' : '0s';

    timeline.appendChild(el);
    dots.set(bar, el);
    fresh.push(el);
  }

  void timeline.offsetWidth;

  dots.forEach((el, bar) => {
    if (!fresh.includes(el)) el.style.transitionDelay = '0s';

    if (bar < first) {
      el.style.left = slotLeft(-1);
      el.style.opacity = '0';
      dots.delete(bar);
      setTimeout(() => el.remove(), 300);
    } else {
      el.style.left = slotLeft(bar - current + head);
      el.style.opacity = '1';
    }
  });
}

function frame(now) {
  const bar = Math.floor((now - start) / barMS);
  if (bar !== lastBar) {
    update(bar);
    lastBar = bar;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);