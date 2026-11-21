/* Overview view: every question with its answer, downloadable as Markdown. */
(function () {
  'use strict';

  const deck = window.MT.buildDeck();

  const GROUPS = [
    ['chord-notes', 'Chord tones'],
    ['chord-intervals', 'Chord intervals'],
    ['scale-notes', 'Scale tones'],
    ['scale-intervals', 'Scale intervals'],
  ];

  function markdown() {
    const lines = ['# Music Theory Flashcards — Overview', ''];
    for (const [type, label] of GROUPS) {
      const cards = deck.filter((c) => c.type === type);
      lines.push('## ' + label + ' (' + cards.length + ')', '');
      for (const card of cards) {
        lines.push('### ' + card.prompt, '', card.answerText, '');
      }
    }
    return lines.join('\n').trimEnd() + '\n';
  }

  function render() {
    const host = document.getElementById('overview-content');
    if (host.childElementCount) return; // built once; the deck is static
    for (const [type, label] of GROUPS) {
      const cards = deck.filter((c) => c.type === type);
      const h2 = document.createElement('h2');
      h2.textContent = label + ' (' + cards.length + ')';
      host.appendChild(h2);
      const grid = document.createElement('div');
      grid.className = 'qa-grid';
      for (const card of cards) {
        const item = document.createElement('div');
        item.className = 'qa';
        const q = document.createElement('div');
        q.className = 'qa-q';
        q.textContent = card.prompt;
        const a = document.createElement('div');
        a.className = 'qa-a';
        a.textContent = card.answerText;
        item.appendChild(q);
        item.appendChild(a);
        grid.appendChild(item);
      }
      host.appendChild(grid);
    }
  }

  function download() {
    const blob = new Blob([markdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'music-theory-flashcards.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById('download-md').addEventListener('click', download);

  window.MT.overview = { render: render, markdown: markdown };
})();
