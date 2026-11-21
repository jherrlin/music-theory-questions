/* Mandolin fretboard guide: shows notes or intervals, highlights a chord/scale.
   Mandolin courses are tuned G3–D4–A4–E5; rendered top-to-bottom like tab (E first). */
(function () {
  'use strict';

  const T = window.MT;
  const srs = window.MT.srs;

  const STRINGS = [
    { label: 'E', pc: 4 },
    { label: 'A', pc: 9 },
    { label: 'D', pc: 2 },
    { label: 'G', pc: 7 },
  ];
  const FRETS = 12;
  const INLAYS = [3, 5, 7, 9, 12];
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
      renderBoard();
    }).id = 'fb-kind';

    selectField('Key', T.ROOT_NAMES.map((n) => ({ value: n, label: n })), sel.root, (e) => {
      sel.root = e.target.value;
      saveSel();
      renderBoard();
    });

    const itemOptions = sel.kind === 'chord'
      ? T.CHORD_TYPES.map((c) => ({ value: c.id, label: c.label }))
      : T.SCALE_TYPES.map((s) => ({ value: s.id, label: s.label }));
    selectField(sel.kind === 'chord' ? 'Chord type' : 'Scale type', itemOptions, sel.item, (e) => {
      sel.item = e.target.value;
      saveSel();
      renderBoard();
    });

    els.controls.appendChild(radioField('fb-mode', [
      { value: 'notes', label: 'Notes' },
      { value: 'intervals', label: 'Intervals' },
    ], sel.mode, (e) => {
      if (e.target.checked) sel.mode = e.target.value;
      saveSel();
      renderBoard();
    }));
  }

  function addCell(host, text, cls) {
    const cell = document.createElement('div');
    cell.className = cls;
    if (text) cell.textContent = text;
    host.appendChild(cell);
    return cell;
  }

  function renderBoard() {
    const tone = selection();
    const useFlats = /b$/.test(tone.rootName); // Db, Eb, Gb, Ab, Bb contexts
    const memberByPc = {};
    const intervalBySemis = {};
    for (const t of tone.tones) {
      memberByPc[t.pc] = t;
      intervalBySemis[t.semis] = t.interval === '1' ? 'R' : t.interval;
    }

    const grid = document.createElement('div');
    grid.className = 'fb-grid';

    for (const str of STRINGS) {
      addCell(grid, str.label, 'fb-string-label');
      for (let f = 1; f <= FRETS; f++) {
        const pc = (str.pc + f) % 12;
        const member = memberByPc[pc];
        const isRoot = !!member && member.semis === 0;

        let label;
        if (sel.mode === 'notes') {
          label = member ? member.note : (useFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc]);
        } else {
          const diff = (pc - tone.rootPc + 12) % 12;
          label = member ? intervalBySemis[diff] : GENERIC_INTERVALS[diff];
        }

        const isInlay = INLAYS.indexOf(f) !== -1;
        const cls = 'fb-cell' +
          (isInlay ? ' inlay' : '') +
          (member ? ' member' : '') +
          (isRoot ? ' root' : '');
        const cell = addCell(grid, '', cls);
        const dot = document.createElement('span');
        dot.className = 'fb-dot';
        dot.textContent = label;
        cell.appendChild(dot);
        if (isInlay) {
          const num = document.createElement('span');
          num.className = 'fb-inlay';
          num.textContent = String(f);
          cell.appendChild(num);
        }
      }
    }

    els.board.textContent = '';
    const title = document.createElement('div');
    title.className = 'fb-title';
    title.textContent = tone.title + ' — ' + tone.tones.map((t) => t.note).join(' – ') +
      ' (' + tone.tones.map((t) => (t.interval === '1' ? 'R' : t.interval)).join(' ') + ')';
    els.board.appendChild(title);
    els.board.appendChild(grid);
  }

  buildControls();
  renderBoard();
})();
