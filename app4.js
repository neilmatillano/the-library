function row(b) {
  const pct = b.gr ? Math.round(b.gr / 5 * 100) : 0;
  const gr = b.gr ? `<div class="gr"><b>${(+b.gr).toFixed(2)}</b><div class="bar"><i style="width:${pct}%"></i></div><small>${fmtN(b.grn)} ratings${b.year ? ' · ' + esc(b.year) : ''}</small></div>` : `<div class="gr"><small>No Goodreads rating yet</small></div>`;
  const title = b.url ? `<a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : `<span class="title">${esc(b.title)}</span>`;
  const by = [b.author, b.series].filter(Boolean).map(esc).join(' · ');
  let mine;
  if (b.list === 'read') {
    const r = +b.rating || 0;
    const stars = [1, 2, 3, 4, 5].map(n => `<button class="star ${r >= n ? 'on' : (r >= n - 0.5 ? 'half' : '')}" type="button" data-id="${b.id}" data-r="${n}" aria-label="Rate ${n} of 5">★</button>`).join('');
    const num = `<input class="myr" type="number" inputmode="decimal" min="0" max="5" step="0.1" data-id="${b.id}" data-k="rating" value="${r ? r : ''}" placeholder="–" aria-label="Your rating for ${esc(b.title)}, 0 to 5">`;
    const sel = `<select data-id="${b.id}" data-k="status" aria-label="Status for ${esc(b.title)}">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    mine = `<div class="mine"><div class="rate"><div class="stars" role="group" aria-label="Your rating">${stars}</div>${num}</div>${sel}</div>`;
  } else {
    const sel = `<select data-id="${b.id}" data-k="priority" aria-label="Priority for ${esc(b.title)}">${['next', 'soon', 'someday'].map(k => `<option value="${k}" ${b.priority === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select>`;
    mine = `<div class="mine">${sel}<button class="btn" type="button" data-id="${b.id}" data-act="start">Start reading</button></div>`;
  }
  const extra = b.list === 'read'
    ? (b.note ? `<div class="note">“${esc(b.note)}”</div>` : '') + (b.confirm ? `<div class="flag">Check this one: ${esc(b.source)} <button class="btn" type="button" data-id="${b.id}" data-act="yes">Yes, read it</button></div>` : `<div class="src">${esc(b.source)}${b.format ? ' · ' + esc(b.format) : ''}</div>`) + revline(b)
    : `<div class="src">${esc(b.why)}${b.owned && /^yes/.test(b.owned) ? ' · <b>owned</b> ' + esc(b.owned.replace(/^yes\s*/, '')) : ''}${b.note ? ' · ' + esc(b.note) : ''}</div>`;
  return `<div class="row g-${b.genre}"><div class="spine" title="${GENRES[b.genre] || ''}"></div><div class="info">${title}<div class="by">${by}</div>${extra}</div>${gr}${mine}</div>`;
}
function editor(b) {
  const r = b.review || {}, d = drafts[b.id], text = d != null ? d : (r.text || '');
  const my = +b.rating || 0, stars = r.stars != null && r.stars !== '' ? +r.stars : (my ? Math.min(5, Math.max(1, Math.round(my))) : 0);
  const starOpts = [0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${stars === n ? 'selected' : ''}>${n ? n + ' ★' : 'No rating'}</option>`).join('');
  const status = d != null && d !== (r.text || '') ? 'Unsaved changes' : r.posted ? 'Posted to Goodreads' + (r.postedAt ? ' · ' + fmtD(r.postedAt) : '') : r.text ? 'Saved' + (r.savedAt ? ' · ' + fmtD(r.savedAt) : '') : 'Not written yet';
  return `<div class="editor" id="ed" data-book="${b.id}">
    <div class="erow" style="justify-content:space-between"><h3>Your review of ${esc(b.title)}</h3><span class="estatus" id="ed-status">${status}</span></div>
    <textarea id="ed-text" placeholder="What did you think?" aria-label="Review of ${esc(b.title)}">${esc(text)}</textarea>
    <div class="erow">
      <label>Goodreads stars <select id="ed-stars">${starOpts}</select></label>
      <span class="ehint">${my ? `Your rating is ${my}. Goodreads only takes whole stars.` : 'Rate the book in its row to set a default.'}</span>
    </div>
    <div class="erow">
      <label>Date read <input type="date" id="ed-date" value="${esc(r.dateRead || '')}"></label>
      <label><input type="checkbox" id="ed-spoiler" ${r.spoiler ? 'checked' : ''}> Contains spoilers</label>
    </div>
    <div class="ebtns">
      <button class="btn solid" type="button" id="ed-save">Save review</button>
      <button class="btn" type="button" id="ed-copy">Copy review</button>
      ${b.url ? `<a class="btn" href="${esc(b.url)}" target="_blank" rel="noopener">Open on Goodreads</a>` : ''}
      <button class="btn" type="button" id="ed-posted">${r.posted ? 'Mark as not posted' : 'Mark as posted'}</button>
      ${r.text ? '<button class="btn danger" type="button" id="ed-del">Delete review</button>' : ''}
    </div>
    <p class="ehint" id="ed-msg"></p>
  </div>`;
}
function list() {
  if (!loaded) return;
  let items = ordered(books.filter(b => b.list === view).filter(match));
  if (sort === 'gr') items.sort((a, b) => (b.gr || 0) - (a.gr || 0));
  if (sort === 'mine') items.sort((a, b) => (+b.rating || 0) - (+a.rating || 0));
  if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'author') items.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
  $('list').innerHTML = items.length ? items.map(b => row(b) + (b.id === openId ? editor(b) : '')).join('')
    : `<div class="empty">${books.length ? 'No books match. Clear the search or pick another filter.' : 'No books yet. Use “Add a book” below to start your shelves.'}</div>`;
  wireEditor();
}
function render() {
  $('tab-read').setAttribute('aria-selected', view === 'read'); $('tab-tbr').setAttribute('aria-selected', view === 'tbr');
  stats(); renderPicks(); chips(); list();
}
