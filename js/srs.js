/* Spaced repetition scheduling (SM-2/Anki-style) + localStorage persistence. */
(function () {
  'use strict';

  const STORAGE_KEY = 'music-theory-flashcards:v1';
  const MIN_MS = 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const LEARN_AGAIN_MS = 1 * MIN_MS; // "Again" resurfaces the card within the session
  const LEARN_HARD_MS = 5 * MIN_MS;
  const MAX_INTERVAL_DAYS = 365;
  const REC_DEFAULTS = { ease: 2.5, interval: 0, due: 0, last: null, reps: 0, correct: 0, wrong: 0, streak: 0 };
  const STRUGGLE_MIN_REPS = 3; // a card only counts as "struggling" after a few attempts
  const STRUGGLE_WINDOW_MS = 12 * 60 * 60 * 1000; // ...and we only pull it forward within 12h of due

  let state = load();

  function load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 1 && parsed.cards) {
            return { version: 1, cards: parsed.cards, settings: parsed.settings || {} };
          }
        }
      }
    } catch (e) {
      console.warn('Could not read saved progress, starting fresh.', e);
    }
    return { version: 1, cards: {}, settings: {} };
  }

  function save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      console.warn('Could not save progress (storage unavailable or full).', e);
    }
  }

  function getRec(cardId) {
    let rec = state.cards[cardId];
    if (!rec) {
      rec = Object.assign({}, REC_DEFAULTS);
      state.cards[cardId] = rec;
    }
    return rec;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // Apply a rating to a record's scheduling fields (ease/interval/due). Pure with
  // respect to the stats counters, which are handled by grade().
  function schedule(rec, rating, now) {
    switch (rating) {
      case 'again':
        // Wrong: shorten ease and resurface in a minute so it repeats this session.
        rec.ease = Math.max(1.3, round2(rec.ease - 0.20));
        rec.interval = 0;
        rec.due = now + LEARN_AGAIN_MS;
        break;
      case 'hard':
        rec.ease = Math.max(1.3, round2(rec.ease - 0.15));
        if (rec.interval === 0) {
          rec.due = now + LEARN_HARD_MS; // still learning
        } else {
          rec.interval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(rec.interval * 1.2)));
          rec.due = now + rec.interval * DAY_MS;
        }
        break;
      case 'easy':
        rec.ease = Math.min(3.0, round2(rec.ease + 0.15));
        rec.interval = rec.interval === 0
          ? 4
          : Math.min(MAX_INTERVAL_DAYS, Math.round(rec.interval * rec.ease * 1.3));
        rec.due = now + rec.interval * DAY_MS;
        break;
      default: // 'good'
        rec.interval = rec.interval === 0
          ? 1
          : Math.min(MAX_INTERVAL_DAYS, Math.ceil(rec.interval * rec.ease));
        rec.due = now + rec.interval * DAY_MS;
    }
  }

  // Record an answer. `wasCorrect` reflects what the user actually typed (used for
  // stats and the wrong-rate); `rating` is the self-assessment used for scheduling.
  function grade(cardId, rating, wasCorrect, now) {
    const rec = getRec(cardId);
    rec.last = now;
    rec.reps++;
    if (wasCorrect) {
      rec.correct++;
      rec.streak++;
    } else {
      rec.wrong++;
      rec.streak = 0;
    }
    schedule(rec, rating, now);
    save();
    return rec;
  }

  // Human-readable next-interval label for a rating button, without grading.
  function preview(cardId, rating, now) {
    const rec = Object.assign({}, state.cards[cardId] || REC_DEFAULTS);
    schedule(rec, rating, now);
    const ms = rec.due - now;
    if (ms < 60 * MIN_MS) return Math.max(1, Math.round(ms / MIN_MS)) + ' min';
    const days = Math.round(ms / DAY_MS);
    return days + ' d';
  }

  function wrongRate(rec) {
    return rec.reps > 0 ? rec.wrong / rec.reps : 0;
  }

  // Choose the next card:
  //   1. anything due right now (earliest due wins) — "Again" cards come back within
  //      a minute, so wrong answers naturally repeat more often;
  //   2. otherwise a "struggling" card (often wrong, due within 12h) is pulled forward;
  //   3. otherwise a never-seen card is introduced;
  //   4. otherwise the least-recently-seen card, preferring high wrong rates.
  function pickNext(cards, now) {
    const seen = [];
    const fresh = [];
    for (const card of cards) {
      const rec = state.cards[card.id];
      if (rec && rec.reps > 0) seen.push([card, rec]);
      else fresh.push(card);
    }

    const due = seen.filter(([, rec]) => rec.due <= now);
    if (due.length) {
      let minDue = Infinity;
      let pool = [];
      for (const [card, rec] of due) {
        if (rec.due < minDue) {
          minDue = rec.due;
          pool = [card];
        } else if (rec.due === minDue) {
          pool.push(card);
        }
      }
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const struggling = seen.filter(([, rec]) =>
      rec.reps >= STRUGGLE_MIN_REPS && wrongRate(rec) >= 0.5 && rec.due <= now + STRUGGLE_WINDOW_MS);
    if (struggling.length) {
      struggling.sort((a, b) => a[1].due - b[1].due);
      return struggling[0][0];
    }

    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];

    seen.sort((a, b) => (wrongRate(b[1]) - wrongRate(a[1])) || (a[1].last - b[1].last));
    const top = seen.slice(0, Math.min(3, seen.length));
    return top[Math.floor(Math.random() * top.length)][0];
  }

  function counts(cards, now) {
    let due = 0;
    let fresh = 0;
    let seen = 0;
    let reviews = 0;
    let correct = 0;
    let wrong = 0;
    for (const card of cards) {
      const rec = state.cards[card.id];
      if (!rec || rec.reps === 0) {
        fresh++;
        continue;
      }
      seen++;
      reviews += rec.reps;
      if (rec.due <= now) due++;
      correct += rec.correct;
      wrong += rec.wrong;
    }
    const answered = correct + wrong;
    return {
      due: due,
      fresh: fresh,
      seen: seen,
      reviews: reviews,
      accuracy: answered ? Math.round((100 * correct) / answered) : null,
    };
  }

  // Cards with the worst wrong-rate (at least a couple of attempts) — for the
  // "problem cards" list in the stats panel.
  function hardest(cards, limit) {
    const rows = [];
    for (const card of cards) {
      const rec = state.cards[card.id];
      if (rec && rec.reps >= 2 && rec.wrong > 0) rows.push({ card: card, rec: rec });
    }
    rows.sort((a, b) =>
      (wrongRate(b.rec) - wrongRate(a.rec)) || (b.rec.wrong - a.rec.wrong));
    return rows.slice(0, limit || 8);
  }

  function getTypes() {
    const t = state.settings && state.settings.types;
    return t ? t.slice() : null;
  }

  function setTypes(types) {
    state.settings = state.settings || {};
    state.settings.types = types;
    save();
  }

  function getSetting(key, fallback) {
    if (state.settings && state.settings[key] !== undefined) return state.settings[key];
    return fallback;
  }

  function setSetting(key, value) {
    state.settings = state.settings || {};
    state.settings[key] = value;
    save();
  }

  function reset() {
    state = { version: 1, cards: {}, settings: state.settings };
    save();
  }

  window.MT = window.MT || {};
  window.MT.srs = {
    grade: grade,
    preview: preview,
    pickNext: pickNext,
    counts: counts,
    hardest: hardest,
    getTypes: getTypes,
    setTypes: setTypes,
    getSetting: getSetting,
    setSetting: setSetting,
    reset: reset,
  };
})();
