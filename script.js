const maxHP = 500;
const idleMS = 3000;
const glowMS = 2000;

const hpInput = document.getElementById('hp');

// as its a circle, we literally have to use PI to calculate the circumference of the circle in order to apply the hp values to the circle accurately. crazy that PI is actually getting practical use outside of highschool
const arc = document.getElementById('arc');
const CIRCUMFERENCE = 2 * Math.PI * Number(arc.getAttribute('r'));

function limitHP() {
  const text = hpInput.value.trim();
  if (text === '') return null;

  const value = Math.round(Number(text));
  if (Number.isNaN(value)) return null;

  return Math.min(maxHP, Math.max(0, value));
}

// instead of a straight percentage applied to a column, the circle's outline needs to be trimmed
function render(hp) {
  // this converts the hp from health points to outline units
  const remaining = (hp / maxHP) * CIRCUMFERENCE;

  // const for stating the remainder of the circle that isnt filled/outlined
  const lost = CIRCUMFERENCE - remaining;



  // using both the values of how much of the circle is filled vs how much of it isnt, we're able to essentially slide or offset the fill shape to create the effect of the health depleting in either direction we want
  arc.style.strokeDasharray = remaining + ' ' + CIRCUMFERENCE;

  // the minus is what determines what direction the health will empty in, in this case emptying clockwise.
  arc.style.strokeDashoffset = -lost;
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