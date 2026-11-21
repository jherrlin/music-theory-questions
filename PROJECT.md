# Music theory flashcards

A pure JavaScript and HTML app (no build step, no dependencies — just open
`index.html` in a browser) that shows flashcards with music theory questions.
Everything the user does is saved in the browser (localStorage).

## Spaced repetition

- SM-2/Anki-style scheduling: each answer is rated **Again / Hard / Good / Easy**,
  which updates a per-card ease factor and interval
- **Answers that are answered wrong come back more often**: an "Again" answer
  resurfaces the card within a minute, often-wrong cards (≥50% wrong rate) are
  pulled forward before they are due, and high wrong-rate cards are preferred
  whenever nothing is due
- Per-card results (reviews, correct/wrong, ease, due date, streak) are saved in
  localStorage; a "problem cards" list shows the worst offenders, and all
  progress can be reset

## Questions

- **Chord tones** — "Which tones are in the chord Cmaj7?" (14 chord types × 12 keys)
- **Scale tones** — "Which tones are in the D Dorian scale?" (12 scales × 12 keys)
- **Chord intervals** / **Scale intervals** — key-independent questions, since the
  intervals of a chord or scale type are the same in every key
- Notes are compared as pitch classes (order/spelling-insensitive, `Db` = `C#`),
  intervals as semitones (enharmonics allowed, `b3` = `♭3`); answers always show
  the correct spellings (e.g. Ab minor = Ab–Bb–Cb–Db–Eb–Fb–Gb)

## Views

- **Practice** — the flashcard flow: type an answer, check it, rate the card.
  Includes a "Show on fretboard" link to the matching Fretboard selection, an
  optional "Show intervals" hint toggle (scale/chord tone cards) that reveals the
  interval pattern without giving away the answer, a collapsible help section with
  a plain all-tones mandolin fretboard, and per-card-type filters
- **Overview** — every question in the deck with its answer, grouped by type,
  downloadable as a Markdown file
- **Fretboard** — a mandolin fretboard (G–D–A–E courses, frets 0–15, nut line,
  open-string zone) that highlights a chosen chord or scale, with note-name or
  interval labels (highlighted tones show both). Clicking any tone (including the
  open string) plays it as a plucked string (Web Audio, Karplus-Strong)
- **Keys** — reference for all keyboard shortcuts

## Keyboard driven

The whole flow is usable with only the keyboard (see the Keys view):

- `P` / `O` / `F` / `K` — switch to Practice / Overview / Fretboard / Keys
- `Enter` — check the typed answer, then apply the suggested rating
- `1`–`4` — rate Again / Hard / Good / Easy (after checking)
- `Space` — show the answer when the answer field is not focused
- `Esc` — skip the card and reveal the answer while a question is showing;
  back to Practice from other views
- Dropdowns, checkboxes, and buttons work with the usual Tab / arrow keys / Space

## Files

- `index.html`, `styles.css`
- `js/theory.js` — theory data, note spelling, answer parsing, deck generation
- `js/srs.js` — scheduling and localStorage persistence
- `js/app.js` — practice UI (card flow, grading, rating, stats)
- `js/overview.js` — overview view + Markdown download
- `js/fretboard.js` — fretboard rendering (guide board + help board) and tone playback

## Cache busting

A `pre-commit` hook (in `hooks/`) appends a content hash to every `js/*.js` and
`styles.css` reference in `index.html` (`js/app.js?v=1a2b3c4d`), so browsers pick
up changed assets instead of stale cached ones. The hook rewrites and re-stages
`index.html` on every commit. After cloning, enable it once with:

```
git config core.hooksPath hooks
```
