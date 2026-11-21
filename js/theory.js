/* Music theory data & helpers: notes, chords, scales, note spelling, answer parsing. */
(function () {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_SEMIS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const DEGREE_NATURALS = [0, 2, 4, 5, 7, 9, 11]; // semitones of unaltered degrees 1..7

  const ACC_CHARS = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': 'x' }; // input-friendly
  const ACC_DISPLAY = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '♯♯' }; // pretty

  // The twelve roots we build questions for. Each root carries its letter and
  // accidental so generated note names are spelled correctly
  // (e.g. Ab minor -> Ab Bb Cb Db Eb Fb Gb, not enharmonic soup).
  const ROOTS = [
    { name: 'C', letter: 'C', acc: 0 },
    { name: 'Db', letter: 'D', acc: -1 },
    { name: 'D', letter: 'D', acc: 0 },
    { name: 'Eb', letter: 'E', acc: -1 },
    { name: 'E', letter: 'E', acc: 0 },
    { name: 'F', letter: 'F', acc: 0 },
    { name: 'F#', letter: 'F', acc: 1 },
    { name: 'G', letter: 'G', acc: 0 },
    { name: 'Ab', letter: 'A', acc: -1 },
    { name: 'A', letter: 'A', acc: 0 },
    { name: 'Bb', letter: 'B', acc: -1 },
    { name: 'B', letter: 'B', acc: 0 },
  ];

  // Chords as [scale degree, semitones above root] pairs.
  const CHORDS = [
    { id: 'maj', label: 'major', suffix: '', tones: [[1, 0], [3, 4], [5, 7]] },
    { id: 'min', label: 'minor', suffix: 'm', tones: [[1, 0], [3, 3], [5, 7]] },
    { id: 'dim', label: 'diminished', suffix: 'dim', tones: [[1, 0], [3, 3], [5, 6]] },
    { id: 'aug', label: 'augmented', suffix: 'aug', tones: [[1, 0], [3, 4], [5, 8]] },
    { id: 'sus2', label: 'suspended 2nd', suffix: 'sus2', tones: [[1, 0], [2, 2], [5, 7]] },
    { id: 'sus4', label: 'suspended 4th', suffix: 'sus4', tones: [[1, 0], [4, 5], [5, 7]] },
    { id: '6', label: 'sixth', suffix: '6', tones: [[1, 0], [3, 4], [5, 7], [6, 9]] },
    { id: 'm6', label: 'minor sixth', suffix: 'm6', tones: [[1, 0], [3, 3], [5, 7], [6, 9]] },
    { id: '7', label: 'dominant 7th', suffix: '7', tones: [[1, 0], [3, 4], [5, 7], [7, 10]] },
    { id: 'maj7', label: 'major 7th', suffix: 'maj7', tones: [[1, 0], [3, 4], [5, 7], [7, 11]] },
    { id: 'm7', label: 'minor 7th', suffix: 'm7', tones: [[1, 0], [3, 3], [5, 7], [7, 10]] },
    { id: 'mMaj7', label: 'minor major 7th', suffix: 'mMaj7', tones: [[1, 0], [3, 3], [5, 7], [7, 11]] },
    { id: 'm7b5', label: 'half-diminished 7th', suffix: 'm7♭5', tones: [[1, 0], [3, 3], [5, 6], [7, 10]] },
    { id: 'dim7', label: 'diminished 7th', suffix: 'dim7', tones: [[1, 0], [3, 3], [5, 6], [7, 9]] },
  ];

  // Scales as [scale degree, semitones above root] pairs.
  const SCALES = [
    { id: 'major', label: 'major', degrees: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11]] },
    { id: 'nat-minor', label: 'natural minor', degrees: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
    { id: 'harm-minor', label: 'harmonic minor', degrees: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 11]] },
    { id: 'mel-minor', label: 'melodic minor', degrees: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 11]] },
    { id: 'dorian', label: 'Dorian', degrees: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 10]] },
    { id: 'phrygian', label: 'Phrygian', degrees: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
    { id: 'lydian', label: 'Lydian', degrees: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 7], [6, 9], [7, 11]] },
    { id: 'mixolydian', label: 'Mixolydian', degrees: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 10]] },
    { id: 'locrian', label: 'Locrian', degrees: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 6], [6, 8], [7, 10]] },
    { id: 'maj-pent', label: 'major pentatonic', degrees: [[1, 0], [2, 2], [3, 4], [5, 7], [6, 9]] },
    { id: 'min-pent', label: 'minor pentatonic', degrees: [[1, 0], [3, 3], [4, 5], [5, 7], [7, 10]] },
    { id: 'blues', label: 'blues', degrees: [[1, 0], [3, 3], [4, 5], [5, 6], [5, 7], [7, 10]] },
  ];

  function accText(acc, display) {
    const key = String(Math.max(-2, Math.min(2, acc)));
    return display ? ACC_DISPLAY[key] : ACC_CHARS[key];
  }

  // Spell the note `deg` scale-steps above `root`, `semis` semitones up,
  // e.g. root Ab, degree 3, semitones 3 -> "Cb".
  function spellTone(root, deg, semis) {
    const letter = LETTERS[(LETTER_INDEX[root.letter] + deg - 1) % 7];
    const rootPitch = (LETTER_SEMIS[root.letter] + root.acc + 120) % 12;
    const natural = (LETTER_SEMIS[letter] - rootPitch + 12) % 12;
    let acc = semis - natural;
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    return letter + accText(acc, true);
  }

  // Interval label like "♭3" or "♯4" for a [degree, semitones] pair.
  function degreeToken(deg, semis) {
    return accText(semis - DEGREE_NATURALS[deg - 1], true) + deg;
  }

  function rootPitchClass(root, semis) {
    return ((LETTER_SEMIS[root.letter] + root.acc + semis) % 12 + 12) % 12;
  }

  function buildDeck() {
    const deck = [];

    for (const root of ROOTS) {
      for (const chord of CHORDS) {
        const name = root.name + chord.suffix;
        const notes = chord.tones.map(([deg, semis]) => spellTone(root, deg, semis));
        const intervalTokens = chord.tones.map(([deg, semis]) => degreeToken(deg, semis));
        deck.push({
          id: 'chord-notes:' + chord.id + ':' + root.name,
          type: 'chord-notes',
          typeLabel: 'Chord tones',
          prompt: 'Which tones are in the chord ' + name + '?',
          answerNotes: notes,
          answerIntervals: intervalTokens,
          answerPcs: chord.tones.map(([deg, semis]) => rootPitchClass(root, semis)),
          answerText: notes.join(' – '),
          placeholder: 'e.g. C, E, G',
          fb: { kind: 'chord', root: root.name, item: chord.id },
        });
      }
    }

    for (const chord of CHORDS) {
      const tokens = chord.tones.map(([deg, semis]) => degreeToken(deg, semis));
      deck.push({
        id: 'chord-intervals:' + chord.id,
        type: 'chord-intervals',
        typeLabel: 'Chord intervals',
        prompt: 'Which intervals are in a ' + chord.label + ' chord?',
        answerIntervals: tokens,
        answerIntervalSemis: chord.tones.map(([, s]) => s).sort((a, b) => a - b),
        answerText: tokens.join(' – '),
        placeholder: 'e.g. 1, b3, 5',
        fb: { kind: 'chord', root: null, item: chord.id },
      });
    }

    // Interval questions are key-independent: the intervals of a scale type are
    // the same in every key, so these cards are root-agnostic.
    for (const scale of SCALES) {
      const tokens = scale.degrees.map(([deg, semis]) => degreeToken(deg, semis));
      deck.push({
        id: 'scale-intervals:' + scale.id,
        type: 'scale-intervals',
        typeLabel: 'Scale intervals',
        prompt: 'Which intervals does the ' + scale.label + ' scale contain?',
        answerIntervals: tokens,
        answerIntervalSemis: scale.degrees.map(([, s]) => s).sort((a, b) => a - b),
        answerText: tokens.join(' – '),
        placeholder: 'e.g. 1, 2, b3, 4, 5, 6, b7',
        fb: { kind: 'scale', root: null, item: scale.id },
      });
    }

    for (const root of ROOTS) {
      for (const scale of SCALES) {
        const label = root.name + ' ' + scale.label;
        const notes = scale.degrees.map(([deg, semis]) => spellTone(root, deg, semis));
        const intervalTokens = scale.degrees.map(([deg, semis]) => degreeToken(deg, semis));
        deck.push({
          id: 'scale-notes:' + scale.id + ':' + root.name,
          type: 'scale-notes',
          typeLabel: 'Scale tones',
          prompt: 'Which tones are in the ' + label + ' scale?',
          answerNotes: notes,
          answerIntervals: intervalTokens,
          answerPcs: scale.degrees.map(([deg, semis]) => rootPitchClass(root, semis)),
          answerText: notes.join(' – '),
          placeholder: 'e.g. D, E, F, G, A, B, C#',
          fb: { kind: 'scale', root: root.name, item: scale.id },
        });
      }
    }

    return deck;
  }

  /* ---------- answer parsing ---------- */

  function normalizeAcc(input) {
    return String(input)
      .replace(/𝄫/g, 'bb')
      .replace(/𝄪/g, '##')
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#');
  }

  // Pull note tokens out of free-form input: "C E G", "c, eb, f#", "CEG" all work.
  function extractNoteTokens(raw) {
    const out = [];
    const re = /[A-Ga-g][#bBxX]*/g;
    const s = normalizeAcc(raw);
    let m;
    while ((m = re.exec(s))) out.push(m[0]);
    return out;
  }

  function parseNoteToken(token) {
    const m = /^([A-Ga-g])(#+|bb|b|x|X)?$/.exec(normalizeAcc(token).trim());
    if (!m) return null;
    let pc = LETTER_SEMIS[m[1].toUpperCase()];
    const acc = (m[2] || '').toLowerCase().replace('x', '##');
    for (const ch of acc) pc += ch === '#' ? 1 : -1;
    return ((pc % 12) + 12) % 12;
  }

  function extractIntervalTokens(raw) {
    return normalizeAcc(raw).toLowerCase().split(/[\s,;]+/).filter(Boolean);
  }

  function parseIntervalToken(token) {
    const m = /^([b#]+)?(\d)([b#]+)?$/.exec(normalizeAcc(token).trim().toLowerCase());
    if (!m) return null;
    const deg = parseInt(m[2], 10);
    if (deg < 1 || deg > 7) return null;
    let acc = 0;
    for (const ch of (m[1] || '') + (m[3] || '')) acc += ch === '#' ? 1 : -1;
    return ((DEGREE_NATURALS[deg - 1] + acc) % 12 + 12) % 12;
  }

  /* ---------- fretboard / reference helpers ---------- */

  // Resolve a chord or scale selection (kind + root + item id) to its tones with
  // pitch class, correctly spelled note name and interval label.
  function getTones(kind, rootName, itemId) {
    const root = ROOTS.find((r) => r.name === rootName);
    if (!root) return null;
    const list = kind === 'chord' ? CHORDS : SCALES;
    const item = list.find((x) => x.id === itemId);
    if (!item) return null;
    const pairs = item.tones || item.degrees;
    const rootPitch = (LETTER_SEMIS[root.letter] + root.acc + 120) % 12;
    return {
      kind: kind,
      id: item.id,
      rootName: root.name,
      rootPc: rootPitch,
      title: kind === 'chord' ? root.name + item.suffix : root.name + ' ' + item.label,
      tones: pairs.map(([deg, semis]) => ({
        deg: deg,
        semis: semis,
        pc: ((rootPitch + semis) % 12 + 12) % 12,
        note: spellTone(root, deg, semis),
        interval: degreeToken(deg, semis),
      })),
    };
  }

  window.MT = {
    buildDeck: buildDeck,
    extractNoteTokens: extractNoteTokens,
    parseNoteToken: parseNoteToken,
    extractIntervalTokens: extractIntervalTokens,
    parseIntervalToken: parseIntervalToken,
    getTones: getTones,
    ROOT_NAMES: ROOTS.map((r) => r.name),
    CHORD_TYPES: CHORDS.map((c) => ({ id: c.id, label: c.label })),
    SCALE_TYPES: SCALES.map((s) => ({ id: s.id, label: s.label })),
  };
})();
