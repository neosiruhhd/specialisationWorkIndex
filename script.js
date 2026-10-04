// this is the code that sets the tempo of the bars moving
const bpm = 140;
const barMS = (4 * 60000) / bpm; 

// total slots on the strip
const slots = 10;
// which slot the playhead is on
const head = 5;
// bars per section colour
const phrase = 4;

// section colours in an array, change between green, orange, yellow, red, then repeat
const colours = ['#43a047', '#fb8c00', '#fdd835', '#e53935'];

const timeline = document.getElementById('timeline');
// matching the bar number to the dot element
const dots = new Map();
// starting point for the time
const start = performance.now();
let lastBar = null;

// determining the colour of the bar
function colourOf(bar) {
  return colours[Math.floor(bar / phrase) % colours.length];
}

// cuts off the slots that are either negatively valued or valued over 10
function slotLeft(slot) {
  return 'calc(var(--slot) * ' + slot + ')';
}

// code for the 10 empty rings stuck in place behind the actively moving rings
for (let i = 0; i < slots; i++) {
  const slotEl = document.createElement('div');
  slotEl.className = 'slot';
  slotEl.style.left = slotLeft(i);
  slotEl.innerHTML = '<div class="ring"></div>';
  timeline.appendChild(slotEl);
}

// the update function runs once every bar, and works out which bars need to be on screen and moves them to their new slot
function update(current) {
    // const for the oldest bar (slot 0)
    const first = current - head;
    // const for the newewst bar (slot 9)
    const last = current + (slots - 1 - head);
    const fresh = [];

  // creates a dot for a visible bar that has yet to have one
  for (let bar = Math.max(0, first); bar <= last; bar++) {
    // if there is already a dot on the bar, skip to the next
    if (dots.has(bar)) continue; 

    const el = document.createElement('div');
    el.className = 'slot dot-slot';
    el.style.left = slotLeft(slots);
    // the dots coming from the right are invisible until it slides in
    el.style.opacity = '0';          
    el.innerHTML = '<div class="dot"></div>';
    el.firstChild.style.setProperty('--colour', colourOf(bar));

    // on the first refresh of the page, the dots appear slightly slower than usual, but then revert to the normal pacing with line 76
    el.style.transitionDelay = lastBar === null ? fresh.length * 0.11 + 's' : '0s';

    timeline.appendChild(el);
    dots.set(bar, el);
    fresh.push(el);
  }

  // confirms the values of the start and end positions so the browser can register the interpolation of position
  void timeline.offsetWidth;

  // move every dot
  dots.forEach((el, bar) => {
    // revert opening stagger once a dot is no longer brand new
    if (!fresh.includes(el)) el.style.transitionDelay = '0s';

    if (bar < first) {
      // if a dot has gone past 0, slide off and fade out, remove the element once the slide has finished animating out
      el.style.left = slotLeft(-1);
      el.style.opacity = '0';
      dots.delete(bar);
      setTimeout(() => el.remove(), 300);
    } else {
        // else, continue as normal and move the dot left by one bar
      el.style.left = slotLeft(bar - current + head);
      el.style.opacity = '1';
    }
  });
}

// this is the function to request each animation frame for the conveyor
function frame(now) {
  const bar = Math.floor((now - start) / barMS);
  if (bar !== lastBar) {
    update(bar);
    lastBar = bar;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);