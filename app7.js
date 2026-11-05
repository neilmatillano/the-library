// ---------- add books from a photo or screenshot ----------
const SRC_LABEL = { cover: 'book cover', kindle: 'Kindle list', audible: 'Audible list', goodreads: 'Goodreads page', shelf_photo: 'shelf photo', other: 'photo' };
let scanItems = [], scanSource = 'other', lookingUp = false;

const normT = s => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[:–—-].*$/, '').replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const findDup = it => books.find(b => normT(b.title) === normT(it.title) && (!it.author || !b.author || normT(b.author).split(' ').pop() === normT(it.author).split(' ').pop()));
const scanMsg = (t, err) => { const m = $('scan-msg'); m.textContent = t; m.classList.toggle('err', !!err); };

async function aiCall(body) {
  const { data, error } = await sb.functions.invoke('library-ai', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.message || msg; } catch (e) {}
    throw new Error(msg);
  }
  return data;
}

// shrink each image so it uploads fast and stays inside the API's limits
async function prepImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`Couldn't open ${file.name}. Try a JPEG or PNG screenshot.`)); i.src = url; });
    const max = 1568, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
  } finally { URL.revokeObjectURL(url); }
}

$('scan-input').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 6);
  e.target.value = '';
  if (!files.length) return;
  if (!navigator.onLine) { scanMsg('You’re offline. Reading photos needs a connection.', true); return; }
  $('scan-review').hidden = true; $('scan-pick').classList.add('busy');
  try {
    scanMsg(`Preparing ${files.length} image${files.length > 1 ? 's' : ''}…`);
    const images = [];
    for (const f of files) images.push(await prepImage(f));
    scanMsg('Reading the books in your image' + (files.length > 1 ? 's' : '') + '… this takes 10 to 30 seconds.');
    const res = await aiCall({ action: 'scan', images });
    scanSource = res.source || 'other';
    scanItems = (res.books || []).map((b, i) => {
      const dup = findDup(b);
      const list = b.status === 'read' || b.status === 'reading' ? 'read' : 'tbr';
      return { key: 'k' + i, title: b.title, author: b.author || '', series: b.series || '', genre: b.genre || 'fiction', status: b.status, list, confident: b.confident !== false, dup, on: !dup };
    });
    if (!scanItems.length) { scanMsg('No books found in that image. Try a sharper photo, or a screenshot of the list itself.', true); return; }
    scanMsg('');
    renderScan();
  } catch (err) {
    scanMsg('Couldn’t read that: ' + err.message, true);
  } finally { $('scan-pick').classList.remove('busy'); }
});

function renderScan() {
  const el = $('scan-review'), n = scanItems.filter(i => i.on).length;
  const gopts = sel => Object.entries(GENRES).map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');
  el.innerHTML = `<div class="scan-head"><b>${scanItems.length} book${scanItems.length > 1 ? 's' : ''} found</b> <span>in your ${esc(SRC_LABEL[scanSource] || 'photo')}. Untick any you don't want, and fix anything misread.</span></div>
    <div class="scan-list">${scanItems.map(it => `
      <div class="scan-item${it.on ? '' : ' off'}" data-k="${it.key}">
        <label class="scan-check"><input type="checkbox" data-f="on" ${it.on ? 'checked' : ''} aria-label="Add ${esc(it.title)}"></label>
        ${it.dup && !it.on ? `<div class="scan-fields"><div class="scan-t">${esc(it.title)}</div><div class="by">${esc(it.author)}</div>` : `<div class="scan-fields">
          <input type="text" data-f="title" value="${esc(it.title)}" aria-label="Title">
          <input type="text" data-f="author" value="${esc(it.author)}" placeholder="Author" aria-label="Author">
          <div class="scan-row">
            <input type="text" data-f="series" value="${esc(it.series)}" placeholder="Series #" aria-label="Series">
            <select data-f="genre" aria-label="Genre">${gopts(it.genre)}</select>
            <select data-f="list" aria-label="Shelf"><option value="tbr" ${it.list === 'tbr' ? 'selected' : ''}>To read</option><option value="read" ${it.list === 'read' ? 'selected' : ''}>Read</option></select>
          </div>`}
          ${it.dup ? `<div class="scan-note">Already on your ${it.dup.list === 'read' ? 'Read' : 'To read'} shelf as “${esc(it.dup.title)}”</div>` : ''}
          ${!it.confident ? '<div class="scan-note">Partly unreadable, so check the title and author</div>' : ''}
        </div>
      </div>`).join('')}</div>
    <div class="ebtns"><button class="btn solid" type="button" id="scan-add" ${n ? '' : 'disabled'}>Add ${n} book${n === 1 ? '' : 's'}</button><button class="btn" type="button" id="scan-cancel">Cancel</button></div>`;
  el.hidden = false;
  $('scan-add').onclick = addScanned;
  $('scan-cancel').onclick = () => { scanItems = []; el.hidden = true; el.innerHTML = ''; };
}
$('scan-review').addEventListener('input', e => {
  const f = e.target.dataset.f, row = e.target.closest('.scan-item'); if (!f || !row) return;
  const it = scanItems.find(i => i.key === row.dataset.k); if (!it) return;
  if (f === 'on' && it.dup) { it.on = e.target.checked; renderScan(); return; }
  if (f === 'on') { it.on = e.target.checked; row.classList.toggle('off', !it.on); const n = scanItems.filter(i => i.on).length; const b = $('scan-add'); b.textContent = `Add ${n} book${n === 1 ? '' : 's'}`; b.disabled = !n; }
  else it[f] = e.target.value;
});

function addScanned() {
  const pick = scanItems.filter(i => i.on && i.title.trim());
  if (!pick.length) return;
  const via = SRC_LABEL[scanSource] || 'photo';
  const owned = scanSource === 'kindle' ? 'yes (Kindle)' : scanSource === 'audible' ? 'yes (Audible)' : '';
  let minOrder = books.reduce((m, b) => Math.min(m, b.order ?? 0), 0);
  const added = [];
  pick.slice().reverse().forEach((it, i) => {
    const b = { id: 'n' + Date.now() + '-' + i, list: it.list, title: it.title.trim(), author: it.author.trim(), series: it.series.trim(), genre: it.genre,
      status: it.list === 'read' ? (it.status === 'reading' ? 'reading' : 'finished') : '', priority: it.list === 'tbr' ? 'soon' : '',
      why: `From your ${via}`, source: `Added from your ${via} · ${fmtD(today())}`, owned, note: '', rating: 0, gr: 0, grn: 0, year: '', url: '',
      added: today(), confirm: false, order: --minOrder };
    books.push(b); added.unshift(b);
  });
  added.forEach(b => queue(b));
  scanItems = []; $('scan-review').hidden = true; $('scan-review').innerHTML = '';
  const lists = new Set(added.map(b => b.list));
  view = lists.size === 1 ? [...lists][0] : view; filter = 'all';
  render();
  scanMsg(`Added ${added.length} book${added.length > 1 ? 's' : ''}. Looking up their Goodreads ratings…`);
  lookupRatings(added);
}

// ---------- Goodreads ratings lookup ----------
async function lookupRatings(list) {
  if (lookingUp) return;
  const todo = list.filter(b => !b.gr && b.title);
  if (!todo.length) { updateMissing(); return; }
  if (!navigator.onLine) { scanMsg('Offline: ratings will need looking up later.', true); updateMissing(); return; }
  lookingUp = true; updateMissing();
  let done = 0, found = 0;
  try {
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      scanMsg(`Looking up Goodreads ratings… ${done} of ${todo.length}`);
      const res = await aiCall({ action: 'ratings', books: batch.map(b => ({ title: b.title, author: b.author, series: b.series })) });
      for (const r of res.results || []) {
        const b = batch[r.i]; if (!b || !r.found || !(r.gr > 0)) continue;
        b.gr = Math.round(r.gr * 100) / 100; b.grn = r.grn || 0;
        if (r.year && !b.year) b.year = String(r.year);
        if (r.url && /goodreads\.com\/book\/show\//.test(r.url)) b.url = r.url.startsWith('http') ? r.url : 'https://www.' + r.url.replace(/^\/*(www\.)?/, '');
        found++; queue(b);
      }
      done += batch.length; render();
    }
    scanMsg(found === todo.length ? (found === 1 ? 'Goodreads rating added.' : `Goodreads ratings added for all ${found} books.`) : `Goodreads ratings added for ${found} of ${todo.length}. The rest weren't found; check their titles.`);
  } catch (err) {
    scanMsg('Rating lookup stopped: ' + err.message, true);
  } finally { lookingUp = false; updateMissing(); }
}
function updateMissing() {
  const n = books.filter(b => !b.gr).length, btn = $('gr-missing');
  btn.hidden = !n; btn.disabled = lookingUp;
  btn.textContent = `Look up missing Goodreads ratings (${n})`;
}
$('gr-missing').onclick = () => lookupRatings(books.filter(b => !b.gr).slice(0, 20));
const _render = render;
render = function () { _render(); updateMissing(); };
