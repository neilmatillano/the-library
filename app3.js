// ---------- rendering ----------
const read = () => books.filter(b => b.list === 'read');
const tbr = () => books.filter(b => b.list === 'tbr');
const find = id => books.find(b => b.id === id);
const ordered = arr => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
let expId = null, picksOpen = false;

// stable pseudo-random spine size from a book id
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function spinesHTML(list) {
  return list.slice(0, 90).map(b => {
    const h = hash(b.id || b.title), ht = 42 + (h % 27), w = 7 + ((h >>> 5) % 5);
    return `<i class="g-${esc(b.genre)}" style="height:${ht}px;flex-basis:${w}px"></i>`;
  }).join('');
}
function stats() {
  const r = read(), t = tbr();
  const unposted = r.filter(b => b.review && b.review.text && !b.review.posted).length;
  $('meta').innerHTML = `<span>${r.length} read</span><span>${t.length} to read</span>` +
    (unposted ? `<span>${unposted} review${unposted > 1 ? 's' : ''} unposted</span>` : '');
  $('spines').innerHTML = spinesHTML(ordered(r));
  $('n-read').textContent = r.length; $('n-tbr').textContent = t.length;
}
function coverLabel(b, L) {
  const s = (b && b.series) || '';
  const m = s.match(/^(.*?)\s*#\s*([\d.]+)$/);
  if (m && m[1] && m[1].length <= 6) return esc(m[1]) + ' ' + esc(m[2]);
  if (m && m[1]) return esc(m[1].split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 4)) + ' ' + esc(m[2]);
  return esc(((b && b.title) || L.title).split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase());
}
function renderPicks() {
  const el = $('picks');
  if (!picks || !picks.lead) { el.hidden = true; return; }
  const L = picks.lead, b = books.find(x => x.title === L.title);
  const rows = L.rows || [], why = rows[0] ? md(rows[0][1]) : '';
  const grTxt = b && b.gr ? `Goodreads ${(+b.gr).toFixed(2)}${b.grn ? ' · ' + fmtN(b.grn) : ''}` : '';
  const by = b ? [b.author, b.series].filter(Boolean).map(esc).join(' · ') : esc(L.sub || '');
  let main = '';
  if (b && b.list === 'tbr') main = `<button class="btn solid" type="button" data-act="startpick" data-id="${b.id}">Start reading</button>`;
  else if (b && b.list === 'read') main = `<span class="btn solid" aria-disabled="true" style="opacity:.75;cursor:default">${b.status === 'finished' ? 'On your Read shelf' : 'Reading now'}</span>`;
  else if (b && b.url) main = `<a class="btn solid" href="${esc(b.url)}" target="_blank" rel="noopener">Open on Goodreads</a>`;
  const hasMore = rows.length > 1 || (picks.alts || []).length || picks.note;
  el.innerHTML = `<div class="pick-head"><span class="eyebrow">Read next</span>${grTxt ? `<span class="mono">${grTxt}</span>` : ''}</div>
    <div class="pick-body">${pickCoverHTML(b, L)}
      <div class="pick-text"><h2>${esc(L.title)}</h2><div class="by">${by}</div>${why ? `<p>${why}</p>` : ''}</div></div>
    <div class="pick-btns">${main}${hasMore ? `<button class="btn quiet" type="button" data-act="morepicks" aria-expanded="${picksOpen}">${picksOpen ? 'Fewer details' : `<span class="pick-strip">${(picks.alts || []).slice(0, 3).map(altCoverHTML).join('')}</span>Other picks`}</button>` : ''}</div>
    ${hasMore && picksOpen ? `<div class="pick-more">
      ${rows.length > 1 ? `<dl class="kv">${rows.slice(1).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${md(v)}</dd>`).join('')}</dl>` : ''}
      ${(picks.alts || []).length ? `<div class="alts">${picks.alts.map(a => `<div class="alt">${altCoverHTML(a)}<span class="tag">${esc(a.tag)}</span><h3>${esc(a.title)}</h3><p>${md(a.text)}</p></div>`).join('')}</div>` : ''}
      ${picks.note ? `<div class="honest">${md(picks.note)}</div>` : ''}</div>` : ''}`;
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
