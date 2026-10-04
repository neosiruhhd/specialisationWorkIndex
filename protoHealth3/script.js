const maxHP = 500;
const idleMS = 3000;
const glowMS = 2000;

// based off of the values from the svg viewbox, these consts are numbered based off of how far the clipped rectangl fill will travel
const heartTop = 2;
const heartBottom = 90;

const hpInput = document.getElementById('hp');

// this is targetting the clipped rectangle, rather than a fill like in proto1 or an arc for the circle in proto2
const level = document.getElementById('level');

function limitHP() {
  const text = hpInput.value.trim();
  if (text === '') return null;

  const value = Math.round(Number(text));
  if (Number.isNaN(value)) return null;

  return Math.min(maxHP, Math.max(0, value));
}

// this function is what slides the clipped rectangle up and down
function render(hp) {
  // the span const calculates the range from the top of the heart to the bottom to figure out the range/span the clipped rectangle can travel across
  const span = heartBottom - heartTop;

  // this line converts the hp into a y positioning that can be fed to the transform code
  const top = heartBottom - (hp / maxHP) * span;

  // this line descends the clipped rectangle from the top of the svg's viewbox and repositions it depending on the value of the hp
  level.style.transform = 'translateY(' + top + 'px)';
}

hpInput.addEventListener('input', () => {
  const hp = limitHP();
  if (hp !== null) render(hp);
});

hpInput.addEventListener('change', () => {
  const hp = limitHP();
  const fixed = hp === null ? maxHP : hp;
  hpInput.value = fixed;
  render(fixed);
});

let lastActivity = performance.now();

function onActivity() {
  const now = performance.now();
  if (now - lastActivity >= idleMS) {
    hpInput.classList.add('glow');
    setTimeout(() => hpInput.classList.remove('glow'), glowMS);
  }
  lastActivity = now;
}

window.addEventListener('mousedown', onActivity);

render(limitHP());