// ---------- rendering ----------
const read = () => books.filter(b => b.list === 'read');
const tbr = () => books.filter(b => b.list === 'tbr');
const find = id => books.find(b => b.id === id);
const ordered = arr => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

function stats() {
  const r = read(), fin = r.filter(b => b.status === 'finished' && !b.confirm);
  const rated = fin.filter(b => b.gr), avg = rated.length ? (rated.reduce((a, b) => a + b.gr, 0) / rated.length).toFixed(2) : '–';
  const mineR = r.filter(b => +b.rating > 0);
  const mineAvg = mineR.length ? ` · yours: ${(mineR.reduce((a, b) => a + (+b.rating), 0) / mineR.length).toFixed(2)} across ${mineR.length}` : '';
  $('stats').innerHTML =
    `<div class="stat"><b>${fin.length}</b><span>books finished</span></div>` +
    `<div class="stat"><b>${avg}</b><span>average Goodreads score of what you've finished${mineAvg}</span></div>`;
  $('meta').textContent = `${books.length} books across both shelves`;
  $('n-read').textContent = r.length; $('n-tbr').textContent = tbr().length;
}
function renderPicks() {
  const el = $('picks');
  if (!picks || !picks.lead) { el.hidden = true; return; }
  const L = picks.lead;
  el.innerHTML = `<div class="lead"><div class="eyebrow">${esc(L.eyebrow || 'Next read')}</div>
      <h2>${esc(L.title)} <small>${esc(L.sub || '')}</small></h2>
      <dl class="kv">${(L.rows || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${md(v)}</dd>`).join('')}</dl></div>
    <div class="alts">${(picks.alts || []).map(a => `<div class="alt"><span class="tag">${esc(a.tag)}</span><h3>${esc(a.title)}</h3><p>${md(a.text)}</p></div>`).join('')}</div>
    ${picks.note ? `<div class="honest">${md(picks.note)}</div>` : ''}`;
  el.hidden = false;
}
function chips() {
  const opts = view === 'read'
    ? [['all', 'All'], ['finished', 'Finished'], ['reading', 'Reading or paused'], ['confirm', 'To confirm'], ['reviewed', 'Has review'], ['unposted', 'Review not posted']]
    : [['all', 'All'], ['next', 'Next'], ['soon', 'Soon'], ['someday', 'Someday'], ['owned', 'Owned'], ['rec', 'Claude picks']];
  $('chips').innerHTML = opts.map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('');
  $('chips').querySelectorAll('.chip').forEach(c => c.onclick = () => { filter = c.dataset.f; render(); });
  const present = new Set(books.filter(b => b.list === view).map(b => b.genre));
  $('legend').innerHTML = Object.entries(GENRES).filter(([k]) => present.has(k)).map(([k, l]) => `<span class="g-${k}"><i></i>${l}</span>`).join('');
}
function match(b) {
  if (q) { const h = (b.title + ' ' + b.author + ' ' + (b.series || '')).toLowerCase(); if (!h.includes(q)) return false; }
  if (view === 'read') {
    if (filter === 'finished') return b.status === 'finished' && !b.confirm;
    if (filter === 'reading') return b.status === 'reading' || b.status === 'paused';
    if (filter === 'confirm') return b.confirm;
    if (filter === 'reviewed') return !!(b.review && b.review.text);
    if (filter === 'unposted') return !!(b.review && b.review.text && !b.review.posted);
    return true;
  }
  if (filter === 'owned') return /^yes/.test(b.owned || '');
  if (filter === 'rec') return /^Claude/.test(b.source || '');
  if (['next', 'soon', 'someday'].includes(filter)) return b.priority === filter;
  return true;
}
function revline(b) {
  const r = b.review, has = !!(r && r.text), open = openId === b.id;
  const pill = has ? (r.posted ? '<span class="pill posted">Posted to Goodreads</span>' : '<span class="pill">Review drafted</span>') : '';
  const label = open ? 'Close review' : (has ? 'Edit review' : 'Write review');
  return `<div class="revline">${pill}<button class="btn small" type="button" data-id="${b.id}" data-act="review" aria-expanded="${open}">${label}</button></div>`;
}
