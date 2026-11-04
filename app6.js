// ---------- Goodreads import file ----------
const csvCell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
$('x-go').onclick = () => {
  const scope = $('x-scope').value, msg = t => { $('x-msg').textContent = t; };
  const rows = ordered(books).filter(b => {
    const has = !!(b.review && b.review.text);
    if (scope === 'reviews') return has; if (scope === 'unposted') return has && !b.review.posted; return b.status !== 'abandoned';
  });
  if (!rows.length) { msg(scope === 'all' ? 'Nothing to export.' : 'No reviews to export yet. Write one first.'); return; }
  const H = ['Book Id', 'Title', 'Author', 'Author l-f', 'Additional Authors', 'ISBN', 'ISBN13', 'My Rating', 'Average Rating', 'Publisher', 'Binding', 'Number of Pages', 'Year Published', 'Original Publication Year', 'Date Read', 'Date Added', 'Bookshelves', 'Bookshelves with positions', 'Exclusive Shelf', 'My Review', 'Spoiler', 'Private Notes', 'Read Count', 'Owned Copies'];
  const lines = [H.map(csvCell).join(',')];
  for (const b of rows) {
    const r = b.review || {}, authors = (b.author || '').split(/\s*&\s*/), main = (authors[0] || '').trim(), parts = main.split(/\s+/);
    const lf = parts.length > 1 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : main;
    const shelf = b.list === 'tbr' ? 'to-read' : (b.status === 'reading' || b.status === 'paused' ? 'currently-reading' : 'read');
    const stars = r.stars != null && r.stars !== '' ? +r.stars : (b.list === 'read' && +b.rating ? Math.min(5, Math.max(1, Math.round(+b.rating))) : 0);
    const id = (b.url || '').match(/show\/(\d+)/);
    lines.push([id ? id[1] : '', b.title, main, lf, authors.slice(1).join(', '), '', '', stars || 0, b.gr || '', '', '', '', '', b.year || '',
      (r.dateRead || '').replace(/-/g, '/'), (b.added || '').replace(/-/g, '/'), '', '', shelf, (r.text || '').replace(/\r?\n/g, '<br/>'),
      r.spoiler ? 'true' : '', '', shelf === 'read' ? 1 : 0, ''].map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `goodreads-import-${today()}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  msg(`Exported ${rows.length} book${rows.length > 1 ? 's' : ''}. Upload the file at goodreads.com/review/import.`);
};

// ---------- install ----------
let deferred = null;
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const dismissed = () => { try { return localStorage.getItem('lib:install-dismissed') === '1'; } catch (e) { return false; } };
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferred = e;
  if (!standalone && !dismissed()) { $('install').hidden = false; $('install-btn').hidden = false; }
});
$('install-btn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('install').hidden = true; };
$('install-close').onclick = () => { $('install').hidden = true; try { localStorage.setItem('lib:install-dismissed', '1'); } catch (e) {} };
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (iOS && !standalone && !dismissed()) {
  $('install-text').textContent = 'To install on iPhone or iPad: open this page in Safari, tap Share, then “Add to Home Screen”.';
  $('install-btn').hidden = true; $('install').hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
