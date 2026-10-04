// setting up constant values for js to refrence as anchored values.
const maxHP = 500;
// these are the timings for dictating how long the ui needs to be idle for glow to activate, and how long the glow lasts for WHEN it is activated
const idleMS = 5000;
const glowMS = 2000;

// these 2 consts are responsible for linking to the html elements
const hpInput = document.getElementById('hp');
const fill = document.getElementById('fill');

function limitHP() {
    const value = Math.round(Number(hpInput.value));
    if (Number.isNaN(value)) return null;
    return Math.min(maxHP, Math.max(0, value));
}

function render(hp) {
    fill.style.height = (hp / maxHP) * 100 + "%";
}

hpInput.addEventListener('input', () => {
    // const hp is made instead of referencing limitHP for efficiency of the information pull requests
    const hp = limitHP();
    if (hp !== null) render(hp);
});

// this code 'cleans' the user input number, in case they enter a value outside of the 0-500 range
hpInput.addEventListener('change', () => {
    const hp = limitHP();
    hpInput.value = hp === null ? maxHP : hp;
    render(Number(hpInput.value));
});

// this creates the 'memory' of the idleness so the glow knows when to activate when its been long enough
let lastActivity = performance.now();

// this code determines if the user has been away for long enough to activate the glow styling on the html elements
function onActivity () {
    const now = performance.now();
    if (now - lastActivity >= idleMS) {
        hpInput.classList.add('glow');
        setTimeout(() => hpInput.classList.remove('glow'), glowMS)
    }
    lastActivity = now;
}

// the 'mousedown' event listener makes it so that if any mouse button is pressed, it will activate the 'onActivity' function above
window.addEventListener('mousedown', onActivity);

// This is what makes limitHP appear at all in the final website appearance.
render(limitHP());