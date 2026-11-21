/* UI wiring: flashcard flow, answer checking, rating buttons, stats panel. */
(function () {
  'use strict';

  const T = window.MT;
  const srs = window.MT.srs;

  const ALL_TYPES = [
    { id: 'chord-notes', label: 'Chord tones' },
    { id: 'chord-intervals', label: 'Chord intervals' },
    { id: 'scale-notes', label: 'Scale tones' },
    { id: 'scale-intervals', label: 'Scale intervals' },
  ];

  const deck = T.buildDeck();

  const els = {
    stats: document.getElementById('stats'),
    chip: document.getElementById('type-chip'),
    prompt: document.getElementById('prompt'),
    answerRow: document.getElementById('answer-row'),
    input: document.getElementById('answer-input'),
    checkBtn: document.getElementById('check-btn'),
    feedback: document.getElementById('feedback'),
    ratingRow: document.getElementById('rating-row'),
    enterHint: document.getElementById('enter-hint'),
    showBtn: document.getElementById('show-btn'),
    typeFilters: document.getElementById('type-filters'),
    fbLink: document.getElementById('fb-link'),
    playTones: document.getElementById('play-tones'),
    hintToggle: document.getElementById('hint-toggle'),
    hintCheck: document.getElementById('hint-check'),
    hint: document.getElementById('hint'),
    hardest: document.getElementById('hardest'),
    resetBtn: document.getElementById('reset-btn'),
    nav: document.getElementById('view-nav'),
    views: {
      practice: document.getElementById('practice-view'),
      overview: document.getElementById('overview-view'),
      fretboard: document.getElementById('fretboard-view'),
      keys: document.getElementById('keys-view'),
    },
  };

  const navButtons = Array.prototype.slice.call(els.nav.querySelectorAll('button[data-view]'));

  function switchView(name) {
    for (const key of Object.keys(els.views)) els.views[key].hidden = key !== name;
    for (const btn of navButtons) btn.classList.toggle('active', btn.dataset.view === name);
    if (name === 'overview') window.MT.overview.render();
    if (name === 'practice' && current && mode === 'asking') els.input.focus();
  }

  for (const btn of navButtons) {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  }

  const ratingButtons = Array.prototype.slice.call(els.ratingRow.querySelectorAll('button[data-rating]'));
  const RATING_LABELS = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

  let current = null;
  let mode = 'asking'; // 'asking' | 'answered'
  let lastCorrect = false;
  let answeredAt = 0;

  /* ---------- deck / settings helpers ---------- */

  function enabledTypes() {
    const saved = srs.getTypes();
    if (!saved) return ALL_TYPES.map((t) => t.id);
    return ALL_TYPES.map((t) => t.id).filter((id) => saved.indexOf(id) !== -1);
  }

  function activeDeck() {
    const types = enabledTypes();
    return deck.filter((card) => types.indexOf(card.type) !== -1);
  }

  function buildTypeFilters() {
    const saved = srs.getTypes();
    els.typeFilters.textContent = '';
    for (const type of ALL_TYPES) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = type.id;
      box.checked = !saved || saved.indexOf(type.id) !== -1;
      box.addEventListener('change', onTypeFilterChange);
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + type.label));
      els.typeFilters.appendChild(label);
    }
  }

  function onTypeFilterChange() {
    const checked = Array.prototype.slice
      .call(els.typeFilters.querySelectorAll('input:checked'))
      .map((box) => box.value);
    srs.setTypes(checked);
    updateStats();
    renderHardest();
  }

  /* ---------- stats ---------- */

  function updateStats() {
    const c = srs.counts(activeDeck(), Date.now());
    const parts = ['Due now: ' + c.due, 'New: ' + c.fresh, 'Seen: ' + c.seen];
    if (c.accuracy !== null) parts.push('Accuracy: ' + c.accuracy + '%');
    els.stats.textContent = parts.join(' · ');
  }

  function renderHardest() {
    const rows = srs.hardest(activeDeck(), 8);
    const host = els.hardest;
    host.textContent = '';
    const title = document.createElement('h3');
    title.textContent = 'Problem cards';
    host.appendChild(title);
    if (!rows.length) {
      const p = document.createElement('p');
      p.textContent = 'Nothing yet — cards you get wrong will show up here.';
      host.appendChild(p);
      return;
    }
    const table = document.createElement('table');
    for (const row of rows) {
      const tr = document.createElement('tr');
      const tdCard = document.createElement('td');
      tdCard.textContent = row.card.prompt.replace(/^Which (notes|intervals) (are in|does|is in)/, '');
      const tdStats = document.createElement('td');
      const pct = Math.round((100 * row.rec.wrong) / row.rec.reps);
      tdStats.textContent = row.rec.correct + '✓ / ' + row.rec.wrong + '✗ (' + pct + '% wrong)';
      tr.appendChild(tdCard);
      tr.appendChild(tdStats);
      table.appendChild(tr);
    }
    host.appendChild(table);
  }

  /* ---------- card flow ---------- */

  function renderCard(card) {
    els.chip.textContent = card.typeLabel;
    els.prompt.textContent = card.prompt;
    els.fbLink.hidden = false;
    els.playTones.hidden = !(card.type === 'chord-notes' || card.type === 'scale-notes');
    updateHint();
    els.input.placeholder = card.placeholder;
    els.input.value = '';
    els.feedback.textContent = '';
    els.feedback.className = 'feedback';
    mode = 'asking';
    els.answerRow.hidden = false;
    els.showBtn.hidden = false;
    els.ratingRow.hidden = true;
    els.enterHint.textContent = '';
    els.input.focus();
  }

  function next() {
    const cards = activeDeck();
    if (!cards.length) {
      current = null;
      els.chip.textContent = '—';
      els.prompt.textContent = 'No card types are selected. Enable at least one type in the settings below.';
      els.fbLink.hidden = true;
      els.playTones.hidden = true;
      els.hintToggle.hidden = true;
      els.hint.hidden = true;
      els.answerRow.hidden = true;
      els.showBtn.hidden = true;
      els.ratingRow.hidden = true;
      els.feedback.textContent = '';
      return;
    }
    current = srs.pickNext(cards, Date.now());
    renderCard(current);
  }

  // Grade the typed answer against the card. Notes are compared as pitch classes
  // (spelling/order-insensitive), intervals as semitones (enharmonics allowed).
  function gradeAnswer(card, raw) {
    if (card.type === 'chord-notes' || card.type === 'scale-notes') {
      const tokens = T.extractNoteTokens(raw);
      if (!tokens.length) return { correct: false, unparsed: true };
      const got = [];
      for (const tok of tokens) {
        const pc = T.parseNoteToken(tok);
        if (pc === null) return { correct: false, unparsed: true };
        got.push(pc);
      }
      got.sort((a, b) => a - b);
      const want = card.answerPcs.slice().sort((a, b) => a - b);
      return { correct: got.length === want.length && got.every((v, i) => v === want[i]) };
    }
    const tokens = T.extractIntervalTokens(raw);
    if (!tokens.length) return { correct: false, unparsed: true };
    const got = [];
    for (const tok of tokens) {
      const s = T.parseIntervalToken(tok);
      if (s === null) return { correct: false, unparsed: true };
      got.push(s);
    }
    got.sort((a, b) => a - b);
    const want = card.answerIntervalSemis.slice().sort((a, b) => a - b);
    return { correct: got.length === want.length && got.every((v, i) => v === want[i]) };
  }

  function setFeedback(kind, text) {
    els.feedback.className = 'feedback ' + kind;
    els.feedback.textContent = text;
  }

  function finishAsk(result, raw) {
    mode = 'answered';
    answeredAt = Date.now();
    lastCorrect = result ? result.correct : false;
    const suggested = lastCorrect ? 'good' : 'again';

    if (!result) {
      setFeedback('neutral', 'Skipped. The answer is: ' + current.answerText + '.');
    } else if (result.correct) {
      setFeedback('good', '✓ Correct! ' + current.answerText);
    } else if (result.unparsed) {
      setFeedback('bad', '✗ Couldn\u2019t parse that answer. Correct answer: ' + current.answerText + '.');
    } else {
      setFeedback('bad', '✗ You answered \u201C' + raw.trim() + '\u201D. Correct answer: ' + current.answerText + '.');
    }

    const now = Date.now();
    for (const btn of ratingButtons) {
      btn.querySelector('.rate-next').textContent = srs.preview(current.id, btn.dataset.rating, now);
      btn.classList.toggle('suggested', btn.dataset.rating === suggested);
    }
    els.enterHint.textContent = 'Enter = ' + RATING_LABELS[suggested];

    els.answerRow.hidden = true;
    els.showBtn.hidden = true;
    els.ratingRow.hidden = false;
  }

  function check() {
    if (!current || mode !== 'asking') return;
    const raw = els.input.value;
    if (!raw.trim()) {
      finishAsk(null, raw); // empty answer = "don't know"
      return;
    }
    finishAsk(gradeAnswer(current, raw), raw);
  }

  function applyRating(rating) {
    if (!current || mode !== 'answered') return;
    srs.grade(current.id, rating, lastCorrect, Date.now());
    updateStats();
    renderHardest();
    next();
  }

  /* ---------- sound ---------- */

  // Play the current chord/scale as a rising run: the root is placed between
  // C4 and B4 and each tone sounds at its semitones above the root, so the
  // octave matches the theory. Tones are spaced so each one is clearly
  // audible and rings well past the next. Uses the same pluck synth as the
  // fretboard.
  function playCardTones() {
    if (!current || !window.MT.playMidi) return;
    if (current.type !== 'chord-notes' && current.type !== 'scale-notes') return;
    const kind = current.type === 'chord-notes' ? 'chord' : 'scale';
    const tone = T.getTones(kind, current.fb.root, current.fb.item);
    const rootMidi = 60 + tone.rootPc; // C4..B4
    const gapMs = 300;
    tone.tones.forEach((t, i) => {
      window.MT.playMidi(rootMidi + t.semis, (i * gapMs) / 1000, 0.22, 2.6);
    });
  }

  /* ---------- events ---------- */

  els.checkBtn.addEventListener('click', check);
  els.showBtn.addEventListener('click', () => {
    if (current && mode === 'asking') finishAsk(null, '');
  });
  els.fbLink.addEventListener('click', () => {
    if (current && current.fb && window.MT.fretboard) {
      window.MT.fretboard.show(current.fb);
      switchView('fretboard');
    }
  });
  els.playTones.addEventListener('click', playCardTones);
  els.hintCheck.addEventListener('change', () => {
    srs.setSetting('hint', els.hintCheck.checked);
    updateHint();
  });

  // The intervals hint exists only for tone cards (chords/scales), and shows when enabled.
  function updateHint() {
    const isToneCard = !!current && (current.type === 'scale-notes' || current.type === 'chord-notes');
    els.hintToggle.hidden = !isToneCard;
    const show = isToneCard && els.hintCheck.checked;
    els.hint.hidden = !show;
    if (show) els.hint.textContent = current.answerIntervals.join(' – ');
  }
  for (const btn of ratingButtons) {
    btn.addEventListener('click', () => {
      applyRating(btn.dataset.rating);
      if (btn.blur) btn.blur();
    });
  }
  els.resetBtn.addEventListener('click', () => {
    if (window.confirm('Forget all progress? This cannot be undone.')) {
      srs.reset();
      updateStats();
      renderHardest();
      next();
    }
  });

  document.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // View switching works from any view, but never while typing in a field
    // (so the answer input keeps receiving text and selects keep typeahead).
    if (!typing && (e.key === 'p' || e.key === 'o' || e.key === 'f' || e.key === 'k')) {
      e.preventDefault();
      switchView({ p: 'practice', o: 'overview', f: 'fretboard', k: 'keys' }[e.key]);
      return;
    }

    if (!els.views.practice.hidden) {
      // H toggles the intervals hint (same as the checkbox below the question).
      if (!typing && e.key === 'h') {
        e.preventDefault();
        els.hintCheck.checked = !els.hintCheck.checked;
        srs.setSetting('hint', els.hintCheck.checked);
        updateHint();
        return;
      }
      // Escape elsewhere returns to Practice.
      if (e.key === 'Escape') {
        e.preventDefault();
        switchView('practice');
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault(); // don't let a focused button fire too
      if (mode === 'asking') check();
      else if (mode === 'answered' && Date.now() - answeredAt > 200) {
        const suggested = els.ratingRow.querySelector('button.suggested');
        applyRating(suggested ? suggested.dataset.rating : 'good');
      }
      return;
    }
    if (mode === 'answered' && ['1', '2', '3', '4'].indexOf(e.key) !== -1) {
      applyRating(['again', 'hard', 'good', 'easy'][Number(e.key) - 1]);
      return;
    }
    if (mode === 'asking' && e.key === 'Escape') {
      e.preventDefault();
      finishAsk(null, ''); // reveal = skip the card
    }
  });

  /* ---------- boot ---------- */

  srs.prune(deck.map((card) => card.id)); // drop records for removed cards
  els.hintCheck.checked = !!srs.getSetting('hint', false);
  buildTypeFilters();
  updateStats();
  renderHardest();
  next();
})();
