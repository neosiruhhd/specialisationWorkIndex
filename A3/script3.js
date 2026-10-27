// this code wrapped makes sure that all the js stays self contained. ill flesh out the functionality of it in later commits.
(() => {
    'use strict';
    const $ = (selector) => document.querySelector(selector);

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

  // keeps only up to 6 digits and drops leading zeros
  const digits = (text) => {
    const only = text.replace(/\D/g, '').slice(0, 6);
    return only.length > 1 ? String(Number(only)) : only;
  };

  // true when the text is a whole number and nothing else
  const isInt = (text) => /^\d+$/.test(text);

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

  // MUSIC DATA
  // the song is cut into six files: an intro, four looping sections (one per hp range) and an outro
  // bars is how long each file is in bars, loop says whether it repeats, colour is its timeline colour (later commit)
  const sections = {
    intro: { file: 'audio/intro.wav', bars: 8, loop: false, colour: 'var(--sec-intro)' },
    t1: { file: 'audio/100-50.wav', bars: 24, loop: true, colour: 'var(--sec-t1)' },
    t2: { file: 'audio/50-35.wav', bars: 16, loop: true, colour: 'var(--sec-t2)' },
    t3: { file: 'audio/35-20.wav', bars: 16, loop: true, colour: 'var(--sec-t3)' },
    t4: { file: 'audio/20-0.wav', bars: 16, loop: true, colour: 'var(--sec-t4)' },
    outro: { file: 'audio/outro.wav', bars: 12, loop: false, colour: 'var(--sec-intro)' },
  };

  // MUSIC RULES

  // which looping section of the song matches a share of hp (measured from 0 to 1)
  // representing different intensities of the song's instrumentals, from most passive to most aggressive: t1 = 100 to 50%, t2 = 50 to 35%, t3 = 35 to 20%, t4 = 20 to 0%
  function tierFor(share) {
    if (share <= 0.20) return 't4';
    if (share <= 0.35) return 't3';
    if (share <= 0.50) return 't2';
    return 't1';
  }

  // the section the music should be heading to, worked out every time hp is confirmed
  let desired = 't1';

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
    validateSetup();
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
      // process for typing a current hp: clean it, store it, update the ring, save, then recheck the setup
      cur.addEventListener('input', () => {
        cur.value = digits(cur.value);
        obj.cur = cur.value;
        setFill(arc, obj.cur, obj.max);
        saveSetup();
        validateSetup();
      });
    }

    // typing a max hp: the same steps, and the boss's current hp copies its new max
    max.addEventListener('input', () => {
      max.value = digits(max.value);
      obj.max = max.value;
      if (bossMode) cur.value = obj.max;
      setFill(arc, bossMode ? obj.max : obj.cur, obj.max);
      saveSetup();
      validateSetup();
    });

    setFill(arc, bossMode ? obj.max : obj.cur, obj.max);
    return { cur, max };
  }

  // one pc column: name box with a remove button, then the hp ring with both fields inside
  function setupPC(pc) {
    const ring = makeRing();
    const name = el('input', { class: 'name-in', id: 'pc-name-' + pc.id, type: 'text', placeholder: 'Name', 'aria-label': 'PC name', maxlength: '24', autocomplete: 'off' });
    name.value = pc.name;
    name.addEventListener('input', () => {
      pc.name = name.value;
      saveSetup();
      validateSetup();
    });

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

    const col = el('div', { class: 'char' }, [
      el('div', { class: 'namebox' }, [name, remove]),
      ring.wrap,
    ]);

    // each column has its own step by step check: a name, a max hp of 1 or more, and a current hp between 1 and max
    // a field that's filled in but wrong gets the red outline, an empty one doesn't, added  bad styling to css in a previous commit
    col._check = () => {
      const okMax = isInt(pc.max) && Number(pc.max) >= 1;
      const okCur = isInt(pc.cur) && Number(pc.cur) >= 1 && (!okMax || Number(pc.cur) <= Number(pc.max));
      max.classList.toggle('bad', pc.max !== '' && !okMax);
      cur.classList.toggle('bad', pc.cur !== '' && !okCur);
      return pc.name.trim() !== '' && okMax && okCur;
    };

    return col;
  }

  // the boss column in the right rail: same as a pc but no remove button
  function renderSetupBoss() {
    const rail = $('#setup-boss');
    rail.textContent = '';
    const boss = setup.boss;
    const ring = makeRing();
    const name = el('input', { class: 'name-in', id: 'boss-name', type: 'text', placeholder: 'Boss', 'aria-label': 'Boss name', maxlength: '24', autocomplete: 'off' });
    name.value = boss.name;
    name.addEventListener('input', () => {
      boss.name = name.value;
      saveSetup();
      validateSetup();
    });

    const { cur, max } = hpInputs(boss, ring.arc, true);
    ring.stack.append(cur, el('div', { class: 'hpdiv' }), max);

    const col = el('div', { class: 'char boss-col' }, [
      el('div', { class: 'namebox' }, name),
      ring.wrap,
    ]);

    // the boss only needs a name and a max hp of 1 or more
    col._check = () => {
      const okMax = isInt(boss.max) && Number(boss.max) >= 1;
      max.classList.toggle('bad', boss.max !== '' && !okMax);
      return boss.name.trim() !== '' && okMax;
    };

    rail.appendChild(col);
  }

  // VALIDATION
  // the combat screen button only unlocks when there's at least one pc and every column passes its check
  function validateSetup() {
    let ok = setup.pcs.length >= 1;
    document.querySelectorAll('#setup .char').forEach((col) => {
      if (col._check && !col._check()) ok = false;
    });
    const button = $('#to-combat');
    button.disabled = !ok;
    button.title = ok ? '' : 'Add at least one PC, then give every character a name, a max HP of 1 or more, and a current HP between 1 and max.';
    return ok;
  }

  // reset wipes the party and boss back to a first visit
  $('#reset').addEventListener('click', () => {
    setup = blankSetup();
    saveSetup();
    renderSetup();
  });

  // the combat screen button takes the current setup into combat
  $('#to-combat').addEventListener('click', () => {
    if (validateSetup()) showCombat();
  });

  // COMBAT SCREEN

  // the characters in this fight, rebuilt from the setup every time combat opens
  // each one holds its name, max hp, current hp and whether it's the boss, plus its ring arc and hp field once they're drawn
  let chars = [];

  // copies the setup into numbers for combat, swaps the screens over, then draws the columns
    function showCombat() {
    chars = setup.pcs.map((p) => ({
      name: p.name.trim(),
      max: Number(p.max),
      cur: Number(p.cur),
      boss: false,
    }));
    chars.push({
      name: setup.boss.name.trim(),
      max: Number(setup.boss.max),
      cur: Number(setup.boss.max),
      boss: true,
    });
    phase = 'ready';
    renderCombat();
    clearTimeline();
    $('#setup').hidden = true;
    $('#combat').hidden = false;
    $('#ended').hidden = true;
    lastActivity = performance.now(); // a fresh combat screen never starts out idle
    refresh();
  }

    // one column per character: pcs across the stage, the boss in the right rail
  // current hp is an input so the dm can type over it, max hp is plain text since it cant be modified after moving on from the setup screen
  function renderCombat() {
    const party = $('#combat-party');
    const rail = $('#combat-boss');
    party.textContent = '';
    rail.textContent = '';

    chars.forEach((c, i) => {
      const ring = makeRing();
      c.arc = ring.arc;
      c.input = el('input', { class: 'hp hp-cur', id: 'hp-' + i, type: 'text', inputmode: 'numeric', 'aria-label': c.name + ' current HP', autocomplete: 'off' });
      c.input.value = String(c.cur);

      // typing: digits only, never above max, and the ring previews the new value straight away
      c.input.addEventListener('input', () => {
        let typed = digits(c.input.value);
        if (typed !== '' && Number(typed) > c.max) typed = String(c.max);
        c.input.value = typed;
        showChar(c);
        updatePending();
      });

      // leaving a field empty puts its confirmed hp back
      c.input.addEventListener('blur', () => {
        if (c.input.value === '') {
          c.input.value = String(c.cur);
          showChar(c);
          updatePending();
        }
      });

      // enter confirms every pending change, escape undoes them
      c.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmHP();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          undoHP();
          c.input.blur();
        }
      });

      ring.stack.append(c.input, el('div', { class: 'hpdiv' }), el('span', { class: 'hp hp-max', text: String(c.max) }));

      const col = el('div', { class: 'char' + (c.boss ? ' boss-col' : '') }, [
        el('div', { class: 'char-name', text: c.name }),
        ring.wrap,
      ]);
      (c.boss ? rail : party).appendChild(col);
      showChar(c);
    });
    updatePending();
  }

  // HP ENTRY
  // nothing typed counts until confirm, so the dm can change several characters and submit their updated hp values all at once

  // what a ring should show right now: the typed value if there is one, otherwise the confirmed hp
  function shownHP(c) {
    return c.input.value === '' ? c.cur : Number(c.input.value);
  }

  function showChar(c) {
    setFill(c.arc, shownHP(c), c.max);
  }

  // a change is defined as 'isPending' when something is typed and it's different from the confirmed hp
  function isPending(c) {
    return c.input.value !== '' && Number(c.input.value) !== c.cur;
  }

  // every pending field gets the white box, and undo and confirm only show while at least one of the health values is pending
  function updatePending() {
    let any = false;
    for (const c of chars) {
      const pending = isPending(c);
      c.input.classList.toggle('pending', pending);
      if (pending) any = true;
    }
    $('#hp-actions').hidden = !any;
  }

  // reverts every field and ring back to the previously confirmed hp
  function undoHP() {
    for (const c of chars) {
      c.input.value = String(c.cur);
      showChar(c);
    }
    updatePending();
  }

  // the music follows whoever is in the most danger: the lowest share of hp across the whole fight
  // if the boss is down to 0 the battle is won, so the music automatically transitions to the outro audio
  function computeDesired() {
    const boss = chars.find((c) => c.boss);
    if (boss && boss.cur === 0) return 'outro';
    let lowest = Infinity;
    for (const c of chars) lowest = Math.min(lowest, c.cur / c.max);
    return tierFor(lowest);
  }

    // when the dm hits the confirm button, locks in every typed value as the new confirmed hp, then works out which section the music should move to
    function confirmHP() {
    if (!hpEditable()) return;
    for (const c of chars) {
      if (c.input.value !== '') c.cur = Math.max(0, Math.min(c.max, Number(c.input.value)));
      c.input.value = String(c.cur);
      showChar(c);
    }
    desired = computeDesired();
    if (desired === 'outro') {
      outroQueued = true;
      cancelEndArm();
    }
    updatePending();
    plan();
  }

  $('#undo').addEventListener('click', undoHP);
  $('#confirm').addEventListener('click', confirmHP);

  // AUDIO ENGINE
  // built on the web audio api, each file is played from exact times on the audio clock provided by the api

  const minLead = 0.05; // this is the minimum lead time, the seconds of warning anything scheduled needs, so it never accidentally gets set in the past
  const ramp = 0.004;   // seconds, a tiny fade at a cut so the speaker doesn't click
  const phrase = 4;     // changes land on a 4-bar grid, counted from the first bar of the intro

  // riser for a short build-up sound that plays into every change between sections to help smoothen the transition
  // hit is how many seconds into the file its peak is, so the peak of the riser can be lined up with the cut
  // gain turns -2.75 db into a volume multiplier (about 0.73) so it sits under the music
  const riser = { file: 'audio/riser.wav', hit: 1.240, gain: Math.pow(10, -2.75 / 20) };
  const riserMargin = 0.03; // seconds, skip the riser if it can't start at least this far ahead
  const pauseFade = 0.01;   // seconds, how long pause and play take to fade out and back in
  const concludeAt = 17.7;  // seconds into the outro when its sound has finished, the battle counts as over then

  let ctx = null;     // the audio context: the browser's audio engine and its clock
  let fader = null;   // a gain (volume) stage used for the pause and play fades
  let master = null;  // a second gain stage that follows the volume slider
  const buffers = {}; // the decoded audio, one per section
  let loadedCount = 0;
  let loadFailed = false;
  let volume = 50;    // percent, set by the volume slider

  // sets up the audio context and its two gain stages, then downloads every section file
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      loadFailed = true;
      return;
    }
    // the files are 48khz, so asking for the same rate avoids audio resampling
    try {
      ctx = new AC({ sampleRate: 48000 });
    } catch (e) {
      ctx = new AC();
    }
    fader = ctx.createGain();
    master = ctx.createGain();
    fader.connect(master);
    master.connect(ctx.destination);
    master.gain.value = volume / 100;

    // the riser loads separately, if it somehow fails to load the transitions still work, just without it
    fetch(riser.file)
      .then((response) => {
        if (!response.ok) throw new Error(response.status);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        riser.buf = buffer;
      })
      .catch(() => {});


    for (const [key, s] of Object.entries(sections)) {
      fetch(s.file)
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          buffers[key] = buffer;
          // this file's own bar length, so its bar lines match exactly where it was cut
          s.barLen = buffer.duration / s.bars;
          loadedCount++;
          refresh();
        })
        .catch(() => {
          loadFailed = true;
          refresh();
        });
    }
  }

  const allLoaded = () => loadedCount === Object.keys(sections).length;

  // PLAYBACK
  // a segment is one continuous run of one file, starting at a set time (t0) on the audio clock
  // serial0 is the bar number it starts on, counted from the first bar of the intro, the timeline uses it later

  let segs = [];
  let segVersion = 0; // goes up every time a segment is added, so the timeline knows to redraw
  let running = false;
  let paused = false;
  let outroQueued = false; // true from the moment the outro is on its way, which locks hp editing
  let phase = 'ready'; // ready phase is for before begin combat, combat, or ended

  // creates a player for one section, wires it through its own gain into the fader, and schedules it
  function makeSeg(sec, t0, offset, serial0, fadeIn) {
    const s = sections[sec];
    const src = ctx.createBufferSource();
    src.buffer = buffers[sec];
    if (s.loop) {
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = src.buffer.duration;
    }
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(fader);
    if (fadeIn) {
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(1, t0 + ramp);
    }
    src.start(t0, offset);
    const seg = { sec, t0, offset, serial0, src, gain };
    segs.push(seg);
    segVersion++;
    return seg;
  }

  // the segment playing at time t: the last one that has started by then
  function segAt(t) {
    let found = null;
    for (const g of segs) {
      if (g.t0 <= t) found = g;
    }
    return found;
  }

  // the section playing right now, or null if read before combat starts
  function currentSec() {
    if (!running) return null;
    const g = segAt(ctx.currentTime);
    return g ? g.sec : null;
  }

    // fades a segment out over the last few milliseconds before tb (time of the bar line), then stops it exactly at tb
  function cutOut(seg, tb) {
    const level = seg.gain.gain;
    level.cancelScheduledValues(0);
    level.setValueAtTime(1, Math.max(ctx.currentTime, tb - ramp));
    level.linearRampToValueAtTime(0, tb);
    seg.src.stop(tb);
  }

  // RISER

  // schedules a riser so its peak lands exactly on the cut at tb
  // if there isn't time to fit the build-up before tb it's skipped to avoid starting part way through
  function startRiser(tb) {
    if (!riser.buf) return null;
    const t0 = tb - riser.hit;
    if (t0 < ctx.currentTime + riserMargin) return null;
    const src = ctx.createBufferSource();
    src.buffer = riser.buf;
    const gain = ctx.createGain();
    gain.gain.value = riser.gain;
    src.connect(gain);
    gain.connect(fader);
    src.start(t0);
    return { src, gain };
  }

  // stops a riser straight away with a very short fade, used when the dm changes back before the cut
  function killRiser(r) {
    if (!r) return;
    const t = ctx.currentTime;
    r.gain.gain.cancelScheduledValues(t);
    r.gain.gain.setValueAtTime(r.gain.gain.value, t);
    r.gain.gain.linearRampToValueAtTime(0, t + 0.012);
    r.src.stop(t + 0.02);
  }

    // TRANSITIONS
  // decides what plays next and schedules it ahead of time
  // runs on begin combat and every time hp is confirmed
  function plan() {
    if (!running || !segs.length) return;
    const now = ctx.currentTime;
    const edge = now + minLead;
    const last = segs[segs.length - 1];
    // if the last segment hasn't started yet it's queued (future), and the one before it is playing now
    const fut = (last.t0 > edge && segs.length > 1) ? last : null;
    const cur = fut ? segs[segs.length - 2] : last;

    // when a chnage is already queued:
    if (fut) {
      if (fut.sec === desired) return; // already heading to the right section

      // if the queued section isn't wanted any more: cancel it but maintain its landing point (tb)
      fut.src.stop();
      fut.gain.disconnect();
      segs.pop();
      const tb = fut.t0;

      // if we're still in the intro section, just swap in the new destination stated by the user (although realistically speaking in a dnd battle noone would be taking damage 10 seconds into a fight, more just a polishing measure)
      if (cur.sec === 'intro') {
        makeSeg(desired, tb, 0, fut.serial0, false);
        return;
      }

      // if the user quick enough changes back to the section that is already playing: undo its fade out and carry on seamlessly
      // the old player still stops at tb (a stop can't be cancelled), so a fresh one picks up from the exact same spot
      if (desired === cur.sec) {
        killRiser(fut.riser); // a change in the loop is no longer imminent, so the build-up stops
        cur.gain.gain.cancelScheduledValues(0);
        cur.gain.gain.setValueAtTime(1, now);
        const offset = (cur.offset + (tb - cur.t0)) % buffers[cur.sec].duration;
        makeSeg(cur.sec, tb, offset, fut.serial0, false);
        return;
      }

      // the process of changing to a different section creates the same landing point, with a new destination
      cutOut(cur, tb);
      const next = makeSeg(desired, tb, 0, fut.serial0, true);
      next.riser = fut.riser || startRiser(tb);
      return;
    }

    // the outro plays oly once at the conclusion of the battle
    if (cur.sec === 'outro') return; 

    // the intro plays once, and the next section starts exactly as it ends with no gap
    if (cur.sec === 'intro') {
      const tEnd = cur.t0 + buffers.intro.duration;
      if (tEnd > edge) makeSeg(desired, tEnd, 0, cur.serial0 + sections.intro.bars, false);
      return;
    }

    if (desired === cur.sec) return;

    // find the next bar line that's at least minLead away and sits on the 4-bar phrase grid
    // 'k' counts bars from the start of the current segment, and serial0 + k is that bar's number in the whole fight, confusing maths here
    const barLen = sections[cur.sec].barLen;
    let k = Math.floor((edge - cur.t0) / barLen + 1e-9) + 1;
    while ((cur.serial0 + k) % phrase !== 0) k++;
    const tb = cur.t0 + k * barLen;

    // cut the current section out right on that line and bring the new one in with a tiny fade
    cutOut(cur, tb);
    const next = makeSeg(desired, tb, 0, cur.serial0 + k, true);
    next.riser = startRiser(tb);
  }

  // COMBAT CONTROLS

  // hp can only be changed while the music is running, not while paused or while the outro is on its way
  const hpEditable = () => phase === 'combat' && running && !paused && !outroQueued;

  // begin combat wakes the audio context, then queues the intro
  async function beginCombat() {
    if (phase !== 'ready' || !allLoaded()) return;
    await ctx.resume();
    const t = ctx.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(1, t);
    segs = [];
    running = true;
    paused = false;
    outroQueued = false;
    phase = 'combat';
    desired = computeDesired();
    if (desired === 'outro') desired = 't4'; // never start straight into the outro
    makeSeg('intro', t + 0.12, 0, 0, false); // a small head start so the first note isn't clipped
    plan();
    tlDirty = true;
    refresh();
  }

  $('#begin').addEventListener('click', beginCombat);

  // PAUSE AND PLAY

  // pause fades out over 10ms (to prevent annoying audio clicking), then freezes the audio clock, so everything scheduled (even a queued change) stays put
  function pause() {
    if (phase !== 'combat' || !running || paused) return;
    paused = true;
    cancelEndArm();
    const t = ctx.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(fader.gain.value, t);
    fader.gain.linearRampToValueAtTime(0, t + pauseFade);
    setTimeout(() => {
      if (paused && ctx.state === 'running') ctx.suspend();
    }, pauseFade * 1000 + 4);
    refresh();
  }

  // play unfreezes the clock and fades back in, the music carries on from exactly where it stopped
  async function play() {
    if (!paused) return;
    await ctx.resume();
    const t = ctx.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(0, t);
    fader.gain.linearRampToValueAtTime(1, t + pauseFade);
    paused = false;
    refresh();
  }

  $('#pause').addEventListener('click', pause);
  $('#play').addEventListener('click', play);

  // END COMBAT
  // the first press only asks (the white box appears), a second press within 5 seconds confirms

  let endArmed = false;
  let endTimer = 0;

  function cancelEndArm() {
    endArmed = false;
    clearTimeout(endTimer);
    $('#end-confirm').hidden = true;
  }

  $('#end').addEventListener('click', (e) => {
    e.stopPropagation(); // keeps this click from reaching the document listener below, which would cancel it straight away
    if (!endArmed) {
      endArmed = true;
      $('#end-confirm').hidden = false;
      endTimer = setTimeout(cancelEndArm, 5000);
      return;
    }
    cancelEndArm();
    undoHP(); // any half typed hp is thrown away
    outroQueued = true;
    desired = 'outro';
    plan();
    refresh();
  });

  // clicking anywhere else undoes the original click to end the combat
  document.addEventListener('click', () => {
    if (endArmed) cancelEndArm();
  });

  // VOLUME

  const volumeInput = $('#volume');

  function applyVolume() {
    volume = Number(volumeInput.value);
    $('#vol-pct').textContent = volume + '%';
    volumeInput.style.setProperty('--p', volume + '%'); // identifies how much of the track is filled white
    // setTargetAtTime glides to the new level over a few milliseconds, so dragging the slider doesn't crackle
    if (master) master.gain.setTargetAtTime(volume / 100, ctx.currentTime, 0.015);
  }

  volumeInput.addEventListener('input', applyVolume);

  // keeps every button, hp field and the status line in step with what's happening
  function refresh() {
    const sec = currentSec();
    const inCombat = phase === 'combat' && running;
    $('#begin').disabled = !(phase === 'ready' && allLoaded());
    $('#play').disabled = !(inCombat && paused);
    $('#pause').disabled = !(inCombat && !paused);
    // end combat only works while a looping section plays: not during the intro, and not once the outro is on its way
    $('#end').disabled = !(inCombat && !paused && !outroQueued && sec && sections[sec].loop);
    if ($('#end').disabled) cancelEndArm();

    const editable = hpEditable();
    for (const c of chars) {
      if (c.input) c.input.disabled = !editable;
    }
    $('#undo').disabled = !editable;
    $('#confirm').disabled = !editable;

    let msg = '';
    if (loadFailed) msg = 'The music could not load. Reload the page to try again.';
    else if (!allLoaded()) msg = 'Loading music\u2026 ' + loadedCount + ' of ' + Object.keys(sections).length;
    else if (phase === 'ready') msg = 'Ready. Begin Combat starts the intro.';
    else if (paused) msg = 'Paused. HP editing is locked until you press Play.';
    else if (outroQueued) msg = 'Outro playing.';
    $('#status').textContent = msg;
  }

  // BAR TIMELINE
  // the same conveyor as protobar1, but driven by the music: every dot is a real bar, coloured by the section playing in it

  const timeline = $('#timeline');
  const slots = 10;        // total slots on the strip
  const head = 5;          // the playhead's slot, with 5 past bars before it
  const dots = new Map();  // bar number -> its dot element
  let tlDirty = true;      // set when the timeline should redraw even though the bar hasn't changed
  let lastSerial = null;
  let lastVersion = -1;

  // turns a slot number into a css left value (the 6px is the strip's padding)
  function slotLeft(slot) {
    return 'calc(6px + var(--slot) * ' + slot + ')';
  }

  // the empty rings, drawn once, never move
  for (let i = 0; i < slots; i++) {
    const slotEl = el('div', { class: 'slot' }, el('div', { class: 'ring' }));
    slotEl.style.left = slotLeft(i);
    timeline.appendChild(slotEl);
  }

  // the bar number playing right now, counted from the first bar of the intro (-1 before the intro starts)
  // uses the playing segment's own bar length, so it stays exactly on that file's bar lines
  function currentSerial() {
    const now = ctx.currentTime;
    const g = segAt(now);
    if (!g) return -1;
    const s = sections[g.sec];
    let n = g.serial0 + Math.floor((now - g.t0) / s.barLen + 1e-9);
    if (!s.loop) n = Math.min(n, g.serial0 + s.bars - 1); // the intro and outro don't run past their last bar
    return n;
  }

  // which section bar n belongs to, or null if nothing plays then
  // it's whichever segment starts at or before that bar, and a looping section keeps going until something replaces it
  function secOfSerial(n) {
    if (n < 0) return null;
    let found = null;
    for (const g of segs) {
      if (g.serial0 <= n) found = g;
    }
    if (!found) return null;
    const s = sections[found.sec];
    if (!s.loop) {
      const into = n - found.serial0 + Math.round(found.offset / s.barLen);
      if (into >= s.bars) return null; // past the end of the intro or outro
    }
    return found.sec;
  }

  // removes every dot, used when a new combat opens
  function clearTimeline() {
    dots.forEach((d) => d.remove());
    dots.clear();
    lastSerial = null;
    tlDirty = true;
  }

  // rebuilds which bars are on screen for the current bar, then slides every dot into place
  function updateTimeline(current) {
    // the bars that should be visible, and the section each one belongs to
    const want = new Map();
    for (let n = current - head; n <= current + (slots - 1 - head); n++) {
      const sec = secOfSerial(n);
      if (sec) want.set(n, sec);
    }

    // add a dot for any bar that has just come into view, parked off the right edge
    const fresh = [];
    for (const [n, sec] of want) {
      let d = dots.get(n);
      if (!d) {
        d = el('div', { class: 'slot dotwrap' }, el('div', { class: 'dot' }));
        d.style.left = slotLeft(slots);
        d.style.opacity = '0';
        d.style.transitionDelay = fresh.length * 0.11 + 's'; // several arriving together come in one by one
        timeline.appendChild(d);
        dots.set(n, d);
        fresh.push(d);
      }
      // recoloured every update, so a queued change shows on the upcoming dots (the css fades the colour)
      d.firstChild.style.setProperty('--colour', sections[sec].colour);
    }

    // commit the parked positions before moving anything, same trick as protobar1
    void timeline.offsetWidth;

    // slide every wanted dot to its slot, and send off any that aren't wanted any more
    for (const [n, d] of dots) {
      if (want.has(n)) {
        if (!fresh.includes(d)) d.style.transitionDelay = '0s';
        d.style.opacity = '1';
        d.style.left = slotLeft(n - current + head);
      } else {
        dots.delete(n);
        d.style.transitionDelay = '0s';
        if (n < current - head) d.style.left = slotLeft(-1); // old bars slide off the left
        d.style.opacity = '0';                                // cancelled future bars just fade
        setTimeout(() => d.remove(), 320);
      }
    }
  }

  // BATTLE END

  // stops and unplugs every segment and riser, used when leaving combat
  // try catch because stopping a player that has already stopped can throw in some browsers
  function stopAll() {
    for (const g of segs) {
      try {
        g.src.stop();
      } catch (e) {}
      g.gain.disconnect();
      if (g.riser) {
        try {
          g.riser.src.stop();
        } catch (e) {}
        g.riser.gain.disconnect();
      }
    }
    segs = [];
    segVersion++;
    running = false;
    paused = false;
    outroQueued = false;
  }

  // the outro has finished: lock the controls and show the battle ended panel
  function endBattle() {
    phase = 'ended';
    cancelEndArm();
    $('#ended').hidden = false;
    refresh();
    $('#return').focus();
  }

  // back to setup: silence everything, rest the audio clock until the next fight, and swap the screens back
  // the setup itself was never changed by combat, so the party is exactly as the dm left it
  function showSetup() {
    stopAll();
    if (ctx && ctx.state === 'running') ctx.suspend();
    phase = 'ready';
    cancelEndArm();
    $('#combat').hidden = true;
    $('#ended').hidden = true;
    $('#setup').hidden = false;
    renderSetup();
  }

  $('#return').addEventListener('click', showSetup);

  // IDLE GLOW
  // extended technique from the health prototypes: after 15 seconds with no input, the first movement, click or key press
  // makes the controls the dm is most likely to need glow, so they can find their place again at a glance

  const idleMS = 15000;
  const glowMS = 2000;
  let lastActivity = performance.now();
  let swallowClick = false; // true while the click that woke the screen still needs to be ignored

  // what glows depends on the moment: play while paused, otherwise pause plus every hp field that can be edited
  function glowTargets() {
    if ($('#combat').hidden || phase !== 'combat' || !running) return [];
    if (paused) return [$('#play')];
    const targets = [$('#pause')];
    if (hpEditable()) {
      for (const c of chars) targets.push(c.input);
    }
    return targets;
  }

  // runs on any activity: if the dm had been idle, the right controls glow for 2 seconds
  function wake(e) {
    const now = performance.now();
    const wasIdle = now - lastActivity >= idleMS;
    lastActivity = now;
    if (!wasIdle) return;
    const targets = glowTargets();
    if (!targets.length) return;
    // waking the screen never presses anything, the first click or key after idle only wakes it
    if (e.type === 'pointerdown' || e.type === 'keydown') {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'pointerdown') swallowClick = true;
    }
    targets.forEach((t) => t.classList.add('glow'));
    setTimeout(() => targets.forEach((t) => t.classList.remove('glow')), glowMS);
  }

  // listened for on the whole window, in the capture phase so wake runs before any button hears the event
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
    window.addEventListener(type, wake, { capture: true, passive: type !== 'pointerdown' && type !== 'keydown' });
  });

  // a pointerdown that woke the screen is followed by a click, which is swallowed here so it doesn't press anything
  window.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // if no click follows (the pointer was dragged away), stop waiting for one
  window.addEventListener('pointerup', () => {
    setTimeout(() => {
      swallowClick = false;
    }, 0);
  }, true);

  // MAIN LOOP
  // runs every frame: moves the timeline on each new bar, ends the battle when the outro finishes, and refreshes the buttons when the section changes

  let lastSec = null;

  function frame() {
    if (ctx && running) {
      if (phase === 'combat') {
        const cur = currentSerial();
        // redraw on a new bar, when segments change (a queued or cancelled change), or when asked to
        if (cur !== lastSerial || segVersion !== lastVersion || tlDirty) {
          lastSerial = cur;
          lastVersion = segVersion;
          tlDirty = false;
          updateTimeline(cur);
        }
        // once the outro has played out, the battle is over
        const outro = segs.find((g) => g.sec === 'outro');
        if (outro && ctx.currentTime >= outro.t0 + concludeAt) endBattle();
      }
      const sec = currentSec();
      if (sec !== lastSec) {
        lastSec = sec;
        refresh();
      }
    }
    requestAnimationFrame(frame);
  }

  // BOOT
  renderSetup();
  applyVolume();
  initAudio();
  refresh();
  requestAnimationFrame(frame);
})();