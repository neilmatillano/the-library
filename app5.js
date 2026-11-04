// ---------- editing ----------
function change(b) { render(); queue(b); }
function saveDrafts() { lsSet(key('drafts'), drafts); }
function commit(b, extra) {
  const text = $('ed-text').value.trim();
  const rev = Object.assign({}, b.review || {}, { text, stars: +$('ed-stars').value || 0, dateRead: $('ed-date').value || '', spoiler: $('ed-spoiler').checked, savedAt: today() }, extra || {});
  if (!rev.text && !rev.posted) delete b.review; else b.review = rev;
  delete drafts[b.id]; saveDrafts();
  change(b);
}
function wireEditor() {
  const ed = $('ed'); if (!ed) return; const b = find(ed.dataset.book); if (!b) return;
  const ta = $('ed-text'), msg = t => { $('ed-msg').textContent = t; };
  ta.addEventListener('input', () => { drafts[b.id] = ta.value; saveDrafts(); $('ed-status').textContent = 'Unsaved changes'; });
  $('ed-save').onclick = () => { if (!ta.value.trim() && !(b.review && b.review.text)) { msg('Write something first.'); ta.focus(); return; } commit(b); };
  $('ed-copy').onclick = async () => {
    const t = ta.value.trim(); if (!t) { msg('Nothing to copy yet.'); return; }
    try { await navigator.clipboard.writeText(t); msg('Copied. Paste it into the review box on Goodreads.'); }
    catch (e) { ta.focus(); ta.select(); msg('Copying was blocked. The text is selected, so copy it from there.'); }
  };
  $('ed-posted').onclick = () => {
    const posted = !!(b.review && b.review.posted);
    if (!posted && !ta.value.trim()) { msg('Write and save the review first.'); return; }
    commit(b, posted ? { posted: false, postedAt: '' } : { posted: true, postedAt: today() });
  };
  const del = $('ed-del'); if (del) del.onclick = () => {
    if (del.dataset.armed) { delete b.review; delete drafts[b.id]; saveDrafts(); openId = null; change(b); }
    else { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; }
  };
}

$('list').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const b = find(t.dataset.id); if (!b) return;
  if (t.dataset.act === 'expand') { expId = expId === b.id ? null : b.id; if (expId !== b.id && openId === b.id) openId = null; list(); return; }
  if (t.dataset.act === 'review') { openId = openId === b.id ? null : b.id; list(); const ta = $('ed-text'); if (ta) ta.focus(); return; }
  if (t.dataset.r) { const r = +t.dataset.r; b.rating = b.rating === r ? 0 : r; change(b); }
  else if (t.dataset.act === 'yes') { b.confirm = false; if (b.status !== 'paused' && b.status !== 'reading') b.status = 'finished'; change(b); }
  else if (t.dataset.act === 'start') { b.list = 'read'; b.status = 'reading'; b.confirm = false; b.source = (b.source || '') + ' · started ' + today(); change(b); }
});
$('list').addEventListener('change', e => {
  const s = e.target; if (!s.dataset || !s.dataset.k) return; const b = find(s.dataset.id); if (!b) return;
  if (s.dataset.k === 'status') { b.confirm = false; if (s.value === 'unread') { b.list = 'tbr'; b.status = ''; b.priority = b.priority || 'soon'; b.why = b.why || 'Moved back from Read'; } else b.status = s.value; }
  if (s.dataset.k === 'priority') b.priority = s.value;
  if (s.dataset.k === 'rating') { const v = parseFloat(s.value); b.rating = isNaN(v) ? 0 : Math.round(Math.min(5, Math.max(0, v)) * 10) / 10; }
  change(b);
});
$('tab-read').onclick = () => { view = 'read'; filter = 'all'; render(); };
$('tab-tbr').onclick = () => { view = 'tbr'; filter = 'all'; render(); };
$('q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); list(); });
$('sort').addEventListener('change', e => { sort = e.target.value; list(); });
$('addform').addEventListener('submit', e => {
  e.preventDefault(); const t = $('a-title').value.trim(); if (!t) return;
  const lst = $('a-list').value;
  const minOrder = books.reduce((m, b) => Math.min(m, b.order ?? 0), 0);
  const b = { id: 'n' + Date.now(), list: lst, title: t, author: $('a-author').value.trim(), series: $('a-series').value.trim(), genre: $('a-genre').value,
    status: lst === 'read' ? 'finished' : '', priority: lst === 'tbr' ? 'soon' : '', why: $('a-why').value.trim() || 'Added by you', source: 'Added by you',
    owned: '', note: '', rating: 0, gr: 0, grn: 0, year: '', url: '', added: today(), confirm: false, order: minOrder - 1 };
  books.push(b); e.target.reset(); view = lst; filter = 'all'; change(b);
});

// ---------- read-next card, bottom bar, search ----------
$('picks').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.act === 'morepicks') { picksOpen = !picksOpen; renderPicks(); return; }
  if (t.dataset.act === 'startpick') {
    const b = find(t.dataset.id); if (!b) return;
    b.list = 'read'; b.status = 'reading'; b.confirm = false; b.source = (b.source || '') + ' · started ' + today();
    view = 'read'; filter = 'all'; expId = b.id; change(b);
  }
});
const goTo = id => {
  const el = $(id); if (!el || el.hidden) return;
  if (el.tagName === 'DETAILS') el.open = true;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (id === 'addbox') setTimeout(() => $('a-title').focus({ preventScroll: true }), 350);
};
document.querySelectorAll('.tabbar button').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('.tabbar button').forEach(x => x.removeAttribute('aria-current'));
  btn.setAttribute('aria-current', 'page');
  goTo(btn.dataset.go);
});
$('search-btn').onclick = () => { goTo('shelves'); setTimeout(() => $('q').focus({ preventScroll: true }), 350); };
(() => {
  const demo = ['scifi', 'scifi', 'fantasy', 'romantasy', 'litrpg', 'litrpg', 'litrpg', 'fantasy', 'romantasy', 'scifi', 'fantasy', 'fantasy', 'romantasy', 'romantasy', 'nonfiction', 'fantasy', 'scifi', 'litrpg', 'romantasy', 'fantasy', 'fiction', 'scifi', 'fantasy', 'romantasy', 'litrpg', 'fantasy', 'scifi', 'romantasy', 'fantasy', 'fantasy', 'scifi', 'litrpg', 'fantasy', 'romantasy', 'scifi', 'fantasy', 'nonfiction', 'romantasy', 'fantasy', 'litrpg', 'scifi', 'fantasy'];
  $('auth-spines').innerHTML = spinesHTML(demo.map((g, i) => ({ id: 'd' + i, genre: g })));
})();
