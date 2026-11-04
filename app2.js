// ---------- data ----------
async function start() {
  $('authview').hidden = true; $('appview').hidden = false;
  $('who').textContent = user.email || '';
  drafts = lsGet(key('drafts')) || {};
  outbox = lsGet(key('outbox')) || {};
  const cache = lsGet(key('cache'));
  if (cache) { books = cache.books || []; picks = cache.picks || null; loaded = true; render(); }
  await pull();
  flush();
}
function saveCache() { lsSet(key('cache'), { books, picks, at: Date.now() }); }
function setSync(t, off) { const s = $('sync'); s.textContent = t; s.classList.toggle('off', !!off); }

async function pull() {
  if (!user) return;
  try {
    let { data, error } = await sb.from('books').select('id,data');
    if (error) throw error;
    if (!data.length && !Object.keys(outbox).length) {
      const r = await sb.rpc('claim_seed');
      if (!r.error && r.data > 0) ({ data, error } = await sb.from('books').select('id,data'));
      if (error) throw error;
    }
    const server = new Map(data.map(r => [r.id, r.data]));
    // unsent local changes win over what the server has
    for (const [id, op] of Object.entries(outbox)) { if (op.op === 'delete') server.delete(id); else server.set(id, op.data); }
    books = [...server.values()];
    const m = await sb.from('app_meta').select('key,value').eq('key', 'picks').maybeSingle();
    if (!m.error) picks = m.data ? m.data.value : null;
    loaded = true; saveCache(); render();
    setSync(Object.keys(outbox).length ? 'Saving…' : 'Synced');
  } catch (e) {
    loaded = true; render();
    setSync(navigator.onLine ? 'Couldn’t reach the server' : 'Offline · showing saved copy', true);
  }
}

function queue(b, op) {
  outbox[b.id] = op === 'delete' ? { op: 'delete' } : { op: 'upsert', data: b };
  lsSet(key('outbox'), outbox); saveCache(); flush();
}
async function flush() {
  if (flushing || !user) return;
  const ids = Object.keys(outbox);
  if (!ids.length) { setSync('Synced'); $('save').textContent = ''; return; }
  if (!navigator.onLine) { setSync(`Offline · ${ids.length} change${ids.length > 1 ? 's' : ''} waiting`, true); return; }
  flushing = true; setSync('Saving…');
  try {
    for (const id of ids) {
      const op = outbox[id];
      const res = op.op === 'delete'
        ? await sb.from('books').delete().eq('id', id)
        : await sb.from('books').upsert({ user_id: user.id, id, data: op.data, updated_at: new Date().toISOString() });
      if (res.error) throw res.error;
      if (outbox[id] === op) { delete outbox[id]; lsSet(key('outbox'), outbox); }
    }
    setSync('Synced'); $('save').textContent = 'Saved';
  } catch (e) {
    const n = Object.keys(outbox).length;
    setSync(`${n} change${n > 1 ? 's' : ''} not saved yet`, true);
  } finally {
    flushing = false;
    if (Object.keys(outbox).some(id => !ids.includes(id))) flush();
  }
}
window.addEventListener('online', () => { flush(); pull(); });
window.addEventListener('offline', () => setSync('Offline', true));
document.addEventListener('visibilitychange', () => { if (!document.hidden && user) { flush().then(pull); } });
