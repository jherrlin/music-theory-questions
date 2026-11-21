/* Mandolin fretboard guide: shows notes or intervals, highlights a chord/scale.
   Mandolin courses are tuned G3–D4–A4–E5; rendered top-to-bottom like tab (E first).
   Also renders a plain all-tones reference board in the Practice view. */
(function () {
  'use strict';

  const T = window.MT;
  const srs = window.MT.srs;

  const STRINGS = [
    { label: 'E', pc: 4, midi: 76 }, // E5
    { label: 'A', pc: 9, midi: 69 }, // A4
    { label: 'D', pc: 2, midi: 62 }, // D4
    { label: 'G', pc: 7, midi: 55 }, // G3
  ];
  const FRETS = 15;
  const GENERIC_INTERVALS = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

  const els = {
    controls: document.getElementById('fretboard-controls'),
    board: document.getElementById('fretboard'),
  };

  const saved = srs.getSetting('fb', {});
  const sel = {
    kind: saved.kind === 'chord' ? 'chord' : 'scale',
    root: T.ROOT_NAMES.indexOf(saved.root) !== -1 ? saved.root : 'C',
    item: saved.item || 'major',
    mode: saved.mode === 'intervals' ? 'intervals' : 'notes',
  };

  function saveSel() {
    srs.setSetting('fb', sel);
  }

  function selection() {
    const item = sel.kind === 'chord'
      ? T.CHORD_TYPES.find((c) => c.id === sel.item) || T.CHORD_TYPES[0]
      : T.SCALE_TYPES.find((s) => s.id === sel.item) || T.SCALE_TYPES[0];
    sel.item = item.id; // keep valid when switching kind
    return T.getTones(sel.kind, sel.root, item.id);
  }

  function selectField(labelText, options, value, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'fb-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', onChange);
    wrap.appendChild(span);
    wrap.appendChild(select);
    els.controls.appendChild(wrap);
    return select;
  }

  function radioField(groupName, options, value, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'fb-field';
    const span = document.createElement('span');
    span.textContent = 'Labels';
    wrap.appendChild(span);
    const row = document.createElement('div');
    row.className = 'fb-radios';
    for (const opt of options) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = opt.value;
      input.checked = opt.value === value;
      input.addEventListener('change', onChange);
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + opt.label));
      row.appendChild(label);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function buildControls() {
    els.controls.textContent = '';

    selectField('Show', [
      { value: 'scale', label: 'Scale' },
      { value: 'chord', label: 'Chord' },
    ], sel.kind, (e) => {
      sel.kind = e.target.value;
      sel.item = sel.kind === 'chord' ? 'maj' : 'major';
      buildControls(); // rebuild item list for the new kind
      saveSel();
      renderMain();
    });

    selectField('Key', T.ROOT_NAMES.map((n) => ({ value: n, label: n })), sel.root, (e) => {
      sel.root = e.target.value;
      saveSel();
      renderMain();
    });

    const itemOptions = sel.kind === 'chord'
      ? T.CHORD_TYPES.map((c) => ({ value: c.id, label: c.label }))
      : T.SCALE_TYPES.map((s) => ({ value: s.id, label: s.label }));
    selectField(sel.kind === 'chord' ? 'Chord type' : 'Scale type', itemOptions, sel.item, (e) => {
      sel.item = e.target.value;
      saveSel();
      renderMain();
    });

    els.controls.appendChild(radioField('fb-mode', [
      { value: 'notes', label: 'Notes' },
      { value: 'intervals', label: 'Intervals' },
    ], sel.mode, (e) => {
      if (e.target.checked) sel.mode = e.target.value;
      saveSel();
      renderMain();
    }));
  }

  /* ---------- sound: click a tone to hear it ---------- */

  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Pluck a pitch, Karplus-Strong style: a short noise burst in a feedback
  // delay ring-buffer decays like a picked string, no audio files needed.
  function playMidi(midi) {
    let ctx;
    try {
      ctx = getCtx();
    } catch (e) {
      return; // no Web Audio available; clicking stays silent
    }
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const sr = ctx.sampleRate;
    const seconds = 1.6;
    const buffer = ctx.createBuffer(1, Math.ceil(sr * seconds), sr);
    const data = buffer.getChannelData(0);
    const n = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < data.length; i++) {
      const cur = ring[idx];
      const nxt = ring[(idx + 1) % n];
      ring[idx] = 0.996 * 0.5 * (cur + nxt);
      idx = (idx + 1) % n;
      data[i] = cur;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function addCell(host, text, cls) {
    const cell = document.createElement('div');
    cell.className = cls;
    if (text) cell.textContent = text;
    host.appendChild(cell);
    return cell;
  }

  // Render a fretboard into `container`. When `tone` is null nothing is
  // highlighted (plain all-tones reference board); `mode` picks the primary
  // label, and highlighted tones also show the other representation beneath.
  // `withTitle` adds the selection summary line above the board.
  function renderInto(container, tone, mode, withTitle) {
    const useFlats = tone ? /b$/.test(tone.rootName) : false; // Db, Eb, Gb, Ab, Bb contexts
    const memberByPc = {};
    const intervalBySemis = {};
    if (tone) {
      for (const t of tone.tones) {
        memberByPc[t.pc] = t;
        intervalBySemis[t.semis] = t.interval === '1' ? 'R' : t.interval;
      }
    }

    function primary(pc, member, diff) {
      if (mode === 'notes') {
        return member ? member.note : (useFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc]);
      }
      return member ? intervalBySemis[diff] : GENERIC_INTERVALS[diff];
    }

    function secondary(member, diff) {
      if (!member) return null;
      return mode === 'notes' ? intervalBySemis[diff] : member.note;
    }

    function fillCell(cell, text, member, diff) {
      const dot = document.createElement('span');
      dot.className = 'fb-dot';
      dot.textContent = text;
      cell.appendChild(dot);
      const subText = secondary(member, diff);
      if (subText) {
        const sub = document.createElement('span');
        sub.className = 'fb-sub';
        sub.textContent = subText;
        cell.appendChild(sub);
      }
    }

    const grid = document.createElement('div');
    grid.className = 'fb-grid';

    // Header row: fret numbers, with 0 marking the open-string column.
    addCell(grid, '0', 'fb-fret-label zero');
    for (let f = 1; f <= FRETS; f++) addCell(grid, String(f), 'fb-fret-label');

    for (const str of STRINGS) {
      const openPc = str.pc % 12;
      const openMember = tone ? memberByPc[openPc] : null;
      const openIsRoot = !!openMember && openMember.semis === 0;
      const openDiff = tone ? (openPc - tone.rootPc + 12) % 12 : 0;

      // The string label doubles as the open-string position: highlighted
      // when the open tone is part of the selection, inside the open zone
      // left of the nut.
      const labelCell = document.createElement('div');
      labelCell.className = 'fb-string-label open' +
        (openMember ? ' member' : '') +
        (openIsRoot ? ' root' : '');
      fillCell(labelCell, str.label, openMember, openDiff);
      labelCell.title = 'Play ' +
        (openMember ? openMember.note : (useFlats ? FLAT_NAMES[openPc] : SHARP_NAMES[openPc]));
      labelCell.addEventListener('click', () => playMidi(str.midi));
      grid.appendChild(labelCell);

      for (let f = 1; f <= FRETS; f++) {
        const pc = (str.pc + f) % 12;
        const member = tone ? memberByPc[pc] : null;
        const isRoot = !!member && member.semis === 0;
        const diff = tone ? (pc - tone.rootPc + 12) % 12 : 0;

        const cell = addCell(grid, '', 'fb-cell' +
          (member ? ' member' : '') +
          (isRoot ? ' root' : ''));
        fillCell(cell, primary(pc, member, diff), member, diff);
        cell.title = 'Play ' +
          (member ? member.note : (useFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc]));
        cell.addEventListener('click', () => playMidi(str.midi + f));
      }
    }

    container.textContent = '';
    if (withTitle && tone) {
      const title = document.createElement('div');
      title.className = 'fb-title';
      title.textContent = tone.title + ' — ' + tone.tones.map((t) => t.note).join(' – ') +
        ' (' + tone.tones.map((t) => (t.interval === '1' ? 'R' : t.interval)).join(' ') + ')';
      container.appendChild(title);
    }
    container.appendChild(grid);
  }

  function renderMain() {
    renderInto(els.board, selection(), sel.mode, true);
  }

  // Apply a practice-card mapping ({kind, root, item}) and show the board.
  // Root-agnostic cards keep the currently selected key.
  function show(fb) {
    if (!fb || (fb.kind !== 'chord' && fb.kind !== 'scale')) return;
    sel.kind = fb.kind;
    if (fb.root && T.ROOT_NAMES.indexOf(fb.root) !== -1) sel.root = fb.root;
    const list = fb.kind === 'chord' ? T.CHORD_TYPES : T.SCALE_TYPES;
    sel.item = list.some((x) => x.id === fb.item) ? fb.item : list[0].id;
    saveSel();
    buildControls();
    renderMain();
  }

  window.MT.fretboard = { show: show };

  buildControls();
  renderMain();
  renderInto(document.getElementById('help-fretboard'), null, 'notes', false);
})();
