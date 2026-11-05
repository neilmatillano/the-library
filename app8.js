// ---------- book covers ----------
// b.cover: an image URL or data URL; 'none' once a lookup found nothing; undefined = not looked up yet
const hasCover = b => !!(b && b.cover && b.cover !== 'none');
const initials = b => esc(String(b.title || '').replace(/^(the|a|an)\s+/i, '').split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase());

function coverHTML(b) {
  return `<span class="thumb g-${esc(b.genre)}" aria-hidden="true"><span class="thumb-i">${initials(b)}</span>` +
    (hasCover(b) ? `<img src="${esc(b.cover)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '') + '</span>';
}
function coverBtn(b) {
  return `<label class="btn small quiet"><input type="file" accept="image/*" class="sr-only" data-cover="${b.id}">${b.coverOwn ? 'Change photo' : 'Use my photo as cover'}</label>` +
    (b.coverOwn ? `<button class="btn small quiet" type="button" data-id="${b.id}" data-act="uncover">Use online cover</button>` : '');
}

// shrink an image (File or data URL) to a cover thumbnail stored with the book
async function makeThumb(src) {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Couldn’t open that image.')); i.src = url; });
    const k = Math.min(1, 300 / img.naturalHeight, 220 / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { if (typeof src !== 'string') URL.revokeObjectURL(url); }
}

$('list').addEventListener('change', async e => {
  const inp = e.target; if (!inp.dataset || !inp.dataset.cover) return;
  const b = find(inp.dataset.cover), f = inp.files && inp.files[0]; if (!b || !f) return;
  try { b.cover = await makeThumb(f); b.coverOwn = true; change(b); }
  catch (err) { inp.closest('.rowbody')?.insertAdjacentHTML('beforeend', `<p class="ehint" style="color:var(--warn)">${esc(err.message)}</p>`); }
});
$('list').addEventListener('click', e => {
  const t = e.target.closest('button[data-act=uncover]'); if (!t) return;
  const b = find(t.dataset.id); if (!b) return;
  delete b.cover; delete b.coverOwn; change(b);
});

// look up covers on Open Library for books that don't have one yet
const tried = new Set();
let coverTimer = null, coverRunning = false;
async function olCover(b) {
  const q = async p => {
    const r = await fetch('https://openlibrary.org/search.json?' + new URLSearchParams({ ...p, limit: 5, fields: 'cover_i' }));
    if (!r.ok) throw new Error('ol ' + r.status);
    const j = await r.json();
    return ((j.docs || []).map(d => d.cover_i).filter(Boolean)[0]) || null;
  };
  const title = String(b.title).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const author = String(b.author || '').split(/\s*&\s*/)[0];
  let id = await q(author ? { title, author } : { title });
  if (!id && author) id = await q({ q: `${title} ${author.split(/\s+/).pop()}` });
  return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : 'none';
}
async function fetchCovers() {
  if (coverRunning || !navigator.onLine || !user) return;
  const todo = books.filter(b => b.cover === undefined && !tried.has(b.id) && b.title);
  if (!todo.length) return;
  coverRunning = true;
  let changed = 0;
  try {
    for (let i = 0; i < todo.length; i += 3) {
      await Promise.all(todo.slice(i, i + 3).map(async b => {
        tried.add(b.id);
        try { const c = await olCover(b); if (b.cover === undefined) { b.cover = c; queue(b); changed++; } } catch (e) {}
      }));
      if (changed) { list(); renderPicks(); changed = 0; }
    }
  } finally { coverRunning = false; }
}
const _render8 = render;
render = function () { _render8(); clearTimeout(coverTimer); coverTimer = setTimeout(fetchCovers, 800); };
window.addEventListener('online', () => fetchCovers());

// ---------- covers for the suggested reads ----------
// suggestions not on a shelf get their cover looked up once and remembered on this device
const pickCovers = (() => { try { return JSON.parse(localStorage.getItem('lib:pickcovers') || '{}'); } catch (e) { return {}; } })();
const normPick = s => String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
let pickLookup = false;
function pickCoverURL(title, author) {
  const b = books.find(x => normPick(x.title) === normPick(title));
  if (hasCover(b)) return b.cover;
  const c = pickCovers[normPick(title)];
  if (c === undefined && !pickLookup && navigator.onLine) {
    pickLookup = true;
    olCover({ title, author: author || (b && b.author) || '' })
      .then(u => { pickCovers[normPick(title)] = u; try { localStorage.setItem('lib:pickcovers', JSON.stringify(pickCovers)); } catch (e) {} renderPicks(); })
      .catch(() => { pickCovers[normPick(title)] = 'none'; })
      .finally(() => { pickLookup = false; });
  }
  return c && c !== 'none' ? c : '';
}
function pickCoverHTML(b, L) {
  const url = pickCoverURL(L.title, b && b.author);
  return url ? `<img class="cover-img" src="${esc(url)}" alt="" width="58" height="86">`
    : `<div class="cover g-${esc((b && b.genre) || 'fiction')}" aria-hidden="true">${coverLabel(b, L)}</div>`;
}
function altCoverHTML(a) {
  const author = (String(a.text || '').match(/^([^,·*]+),/) || [])[1] || '';
  const b = books.find(x => normPick(x.title) === normPick(a.title));
  const url = pickCoverURL(a.title, author.trim());
  return `<span class="thumb g-${esc((b && b.genre) || 'fiction')}" aria-hidden="true"><span class="thumb-i">${initials({ title: a.title })}</span>` +
    (url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : '') + '</span>';
}
