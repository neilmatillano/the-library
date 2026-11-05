'use strict';
const SUPABASE_URL = 'https://agpxnactkbmohrnkfmmm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bVzfee4BVj8iFQ8fs3QKhg_fAwI9ZIf';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const GENRES = { fantasy: 'Fantasy', romantasy: 'Romantasy', scifi: 'Sci-fi', litrpg: 'LitRPG', fiction: 'Other fiction', nonfiction: 'Non-fiction' };
const STATUS = { finished: 'Finished', reading: 'Reading', paused: 'Paused', abandoned: 'Abandoned', unread: 'Not read yet' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// *italic* and **bold** in recommendation text, everything else escaped
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>');
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const fmtD = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let user = null, books = [], picks = null;
let view = 'read', filter = 'all', q = '', sort = 'default', openId = null;
let drafts = {}, outbox = {}, flushing = false, loaded = false;
const key = k => `lib:${user.id}:${k}`;

// ---------- sign-in ----------
let mode = 'signin';
function authMsg(t, err) { const m = $('au-msg'); m.textContent = t; m.className = 'authmsg' + (err ? ' err' : ''); }
$('au-mode').onclick = () => {
  mode = mode === 'signin' ? 'signup' : 'signin';
  $('au-go').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  $('au-mode').textContent = mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in';
  $('au-pass').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  authMsg('');
};
$('au-forgot').onclick = async () => {
  const email = $('au-email').value.trim();
  if (!email) { authMsg('Enter your email first, then choose "Forgot your password?" again.', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('./', location.href).href });
  authMsg(error ? 'Could not send the reset email: ' + error.message : 'Check your email for a link to set a new password.', !!error);
};
$('authform').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('au-email').value.trim(), password = $('au-pass').value;
  if (!email || password.length < 8) { authMsg('Enter your email and a password of at least 8 characters.', true); return; }
  $('au-go').disabled = true; authMsg(mode === 'signin' ? 'Logging in…' : 'Creating your account…');
  try {
    if (mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) authMsg(/confirm/i.test(error.message) ? 'Confirm your email first: open the link we sent you, then log in here.' : 'Login failed: ' + error.message, true);
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: new URL('./', location.href).href } });
      if (error) authMsg('Could not create the account: ' + error.message, true);
      else if (!data.session) authMsg('Account created. Open the confirmation link we emailed you, then come back and log in.');
    }
  } finally { $('au-go').disabled = false; }
});
$('resetform').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('rs-pass').value;
  if (password.length < 8) { $('rs-msg').textContent = 'Use at least 8 characters.'; return; }
  const { error } = await sb.auth.updateUser({ password });
  $('rs-msg').textContent = error ? 'Could not update it: ' + error.message : 'Password updated.';
  if (!error) { $('resetform').hidden = true; $('authform').hidden = false; }
});
$('signout').onclick = async () => { await sb.auth.signOut(); };

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { showAuth(); $('authform').hidden = true; $('resetform').hidden = false; return; }
  const u = session && session.user;
  // defer: Supabase calls made inside this callback can deadlock the auth lock
  if (u && (!user || user.id !== u.id)) { user = u; setTimeout(() => start(), 0); }
  else if (!u && user) { user = null; books = []; picks = null; loaded = false; showAuth(); }
  else if (!u && !user) showAuth();
});

function showAuth() { $('appview').hidden = true; $('authview').hidden = false; }
