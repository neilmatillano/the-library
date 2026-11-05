// ---------- community: feed, people, profiles, book pages, inbox ----------
let me = null, viewToken = 0, feedMode = 'following', feedItems = [], feedDone = false, inboxData = null;
const postsById = new Map();
const isOwner = () => !!(user && (user.email || '').toLowerCase() === 'neil.matillano@gmail.com');

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  home: svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  shelves: svg('<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 2.5 15.5-3.5 1z"/>'),
  plus: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  bell: svg('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  heart: svg('<path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 9-3 4.6 4.6 0 0 1 9 3c-2 4.6-9 9-9 9z"/>'),
  comment: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  want: svg('<path d="M6 3h12v18l-6-4-6 4z"/><path d="M12 7v6M9 10h6"/>'),
  send: svg('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>'),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  trash: svg('<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
};

const ago = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const hue = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avHTML = (u, cls = '') => u && u.avatar
  ? `<img class="av ${cls}" src="${esc(u.avatar)}" alt="">`
  : `<span class="av ${cls}" style="--h:${hue(u && u.handle)}" aria-hidden="true">${esc(((u && u.name) || '?').trim()[0] || '?').toUpperCase()}</span>`;
const bookHref = b => `#book/${encodeURIComponent((b && b.title) || '')}/${encodeURIComponent((b && b.author) || '')}`;
const starsHTML = r => { r = +r || 0; if (!r) return ''; return `<span class="rstars" role="img" aria-label="Rated ${r} out of 5">${[1, 2, 3, 4, 5].map(n => `<i class="${r >= n ? 'on' : r >= n - 0.5 ? 'half' : ''}">★</i>`).join('')}<b>${r % 1 ? r.toFixed(1) : r}</b></span>`; };
const snapOf = b => ({ id: b.id, title: b.title, author: b.author || '', series: b.series || '', genre: b.genre || 'fiction', gr: b.gr || 0, url: b.url || '',
  cover: hasCover(b) && (String(b.cover).startsWith('http') || String(b.cover).length < 40000) ? b.cover : null });
const findMine = t => books.find(x => normPick(x.title) === normPick(t));

function toast(msg) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800);
}
function sheet(label, html) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheet';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet-h"><h2>${esc(label)}</h2><button class="iconbtn" type="button" data-close aria-label="Close">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div><div class="sheet-b">${html}</div></div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(); });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  document.body.appendChild(bg); document.body.classList.add('noscroll');
  setTimeout(() => (bg.querySelector('input,textarea,button:not([data-close])') || bg).focus(), 30);
  return bg;
}
function closeSheet() { const s = $('sheet'); if (s) s.remove(); document.body.classList.remove('noscroll'); }

// ---------- invites before sign-in ----------
const pendingInvite = () => { try { return localStorage.getItem('lib:invite') || ''; } catch (e) { return ''; } };
(() => {
  const p = new URLSearchParams(location.search), c = p.get('invite');
  if (c) {
    try { localStorage.setItem('lib:invite', c.trim().toUpperCase()); } catch (e) {}
    p.delete('invite'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  const code = pendingInvite(); if (!code) return;
  sb.rpc('invite_info', { p_code: code }).then(({ data }) => {
    if (!data || !data.valid) return;
    const f = $('authform'); if (!f || $('invite-note')) return;
    f.insertAdjacentHTML('afterbegin', `<p class="invite-note" id="invite-note"><b>${esc(data.inviter)}</b> invited you to The Library. Create an account to join, or sign in if you already have one.</p>`);
    if ($('au-go').textContent === 'Sign in') $('au-mode').click();
  });
})();

// ---------- membership ----------
async function loadMe() {
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    lsSet(key('me'), data || null); return data;
  } catch (e) { return lsGet(key('me')); }
}
function showJoin() {
  $('authview').hidden = true; $('appview').hidden = true;
  let v = $('joinview');
  if (!v) { v = document.createElement('div'); v.id = 'joinview'; v.className = 'authwrap'; document.body.insertBefore(v, $('appview')); }
  // the code typed at sign-up travels with the account, so it survives confirming the email on another device
  const code = pendingInvite() || (user && user.user_metadata && user.user_metadata.invite) || '';
  v.innerHTML = `<header class="band authband"><div class="band-in"><div class="topbar"><div class="eyebrow">Invite only</div></div><h1>Join The Library</h1><div class="spines" aria-hidden="true">${$('auth-spines') ? $('auth-spines').innerHTML : ''}</div></div></header>
    <div class="auth"><form id="joinform" novalidate>
      <p class="ehint" style="font-size:14px">The Library is a small reading community. ${code ? 'Pick how other members will see you.' : 'You need an invite from a member. Paste the code from your invite link.'}</p>
      <label>Invite code<input type="text" id="j-code" value="${esc(code)}" autocomplete="off" autocapitalize="characters" required></label>
      <label>Your name<input type="text" id="j-name" maxlength="60" autocomplete="name" required></label>
      <label>Username<input type="text" id="j-handle" maxlength="20" autocomplete="username" placeholder="letters, numbers, _" required></label>
      <button class="btn solid" type="submit">Join</button>
      <p class="authmsg" id="j-msg" role="status"></p>
      <button class="linkbtn" type="button" id="j-out">Sign out</button></form></div>`;
  v.hidden = false;
  $('j-name').addEventListener('input', e => { const h = $('j-handle'); if (!h.dataset.touched) h.value = e.target.value.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '').slice(0, 20); });
  $('j-handle').addEventListener('input', e => { e.target.dataset.touched = '1'; });
  $('j-out').onclick = () => sb.auth.signOut();
  $('joinform').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = t => { $('j-msg').textContent = t; $('j-msg').className = 'authmsg err'; };
    const c = $('j-code').value.trim(), n = $('j-name').value.trim(), h = $('j-handle').value.trim().toLowerCase();
    if (!c || !n || !/^[a-z0-9_]{3,20}$/.test(h)) { msg('Fill in all three. Usernames use 3 to 20 letters, numbers or underscores.'); return; }
    const { error } = await sb.rpc('join_with_invite', { p_code: c, p_handle: h, p_name: n });
    if (error) { msg(error.message); return; }
    try { localStorage.removeItem('lib:invite'); } catch (err) {}
    v.hidden = true; location.hash = '#feed'; start();
  });
}
const _start9 = start;
start = async function () {
  me = await loadMe();
  if (!me) { showJoin(); return; }
  if ($('joinview')) $('joinview').hidden = true;
  setupMember();
  const p = _start9();
  applyRoute(); refreshBadge();
  await p;
};
const _showAuth9 = showAuth;
showAuth = function () { _showAuth9(); me = null; if ($('joinview')) $('joinview').hidden = true; };

let memberReady = false;
function setupMember() {
  const eb = document.querySelector('#appview > header.band .eyebrow'); if (eb) eb.textContent = `${me.name}'s reading life`;
  if (!isOwner()) {
    document.querySelectorAll('#scan-pick, .scan > .ehint, .foot > span:first-child').forEach(el => { el.hidden = true; });
  }
  if (memberReady) return; memberReady = true;
  const tabs = [['feed', 'Feed', ICON.home], ['shelves', 'Shelves', ICON.shelves], ['post', 'Post', ICON.plus], ['inbox', 'Inbox', ICON.bell], ['me', 'Me', ICON.user]];
  const bar = document.querySelector('.tabbar-in');
  bar.innerHTML = tabs.map(([id, l, ic]) => `<button type="button" data-tab="${id}" class="${id === 'post' ? 'tab-post' : ''}">${ic}<span>${l}</span>${id === 'inbox' ? '<i class="badge" id="inbox-badge" hidden></i>' : ''}</button>`).join('');
  bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    if (b.dataset.tab === 'post') { openComposer(); return; }
    const h = '#' + (b.dataset.tab === 'me' ? 'u/' + me.handle : b.dataset.tab);
    if (location.hash === h) { applyRoute(); window.scrollTo(0, 0); } else location.hash = h;
  });
  const s = document.createElement('div'); s.id = 'social'; s.hidden = true;
  $('appview').insertBefore(s, document.querySelector('#appview > nav.tabbar'));
  s.addEventListener('click', onSocialClick);
  s.addEventListener('submit', onSocialSubmit);
  window.addEventListener('hashchange', applyRoute);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && me) refreshBadge(); });
}
const _updateMissing9 = updateMissing;
updateMissing = function () { _updateMissing9(); if (!isOwner()) $('gr-missing').hidden = true; };

// ---------- routing ----------
function currentRoute() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { name: 'feed', args: [] };
  const [name, ...rest] = h.split('/');
  return { name, args: rest.map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } }) };
}
function applyRoute() {
  if (!me || $('appview').hidden) return;
  const r = currentRoute(), shelves = r.name === 'shelves', s = $('social');
  document.querySelector('#appview > header.band').hidden = !shelves;
  document.querySelector('#appview > main.wrap').hidden = !shelves;
  s.hidden = shelves;
  const tab = shelves ? 'shelves' : r.name === 'feed' ? 'feed' : r.name === 'inbox' ? 'inbox' : (r.name === 'u' && r.args[0] === me.handle) ? 'me' : '';
  document.querySelectorAll('.tabbar button[data-tab]').forEach(b => b.toggleAttribute('aria-current', b.dataset.tab === tab));
  closeSheet();
  if (shelves) return;
  const t = ++viewToken; window.scrollTo(0, 0);
  if (r.name === 'people') renderPeople(t);
  else if (r.name === 'inbox') renderInbox(t);
  else if (r.name === 'u') renderProfile(t, r.args[0] || me.handle, r.args[1]);
  else if (r.name === 'book') renderBook(t, r.args[0] || '', r.args[1] || '');
  else renderFeed(t);
}
const shell = (title, actions, body, back) => `<header class="band sband"><div class="band-in"><div class="topbar">
  ${back ? `<button class="iconbtn back" type="button" data-act="back" aria-label="Back">${ICON.back}</button>` : ''}${title ? `<h1>${title}</h1>` : '<span></span>'}<div class="acct">${actions || ''}</div></div></div></header><main class="wrap swrap">${body}</main>`;
const offline = what => `<div class="empty">${navigator.onLine ? `Couldn’t load ${what}. Try again in a moment.` : `You’re offline. ${what[0].toUpperCase() + what.slice(1)} need a connection.`}</div>`;

// ---------- posts ----------
const ACT = { started: 'started reading', finished: 'finished', rated: 'rated', review: 'reviewed', photo: 'shared a photo' };
function bookCard(b, rating) {
  return `<a class="pbook" href="${bookHref(b)}">${coverHTML(b)}<span class="pbook-t"><b>${esc(b.title)}</b><span>${esc([b.author, b.series].filter(Boolean).join(' · '))}</span>${starsHTML(rating)}${b.gr ? `<small>Goodreads ${(+b.gr).toFixed(2)}</small>` : ''}</span></a>`;
}
function postHTML(p) {
  postsById.set(p.id, p);
  const u = p.user || {}, b = p.book;
  return `<article class="post" data-post="${p.id}">
    <header class="post-h"><a href="#u/${esc(u.handle)}" tabindex="-1">${avHTML(u)}</a><div class="post-who"><a href="#u/${esc(u.handle)}" class="who">${esc(u.name)}</a> <span class="act">${ACT[p.kind] || ''}</span><div class="post-meta">@${esc(u.handle)} · <time datetime="${esc(p.at)}">${ago(p.at)}</time></div></div>
    ${p.mine ? `<button class="iconbtn sm" type="button" data-act="post-del" aria-label="Delete post">${ICON.trash}</button>` : ''}</header>
    ${p.image ? `<img class="post-img" src="${esc(p.image)}" alt="${esc(p.text ? 'Photo: ' + p.text.slice(0, 100) : 'Photo')}" loading="lazy">` : ''}
    ${b && b.title ? bookCard(b, p.kind === 'photo' ? 0 : p.rating) : ''}
    ${p.text ? `<p class="post-text${p.kind === 'review' ? ' clamp' : ''}">${esc(p.text)}</p>` : ''}
    <footer class="post-f">
      <button class="pbtn" type="button" data-act="like" aria-pressed="${!!p.liked}" aria-label="Like">${ICON.heart}<span>${p.likes || ''}</span></button>
      <button class="pbtn" type="button" data-act="comments" aria-expanded="false" aria-label="Comments">${ICON.comment}<span>${p.comments || ''}</span></button>
      ${b && b.title ? `<button class="pbtn" type="button" data-act="want" aria-label="Add to my To read">${ICON.want}<span class="pl">Want</span></button><button class="pbtn" type="button" data-act="recommend" aria-label="Recommend to a friend">${ICON.send}<span class="pl">Send</span></button>` : ''}
    </footer><div class="cmts" hidden></div></article>`;
}
async function renderFeed(t, more) {
  const s = $('social');
  if (!more) {
    s.innerHTML = shell('Feed', `<button class="iconbtn" type="button" data-go="people" aria-label="Find people">${ICON.people}</button>`,
      `<div class="tabs" role="tablist"><button class="tab" role="tab" data-feed="following" aria-selected="${feedMode === 'following'}">Following</button><button class="tab" role="tab" data-feed="everyone" aria-selected="${feedMode === 'everyone'}">Everyone</button></div>
       <div class="feed" id="feed-list"><div class="loading">Loading the feed…</div></div><div id="feed-more"></div>`);
    feedItems = []; feedDone = false;
  }
  const before = more && feedItems.length ? feedItems[feedItems.length - 1].at : null;
  const { data, error } = await sb.rpc('feed', { p_before: before, p_everyone: feedMode === 'everyone', p_limit: 20 });
  if (t !== viewToken) return;
  if (error) { $('feed-list').innerHTML = offline('the feed'); return; }
  feedItems = feedItems.concat(data || []); feedDone = (data || []).length < 20;
  $('feed-list').innerHTML = feedItems.length ? feedItems.map(postHTML).join('') :
    `<div class="empty-card"><h2>Nothing here yet</h2><p>When people you follow start, finish, rate or review a book, it shows up here. Your own reading shows up too.</p>
     <div class="ebtns"><a class="btn solid" href="#people">Find people</a>${feedMode === 'following' ? '<button class="btn" type="button" data-feed="everyone">See everyone</button>' : ''}<button class="btn" type="button" data-act="compose">Share a photo</button></div></div>`;
  $('feed-more').innerHTML = feedDone ? '' : '<button class="btn quiet wide" type="button" data-act="feed-more">Load more</button>';
}

async function toggleLike(art, p) {
  const btn = art.querySelector('[data-act=like]'), on = !p.liked;
  p.liked = on; p.likes = (+p.likes || 0) + (on ? 1 : -1);
  btn.setAttribute('aria-pressed', on); btn.querySelector('span').textContent = p.likes || '';
  const { error } = on ? await sb.from('likes').insert({ post_id: p.id, user_id: user.id }) : await sb.from('likes').delete().eq('post_id', p.id).eq('user_id', user.id);
  if (error) { p.liked = !on; p.likes += on ? -1 : 1; btn.setAttribute('aria-pressed', !on); btn.querySelector('span').textContent = p.likes || ''; toast('Couldn’t save that. Check your connection.'); }
}
async function loadComments(art, p) {
  const box = art.querySelector('.cmts');
  const { data, error } = await sb.rpc('post_comments', { p_post: p.id });
  if (error) { box.innerHTML = '<p class="ehint">Couldn’t load comments.</p>'; return; }
  p.comments = data.length; art.querySelector('[data-act=comments] span').textContent = p.comments || '';
  box.innerHTML = data.map(c => `<div class="cmt">${avHTML(c.user, 'sm')}<div><a class="who" href="#u/${esc(c.user.handle)}">${esc(c.user.name)}</a> <span class="cmt-t">${esc(c.text)}</span><div class="post-meta">${ago(c.at)}${c.can_delete ? ` · <button class="linkbtn" type="button" data-act="cmt-del" data-id="${c.id}">Delete</button>` : ''}</div></div></div>`).join('') +
    `<form class="cmt-form" data-form="comment"><label class="sr-only" for="c-${p.id}">Add a comment</label><input type="text" id="c-${p.id}" maxlength="2000" placeholder="Add a comment…" autocomplete="off"><button class="btn small solid" type="submit">Post</button></form>`;
}

// ---------- adding and recommending ----------
function addToTBR(b, why) {
  const have = findMine(b.title);
  if (have) { toast(`Already on your ${have.list === 'read' ? 'Read' : 'To read'} shelf.`); return false; }
  const order = books.reduce((m, x) => Math.min(m, x.order ?? 0), 0) - 1;
  const nb = { id: 'n' + Date.now(), list: 'tbr', title: b.title, author: b.author || '', series: b.series || '', genre: b.genre || 'fiction', status: '', priority: 'soon',
    why, source: `${why} · ${fmtD(today())}`, owned: '', note: '', rating: 0, gr: +b.gr || 0, grn: 0, year: '', url: b.url || '',
    added: today(), confirm: false, order };
  if (b.cover && String(b.cover).startsWith('http')) nb.cover = b.cover;
  books.push(nb); queue(nb); render();
  toast(`Added “${b.title}” to your To read shelf.`);
  return true;
}
async function openRecommend(b) {
  const bg = sheet(`Recommend ${b.title}`, `<p class="ehint">Pick who should read it. It lands in their inbox, and goes on their To read shelf if they accept.</p>
    <input type="search" id="r-q" placeholder="Search members" aria-label="Search members"><div class="plist" id="r-list"><div class="loading">Loading members…</div></div>
    <label class="field">A note (optional)<textarea id="r-note" maxlength="1000" rows="3" placeholder="Why they'd like it"></textarea></label>
    <div class="ebtns"><button class="btn solid" type="button" id="r-send" disabled>Send</button></div><p class="ehint" id="r-msg"></p>`);
  let pick = null, ppl = [];
  const draw = () => {
    const q = $('r-q').value.trim().toLowerCase();
    const list = ppl.filter(p => !p.me && (!q || (p.name + ' ' + p.handle).toLowerCase().includes(q)));
    $('r-list').innerHTML = list.length ? list.map(p => `<label class="prow pick"><input type="radio" name="r-who" value="${p.id}" ${pick === p.id ? 'checked' : ''}>${avHTML(p)}<span><b>${esc(p.name)}</b><small>@${esc(p.handle)}</small></span></label>`).join('')
      : `<div class="empty">${ppl.length > 1 ? 'No one matches.' : 'No other members yet. Invite a friend from your profile.'}</div>`;
  };
  const { data, error } = await sb.rpc('people', { p_q: '' });
  if (!$('sheet') || $('sheet') !== bg) return;
  if (error) { $('r-list').innerHTML = offline('members'); return; }
  ppl = data || []; draw();
  $('r-q').addEventListener('input', draw);
  $('r-list').addEventListener('change', e => { pick = e.target.value; $('r-send').disabled = !pick; });
  $('r-send').onclick = async () => {
    $('r-send').disabled = true;
    const { error } = await sb.from('recommendations').insert({ from_user: user.id, to_user: pick, book: b, note: $('r-note').value.trim() });
    if (error) { $('r-msg').textContent = 'Couldn’t send it: ' + error.message; $('r-send').disabled = false; return; }
    const who = ppl.find(p => p.id === pick); closeSheet(); toast(`Sent to ${who ? who.name : 'them'}.`);
  };
}

// ---------- photo posts ----------
async function shrink(file, max, q) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Couldn’t open that image. Try a JPEG or PNG.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
function openComposer() {
  const mine = books.slice().sort((a, b) => (b.status === 'reading') - (a.status === 'reading') || (a.list === 'read' ? 0 : 1) - (b.list === 'read' ? 0 : 1) || (a.order ?? 0) - (b.order ?? 0));
  const bg = sheet('Share with the Library', `
    <div class="ebtns"><button class="btn quiet" type="button" id="c-add">${ICON.shelves}<span>Add books to my shelves</span></button></div>
    <div class="divider">Or post a photo</div>
    <label class="btn solid" id="c-pick"><input type="file" class="sr-only" id="c-file" accept="image/*">${ICON.camera}<span>Choose a photo</span></label>
    <img id="c-prev" class="c-prev" alt="" hidden>
    <label class="field">Caption<textarea id="c-text" maxlength="5000" rows="3" placeholder="What are you reading, and where?"></textarea></label>
    <label class="field">About a book (optional)<select id="c-book"><option value="">No book</option>${mine.map(b => `<option value="${b.id}">${esc(b.title)}${b.status === 'reading' ? ' (reading)' : ''}</option>`).join('')}</select></label>
    <div class="ebtns"><button class="btn solid" type="button" id="c-post" disabled>Post</button></div><p class="ehint" id="c-msg"></p>`);
  let blob = null;
  $('c-add').onclick = () => { closeSheet(); location.hash = '#shelves'; setTimeout(() => goTo('addbox'), 50); };
  $('c-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { blob = await shrink(f, 1440, 0.82); const p = $('c-prev'); p.src = URL.createObjectURL(blob); p.hidden = false; $('c-post').disabled = false; $('c-msg').textContent = ''; }
    catch (err) { $('c-msg').textContent = err.message; }
  });
  $('c-post').onclick = async () => {
    if (!blob) return;
    const msg = t => { $('c-msg').textContent = t; };
    $('c-post').disabled = true; msg('Posting…');
    const path = `${user.id}/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.jpg`;
    const up = await sb.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) { msg('Couldn’t upload the photo: ' + up.error.message); $('c-post').disabled = false; return; }
    const image = sb.storage.from('post-images').getPublicUrl(path).data.publicUrl;
    const b = find($('c-book').value);
    const { error } = await sb.from('posts').insert({ user_id: user.id, kind: 'photo', text: $('c-text').value.trim(), image, book_id: b ? b.id : null, book: b ? snapOf(b) : null });
    if (error) { msg('Couldn’t post it: ' + error.message); $('c-post').disabled = false; sb.storage.from('post-images').remove([path]); return; }
    closeSheet(); feedMode = 'following'; toast('Posted.');
    if (location.hash === '#feed' || !location.hash) applyRoute(); else location.hash = '#feed';
  };
  return bg;
}

// ---------- people ----------
const followBtn = p => p.me ? '' : `<button class="btn small ${p.i_follow ? '' : 'solid'}" type="button" data-act="follow" data-uid="${p.id}" aria-pressed="${!!p.i_follow}">${p.i_follow ? 'Following' : 'Follow'}</button>`;
async function renderPeople(t) {
  $('social').innerHTML = shell('People', '', `<input type="search" id="p-q" placeholder="Search by name or username" aria-label="Search members"><div class="plist" id="p-list"><div class="loading">Loading members…</div></div>
    <div class="empty-card"><h2>Bring a friend</h2><p>The Library is invite-only. Each invite link works once.</p><a class="btn solid" href="#u/${esc(me.handle)}/invite">Invite a friend</a></div>`, true);
  const { data, error } = await sb.rpc('people', { p_q: '' });
  if (t !== viewToken) return;
  if (error) { $('p-list').innerHTML = offline('members'); return; }
  const draw = () => {
    const q = $('p-q').value.trim().toLowerCase();
    const list = data.filter(p => !q || (p.name + ' ' + p.handle).toLowerCase().includes(q));
    $('p-list').innerHTML = list.map(p => `<div class="prow"><a href="#u/${esc(p.handle)}" class="prow-a">${avHTML(p)}<span><b>${esc(p.name)}${p.me ? ' (you)' : ''}</b><small>@${esc(p.handle)}${p.follows_me && !p.me ? ' · follows you' : ''}</small><small>${p.reading ? 'Reading ' + esc(p.reading) : `${p.read} book${p.read === 1 ? '' : 's'} read`}</small></span></a>${followBtn(p)}</div>`).join('') || '<div class="empty">No one matches.</div>';
  };
  draw(); $('p-q').addEventListener('input', draw);
}
async function toggleFollow(btn) {
  const on = btn.getAttribute('aria-pressed') !== 'true', uid = btn.dataset.uid;
  btn.disabled = true;
  const { error } = on ? await sb.from('follows').insert({ follower: user.id, followee: uid }) : await sb.from('follows').delete().eq('follower', user.id).eq('followee', uid);
  btn.disabled = false;
  if (error) { toast('Couldn’t update that. Check your connection.'); return; }
  btn.setAttribute('aria-pressed', on); btn.textContent = on ? 'Following' : 'Follow'; btn.classList.toggle('solid', !on);
}

// ---------- profiles ----------
let profTab = 'posts', profData = null;
async function renderProfile(t, handle, sub) {
  const s = $('social'); s.innerHTML = shell('', '', '<div class="loading">Loading…</div>');
  const { data, error } = await sb.rpc('profile_page', { p_handle: handle });
  if (t !== viewToken) return;
  if (error || !data) { s.innerHTML = shell('Not found', '', error ? offline('this profile') : '<div class="empty">No member with that username.</div>', true); return; }
  profData = data; if (profTab === 'invite') profTab = 'posts';
  drawProfile();
  if (sub === 'invite' && data.me) openInvites();
}
function drawProfile() {
  const d = profData, u = d.user, read = d.books.filter(b => b.list === 'read'), tbrL = d.books.filter(b => b.list !== 'read');
  const reading = read.filter(b => b.status === 'reading');
  const actions = d.me
    ? `<button class="btn small onband" type="button" data-act="edit-profile">Edit profile</button><button class="btn small onband" type="button" data-act="invites">Invite</button>`
    : `${followBtn({ id: u.id, i_follow: d.i_follow })}`;
  const list = arr => arr.length ? `<div class="plist">${arr.map(b => `<a class="prow brow" href="${bookHref(b)}">${coverHTML(b)}<span><b>${esc(b.title)}</b><small>${esc([b.author, b.series].filter(Boolean).join(' · '))}</small>${b.status === 'reading' ? '<small class="pill">Reading</small>' : starsHTML(b.rating)}</span>${b.gr ? `<span class="gr-mini">GR ${(+b.gr).toFixed(2)}</span>` : ''}</a>`).join('')}</div>` : '<div class="empty">Nothing here yet.</div>';
  $('social').innerHTML = `<header class="band pband"><div class="band-in">
      <div class="topbar">${d.me ? '<span></span>' : `<button class="iconbtn back" type="button" data-act="back" aria-label="Back">${ICON.back}</button>`}<div class="acct">${actions}</div></div>
      <div class="phead">${avHTML(u, 'lg')}<div><h1>${esc(u.name)}</h1><div class="meta"><span>@${esc(u.handle)}</span>${d.follows_me && !d.me ? '<span>follows you</span>' : ''}</div></div></div>
      ${u.bio ? `<p class="pbio">${esc(u.bio)}</p>` : ''}
      <div class="pstats"><span><b>${read.length}</b> read</span><span><b>${tbrL.length}</b> to read</span><span><b>${d.followers}</b> follower${d.followers === 1 ? '' : 's'}</span><span><b>${d.following}</b> following</span></div>
      ${reading.length ? `<p class="pbio">Reading <a href="${bookHref(reading[0])}">${esc(reading[0].title)}</a>${reading.length > 1 ? ` and ${reading.length - 1} more` : ''}</p>` : ''}
      <div class="spines" aria-hidden="true">${spinesHTML(read)}</div></div></header>
    <main class="wrap swrap">
      <div id="prof-edit"></div>
      <div class="tabs three" role="tablist">${[['posts', 'Posts'], ['read', 'Read'], ['tbr', 'To read']].map(([k, l]) => `<button class="tab" role="tab" data-ptab="${k}" aria-selected="${profTab === k}">${l}</button>`).join('')}</div>
      <div id="prof-body">${profTab === 'read' ? list(read) : profTab === 'tbr' ? list(tbrL) : (d.posts.length ? `<div class="feed">${d.posts.map(postHTML).join('')}</div>` : '<div class="empty">No posts yet.</div>')}</div>
      ${d.me ? `<p class="ehint">Members can see your shelves, ratings, reviews and reading activity. To keep a book or a review to yourself, open it on your Shelves and choose “Hide from members”, or tick “Keep review private” in the review.</p>
        <div class="ebtns"><button class="linkbtn" type="button" data-act="signout">Sign out</button></div>` : ''}
    </main>`;
}
function openEditProfile() {
  const u = profData.user; let avatar = u.avatar;
  $('prof-edit').innerHTML = `<form class="card-form" data-form="profile">
    <div class="ebtns">${avHTML(u, 'lg')}<label class="btn small quiet"><input type="file" class="sr-only" id="pe-av" accept="image/*">Change photo</label>${u.avatar ? '<button class="btn small quiet" type="button" id="pe-avx">Remove</button>' : ''}</div>
    <label class="field">Name<input type="text" id="pe-name" maxlength="60" value="${esc(u.name)}" required></label>
    <label class="field">Bio<textarea id="pe-bio" maxlength="300" rows="3" placeholder="What you like to read">${esc(u.bio)}</textarea></label>
    <div class="ebtns"><button class="btn solid" type="submit">Save</button><button class="btn" type="button" data-act="edit-cancel">Cancel</button></div><p class="ehint" id="pe-msg"></p></form>`;
  const setAv = v => { avatar = v; const img = $('prof-edit').querySelector('.av'); img.outerHTML = avHTML({ ...u, avatar: v }, 'lg'); };
  $('pe-av').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const blob = await shrink(f, 200, 0.82); const r = new FileReader(); r.onload = () => setAv(r.result); r.readAsDataURL(blob);
  });
  if ($('pe-avx')) $('pe-avx').onclick = () => setAv('');
  $('prof-edit').querySelector('form')._getAvatar = () => avatar;
}
async function openInvites() {
  const bg = sheet('Invite a friend', `<p class="ehint">Each link lets one person join and expires after 30 days. You and they will follow each other.</p>
    <div class="ebtns"><button class="btn solid" type="button" id="i-new">Create an invite link</button></div><div id="i-out"></div><h3 class="sub">Your invites</h3><div id="i-list" class="plist"><div class="loading">Loading…</div></div>`);
  const link = c => `${location.origin}${location.pathname}?invite=${c}`;
  const loadList = async () => {
    const { data } = await sb.from('invites').select('code,created_at,expires_at,used_at').order('created_at', { ascending: false }).limit(20);
    if (!$('i-list')) return;
    $('i-list').innerHTML = (data || []).length ? data.map(i => `<div class="prow"><span><b class="mono">${i.code}</b><small>${i.used_at ? 'Used ' + fmtD(i.used_at.slice(0, 10)) : new Date(i.expires_at) < new Date() ? 'Expired' : 'Not used yet · expires ' + fmtD(i.expires_at.slice(0, 10))}</small></span>${!i.used_at && new Date(i.expires_at) > new Date() ? `<button class="btn small" type="button" data-copy="${esc(link(i.code))}">Copy link</button>` : ''}</div>`).join('') : '<div class="empty">None yet.</div>';
  };
  bg.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]'); if (!c) return;
    const url = c.dataset.copy;
    if (navigator.share && c.dataset.share) { try { await navigator.share({ title: 'Join me on The Library', text: 'An invite to my reading community', url }); return; } catch (err) {} }
    try { await navigator.clipboard.writeText(url); toast('Invite link copied.'); } catch (err) { const i = $('i-link'); if (i) { i.focus(); i.select(); } toast('Select the link and copy it.'); }
  });
  $('i-new').onclick = async () => {
    $('i-new').disabled = true;
    const { data, error } = await sb.rpc('create_invite');
    $('i-new').disabled = false;
    if (error) { $('i-out').innerHTML = `<p class="ehint" style="color:var(--warn)">${esc(error.message)}</p>`; return; }
    $('i-out').innerHTML = `<label class="field">Send this link to your friend<input type="text" id="i-link" readonly value="${esc(link(data))}"></label>
      <div class="ebtns"><button class="btn solid" type="button" data-copy="${esc(link(data))}">Copy link</button>${navigator.share ? `<button class="btn" type="button" data-copy="${esc(link(data))}" data-share="1">Share…</button>` : ''}</div>`;
    loadList();
  };
  loadList();
}

// ---------- book pages ----------
async function renderBook(t, title, author) {
  const s = $('social'); s.innerHTML = shell('', '', '<div class="loading">Loading…</div>', true);
  const { data, error } = await sb.rpc('book_page', { p_title: title, p_author: author });
  if (t !== viewToken) return;
  if (error || !data) { s.innerHTML = shell('Book', '', offline('this book'), true); return; }
  const rs = data.readers, mine = findMine(title), any = rs.find(r => r.cover) || rs[0] || {};
  const info = { title, author: author || any.author || '', series: any.series || (mine && mine.series) || '', genre: any.genre || (mine && mine.genre) || 'fiction',
    gr: (rs.find(r => +r.gr) || mine || {}).gr || 0, url: (rs.find(r => r.url) || mine || {}).url || '' };
  info.cover = (mine && hasCover(mine) && String(mine.cover).startsWith('http') ? mine.cover : null) || (rs.find(r => r.cover && String(r.cover).startsWith('http')) || {}).cover || pickCoverURL(title, info.author) || null;
  const rated = rs.filter(r => +r.rating > 0), avg = rated.length ? rated.reduce((a, r) => a + +r.rating, 0) / rated.length : 0;
  const verb = r => r.list === 'read' ? (r.status === 'reading' ? 'is reading it' : r.status === 'abandoned' ? 'stopped reading it' : r.status === 'paused' ? 'paused it' : 'read it') : 'wants to read it';
  s.innerHTML = shell('', '', `
    <section class="bhead">${info.cover ? `<img class="bcover" src="${esc(info.cover)}" alt="">` : `<div class="cover g-${esc(info.genre)} bcover" aria-hidden="true">${coverLabel(info, info)}</div>`}
      <div class="bhead-t"><h1>${esc(title)}</h1><p class="by">${esc([info.author, info.series].filter(Boolean).join(' · '))}</p>
        ${info.gr ? `<p class="mono gr-line">Goodreads ${(+info.gr).toFixed(2)}${info.url ? ` · <a href="${esc(info.url)}" target="_blank" rel="noopener">open</a>` : ''}</p>` : ''}
        <p class="gr-line">${rs.length ? `On ${rs.length} member${rs.length > 1 ? 's’' : '’s'} shelves${avg ? ` · members rate it ${avg.toFixed(1)}` : ''}` : 'Not on anyone’s shelves yet'}</p></div></section>
    <div class="ebtns">${mine ? `<a class="btn" href="#shelves">On your ${mine.list === 'read' ? 'Read' : 'To read'} shelf</a>` : '<button class="btn solid" type="button" data-act="book-want">Want to read</button>'}<button class="btn" type="button" data-act="book-rec">${ICON.send}<span>Recommend</span></button></div>
    <h2 class="sub">Members</h2>
    <div class="plist">${rs.map(r => `<div class="reader"><a href="#u/${esc(r.user.handle)}">${avHTML(r.user)}</a><div><p><a class="who" href="#u/${esc(r.user.handle)}">${esc(r.mine ? 'You' : r.user.name)}</a> ${verb(r)} ${starsHTML(r.rating)}</p>
      ${r.review ? `<p class="post-text clamp${r.review.spoiler ? ' spoiler' : ''}">${esc(r.review.text)}</p>` : ''}</div></div>`).join('') || '<div class="empty">No members have this book yet.</div>'}</div>`, true);
  s._book = info;
}

// ---------- inbox ----------
async function refreshBadge() {
  const { data } = await sb.rpc('inbox');
  if (!data) return; inboxData = data;
  const seen = lsGet(key('inboxSeen')) || '';
  const n = data.recs.filter(r => r.status === 'pending').length + data.activity.filter(a => a.at > seen).length;
  const b = $('inbox-badge'); if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
}
async function renderInbox(t) {
  $('social').innerHTML = shell('Inbox', '', '<div class="loading">Loading…</div>');
  const { data, error } = await sb.rpc('inbox');
  if (t !== viewToken) return;
  if (error || !data) { $('social').querySelector('main').innerHTML = offline('your inbox'); return; }
  inboxData = data;
  const seen = lsGet(key('inboxSeen')) || '';
  lsSet(key('inboxSeen'), new Date().toISOString()); const bd = $('inbox-badge'); if (bd) bd.hidden = !data.recs.some(r => r.status === 'pending');
  const line = a => {
    const what = a.book ? `your post about <b>${esc(a.book)}</b>` : 'your photo';
    return a.type === 'like' ? `liked ${what}` : a.type === 'comment' ? `commented on ${what}: “${esc(a.text.slice(0, 140))}”` : 'started following you';
  };
  $('social').querySelector('main').innerHTML = `
    <h2 class="sub">Recommended to you</h2>
    ${data.recs.length ? data.recs.map(r => `<div class="rec${r.status === 'pending' ? '' : ' done'}" data-rec="${r.id}">
      <div class="rec-h">${avHTML(r.user, 'sm')}<span><a class="who" href="#u/${esc(r.user.handle)}">${esc(r.user.name)}</a> recommends <span class="post-meta">· ${ago(r.at)}</span></span></div>
      ${bookCard(r.book, 0)}${r.note ? `<p class="post-text">“${esc(r.note)}”</p>` : ''}
      ${r.status === 'pending' ? `<div class="ebtns"><button class="btn solid small" type="button" data-act="rec-yes">Add to To read</button><button class="btn small" type="button" data-act="rec-no">Not for me</button></div>` : `<p class="ehint">${r.status === 'accepted' ? 'Added to your To read shelf' : 'Declined'}</p>`}</div>`).join('') : '<div class="empty">No recommendations yet.</div>'}
    <h2 class="sub">Activity</h2>
    <div class="plist">${data.activity.length ? data.activity.map(a => `<a class="prow act-row${a.at > seen ? ' new' : ''}" href="#u/${esc(a.user.handle)}">${avHTML(a.user, 'sm')}<span><span><b>${esc(a.user.name)}</b> ${line(a)}</span><small>${ago(a.at)}</small></span></a>`).join('') : '<div class="empty">Likes, comments and new followers show up here.</div>'}</div>`;
}

// ---------- events ----------
async function onSocialClick(e) {
  const go = e.target.closest('[data-go]'); if (go) { location.hash = '#' + go.dataset.go; return; }
  const fm = e.target.closest('[data-feed]'); if (fm) { feedMode = fm.dataset.feed; renderFeed(++viewToken); return; }
  const pt = e.target.closest('[data-ptab]'); if (pt) { profTab = pt.dataset.ptab; drawProfile(); return; }
  const cl = e.target.closest('.post-text.clamp'); if (cl) { cl.classList.toggle('open'); }
  const sp = e.target.closest('.spoiler'); if (sp) sp.classList.add('shown');
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const act = btn.dataset.act, art = btn.closest('.post'), p = art && postsById.get(art.dataset.post);
  if (act === 'back') { if (history.length > 1) history.back(); else location.hash = '#feed'; }
  else if (act === 'compose') openComposer();
  else if (act === 'feed-more') { btn.disabled = true; renderFeed(viewToken, true); }
  else if (act === 'like' && p) toggleLike(art, p);
  else if (act === 'comments' && p) {
    const box = art.querySelector('.cmts'), open = box.hidden;
    box.hidden = !open; btn.setAttribute('aria-expanded', open);
    if (open) { box.innerHTML = '<div class="loading">Loading…</div>'; await loadComments(art, p); const i = box.querySelector('input'); if (i) i.focus(); }
  }
  else if (act === 'cmt-del' && p) { const { error } = await sb.from('comments').delete().eq('id', btn.dataset.id); if (error) toast('Couldn’t delete it.'); else loadComments(art, p); }
  else if (act === 'want' && p) addToTBR(p.book, `From ${p.user.name}'s post`);
  else if (act === 'recommend' && p) openRecommend(p.book);
  else if (act === 'post-del' && p) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.classList.add('armed'); btn.setAttribute('aria-label', 'Tap again to delete'); toast('Tap the bin again to delete this post.'); return; }
    const { error } = await sb.from('posts').delete().eq('id', p.id);
    if (error) { toast('Couldn’t delete it.'); return; }
    if (p.image && p.mine) { const m = p.image.split('/post-images/')[1]; if (m) sb.storage.from('post-images').remove([decodeURIComponent(m)]); }
    art.remove(); toast('Post deleted.');
  }
  else if (act === 'follow') toggleFollow(btn);
  else if (act === 'edit-profile') openEditProfile();
  else if (act === 'edit-cancel') $('prof-edit').innerHTML = '';
  else if (act === 'invites') openInvites();
  else if (act === 'signout') sb.auth.signOut();
  else if (act === 'book-want') { if (addToTBR($('social')._book, 'From the book page')) renderBook(viewToken, ...currentRoute().args); }
  else if (act === 'book-rec') openRecommend($('social')._book);
  else if (act === 'rec-yes' || act === 'rec-no') {
    const id = btn.closest('[data-rec]').dataset.rec, r = inboxData && inboxData.recs.find(x => x.id === id); if (!r) return;
    btn.disabled = true;
    if (act === 'rec-yes') addToTBR(r.book, `Recommended by ${r.user.name}${r.note ? ': ' + r.note : ''}`);
    const { error } = await sb.from('recommendations').update({ status: act === 'rec-yes' ? 'accepted' : 'declined' }).eq('id', id);
    if (error) toast('Couldn’t save your answer.');
    renderInbox(viewToken); refreshBadge();
  }
}
async function onSocialSubmit(e) {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'comment') {
    const art = f.closest('.post'), p = postsById.get(art.dataset.post), i = f.querySelector('input'), text = i.value.trim();
    if (!text) return;
    i.disabled = true;
    const { error } = await sb.from('comments').insert({ post_id: p.id, user_id: user.id, text });
    i.disabled = false;
    if (error) { toast('Couldn’t post your comment.'); return; }
    await loadComments(art, p);
  } else if (f.dataset.form === 'profile') {
    const name = $('pe-name').value.trim(), bio = $('pe-bio').value.trim(), avatar = f._getAvatar();
    if (!name) { $('pe-msg').textContent = 'Add your name.'; return; }
    const { error } = await sb.from('profiles').update({ name, bio, avatar }).eq('user_id', user.id);
    if (error) { $('pe-msg').textContent = 'Couldn’t save: ' + error.message; return; }
    me = { ...me, name, bio, avatar }; lsSet(key('me'), me); setupMember();
    profData.user = { ...profData.user, name, bio, avatar }; drawProfile(); toast('Profile saved.');
  }
}

// ---------- shelves: privacy, recommend, members' reviews ----------
const _coverBtn9 = coverBtn;
coverBtn = function (b) {
  return _coverBtn9(b) +
    `<button class="btn small quiet" type="button" data-id="${b.id}" data-act="private" aria-pressed="${!!b.private}">${ICON.lock}<span>${b.private ? 'Hidden from members' : 'Hide from members'}</span></button>` +
    (b.private ? '' : `<button class="btn small quiet" type="button" data-id="${b.id}" data-act="recommend-own">${ICON.send}<span>Recommend</span></button><a class="btn small quiet" href="${bookHref(b)}">Members’ reviews</a>`);
};
const _row9 = row;
row = function (b) {
  const h = _row9(b);
  return b.private ? h.replace('<span class="title">', `<span class="title"><span class="lock" title="Hidden from members">${ICON.lock}</span>`) : h;
};
const _editor9 = editor;
editor = function (b) {
  return _editor9(b).replace('<label><input type="checkbox" id="ed-spoiler"',
    `<label><input type="checkbox" id="ed-private" ${b.review && b.review.private ? 'checked' : ''}> Keep review private</label>\n      <label><input type="checkbox" id="ed-spoiler"`);
};
const _commit9 = commit;
commit = function (b, extra) { return _commit9(b, Object.assign({ private: !!($('ed-private') && $('ed-private').checked) }, extra || {})); };
$('list').addEventListener('click', e => {
  const t = e.target.closest('button[data-act]'); if (!t) return;
  const b = find(t.dataset.id); if (!b) return;
  if (t.dataset.act === 'private') { b.private = !b.private; change(b); toast(b.private ? 'Hidden from members. Its posts were removed.' : 'Members can see this book again.'); }
  else if (t.dataset.act === 'recommend-own') openRecommend(snapOf(b));
});

// if sign-in finished before this script loaded, the shelves already started: bring the community up now
if (user && !$('appview').hidden && !me) {
  (async () => {
    me = await loadMe();
    if (!me) { showJoin(); return; }
    setupMember(); applyRoute(); refreshBadge();
  })();
}
