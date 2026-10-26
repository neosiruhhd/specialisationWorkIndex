// this code wrapped makes sure that all the js stays self contained. ill flesh out the functionality of it in later commits.
(() => {
    'use strict';
// HELPERS

  // this code will allow me to build an element entirely in one line: the tag, its attributes, then its children
  // 'class' sets the class, 'text' sets the text, anything starting with 'on' becomes an event listener,
  // and everything else becomes a normal attribute
  function el(tag, props = {}, kids = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    const list = Array.isArray(kids) ? kids : [kids];
    list.forEach((kid) => {
      if (kid) node.appendChild(kid);
    });
    return node;
  }

  // HP RING

  // full length of the ring's outline (radius 50)
  const ringLength = 2 * Math.PI * 50;

  // builds one ring: grey track, dark core for the numbers, red arc on top,
  // plus an empty stack in the centre for the hp numbers to go in
  function makeRing() {
    const wrap = el('div', { class: 'ringwrap' });
    wrap.innerHTML =
      '<svg class="hpring" viewBox="0 0 120 120" aria-hidden="true">' +
        '<circle class="hptrack" cx="60" cy="60" r="50"></circle>' +
        '<circle class="hpcore" cx="60" cy="60" r="43"></circle>' +
        '<circle class="hparc" cx="60" cy="60" r="50"></circle>' +
      '</svg>';
    const stack = el('div', { class: 'hpstack' });
    wrap.appendChild(stack);
    return { wrap, arc: wrap.querySelector('.hparc'), stack };
  }

  // same maths as protohealth2: the dash is the remaining share of the ring and the negative offset makes the gap open at 12 o'clock and grow clockwise
  function setFill(arc, cur, max) {
    const c = Number(cur);
    const m = Number(max);
    const share = (Number.isFinite(c) && m > 0) ? Math.max(0, Math.min(1, c / m)) : 0;
    const remaining = share * ringLength;
    arc.style.strokeDasharray = remaining + ' ' + ringLength;
    arc.style.strokeDashoffset = -(ringLength - remaining);
  }

  // SETUP STATE
  // the party and boss are saved in this browser so a refresh doesn't wipe them

  const storageKey = 'sirens.setup.v1';
  let uid = 1; // this gives every pc a unique id, used for element ids

  const blankSetup = () => ({ pcs: [], boss: { name: '', max: '1000' } });

  // reads the saved setup, or starts blank if there's nothing saved (or it's broken)
  function loadSetup() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.pcs) && saved.boss) {
        saved.pcs = saved.pcs.slice(0, 6).map((p) => ({
          id: uid++,
          name: String(p.name || ''),
          cur: String(p.cur ?? ''),
          max: String(p.max ?? ''),
        }));
        saved.boss = { name: String(saved.boss.name || ''), max: String(saved.boss.max ?? '') };
        return saved;
      }
    } catch (e) {
      // if nothing has been saved yet or if the storage is blocked, fallback is simply a blank setup screen
    }
    return blankSetup();
  }

  // thiss will translate the setup back to the browser
  function saveSetup() {
    try {
      const pcs = setup.pcs.map(({ name, cur, max }) => ({ name, cur, max }));
      localStorage.setItem(storageKey, JSON.stringify({ pcs, boss: setup.boss }));
    } catch (e) {
      // if the storage is blocked, the setup will still work, it just won't survive a refresh
    }
  }

  let setup = loadSetup();

  // SETUP SCREEN

  // redraws every column from the setup data
  function renderSetup() {
    const party = $('#setup-party');
    party.textContent = '';
    setup.pcs.forEach((pc) => party.appendChild(setupPC(pc)));

    // sirens only supports up to 6 pcs. if there are less than 5, the last column is the add pc slot
    if (setup.pcs.length < 6) {
      const addButton = el('button', {
        class: 'addslot',
        type: 'button',
        text: '+ Add PC',
        onclick: () => {
          const pc = { id: uid++, name: '', cur: '', max: '' };
          setup.pcs.push(pc);
          saveSetup();
          renderSetup();
          document.getElementById('pc-name-' + pc.id).focus();
        },
      });
      const ghost = el('div', { class: 'ringwrap' }, el('div', { class: 'ghostring' }));
      party.appendChild(el('div', { class: 'char' }, [addButton, ghost]));
    }

    renderSetupBoss();
  }

  // makes the current and max hp fields for one character and shows them on its ring
  // the boss always starts at full hp, so its 'current health' field is read-only and copies max
  function hpInputs(obj, arc, bossMode) {
    const cur = el('input', { class: 'hp hp-cur', type: 'text', inputmode: 'numeric', 'aria-label': 'Current HP', autocomplete: 'off' });
    const max = el('input', { class: 'hp hp-max', type: 'text', inputmode: 'numeric', 'aria-label': 'Max HP', autocomplete: 'off' });
    max.value = obj.max;
    if (bossMode) {
      cur.readOnly = true;
      cur.tabIndex = -1;
      cur.value = obj.max;
      cur.title = 'The boss always starts at full HP';
    } else {
      cur.value = obj.cur;
    }
    setFill(arc, bossMode ? obj.max : obj.cur, obj.max);
    return { cur, max };
  }

  // one pc column: name box with a remove button, then the hp ring with both fields inside
  function setupPC(pc) {
    const ring = makeRing();
    const name = el('input', { class: 'name-in', id: 'pc-name-' + pc.id, type: 'text', placeholder: 'Name', 'aria-label': 'PC name', maxlength: '24', autocomplete: 'off' });
    name.value = pc.name;

    const { cur, max } = hpInputs(pc, ring.arc, false);
    ring.stack.append(cur, el('div', { class: 'hpdiv' }), max);

    const remove = el('button', {
      class: 'remove',
      type: 'button',
      'aria-label': 'Remove this PC',
      text: '\u00d7', 
      onclick: () => {
        setup.pcs = setup.pcs.filter((p) => p !== pc);
        saveSetup();
        renderSetup();
      },
    });

    return el('div', { class: 'char' }, [
      el('div', { class: 'namebox' }, [name, remove]),
      ring.wrap,
    ]);
  }

  // the boss column in the right rail: same as a pc but no remove button
  function renderSetupBoss() {
    const rail = $('#setup-boss');
    rail.textContent = '';
    const boss = setup.boss;
    const ring = makeRing();
    const name = el('input', { class: 'name-in', id: 'boss-name', type: 'text', placeholder: 'Boss', 'aria-label': 'Boss name', maxlength: '24', autocomplete: 'off' });
    name.value = boss.name;

    const { cur, max } = hpInputs(boss, ring.arc, true);
    ring.stack.append(cur, el('div', { class: 'hpdiv' }), max);

    rail.appendChild(el('div', { class: 'char boss-col' }, [
      el('div', { class: 'namebox' }, name),
      ring.wrap,
    ]));
  }

  // BOOT
  renderSetup();
    const $ = (selector) => document.querySelector(selector);
})();