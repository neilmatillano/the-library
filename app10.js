// ---------- sign-in screen: separate "Log in" and "Create account" ----------
(() => {
  const form = $('authform'); if (!form) return;
  const tabs = document.createElement('div');
  tabs.className = 'tabs authtabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Log in or create an account');
  tabs.innerHTML = '<button class="tab" type="button" role="tab" id="at-login">Log in</button><button class="tab" type="button" role="tab" id="at-signup">Create account</button>';
  form.parentNode.insertBefore(tabs, form);

  const head = document.createElement('div'); head.className = 'authhead';
  head.innerHTML = '<h2 id="ah-title"></h2><p id="ah-sub"></p>';
  form.insertBefore(head, form.firstChild);

  const pass = $('au-pass'), passLabel = pass.closest('label');
  const confirm = document.createElement('label');
  confirm.id = 'au-confirm-wrap';
  confirm.innerHTML = 'Confirm password<input type="password" id="au-confirm" autocomplete="new-password" minlength="8">';
  passLabel.insertAdjacentElement('afterend', confirm);
  const hint = document.createElement('p'); hint.className = 'ehint'; hint.id = 'au-hint'; hint.textContent = 'At least 8 characters.';
  confirm.insertAdjacentElement('afterend', hint);
  // invite code: the community is invite-only, so ask for it up front (prefilled from an invite link)
  const codeWrap = document.createElement('label');
  codeWrap.id = 'au-code-wrap';
  codeWrap.innerHTML = 'Invite code<input type="text" id="au-code" autocomplete="off" autocapitalize="characters" spellcheck="false">';
  hint.insertAdjacentElement('afterend', codeWrap);
  const codeHint = document.createElement('p'); codeHint.className = 'ehint'; codeHint.id = 'au-code-hint';
  codeWrap.insertAdjacentElement('afterend', codeHint);
  const codeIn = $('au-code');
  codeIn.value = typeof pendingInvite === 'function' ? pendingInvite() : '';
  const syncCodeHint = () => { codeHint.textContent = codeIn.value.trim() ? 'From your invite link.' : 'The Library is invite-only. Paste the code from the invite link a member sent you.'; };
  codeIn.addEventListener('input', () => { codeHint.textContent = ''; });
  syncCodeHint();
  $('au-mode').hidden = true;

  const isSignup = () => $('au-go').textContent !== 'Sign in' && $('au-go').textContent !== 'Log in';
  function sync() {
    const up = isSignup();
    $('at-login').setAttribute('aria-selected', !up); $('at-signup').setAttribute('aria-selected', up);
    $('ah-title').textContent = up ? 'Create your account' : 'Welcome back';
    $('ah-sub').textContent = up
      ? 'New to The Library? Sign up with your email. We’ll send you a link to confirm it, then you can log in.'
      : 'Log in with the email and password you signed up with.';
    $('au-go').textContent = up ? 'Create account' : 'Log in';
    passLabel.firstChild.textContent = up ? 'Choose a password' : 'Password';
    confirm.hidden = !up; hint.hidden = !up; $('au-forgot').hidden = up;
    codeWrap.hidden = !up; codeHint.hidden = !up;
    $('au-confirm').required = up; codeIn.required = up;
  }
  $('au-mode').addEventListener('click', () => setTimeout(sync, 0));
  $('at-login').onclick = () => { if (isSignup()) $('au-mode').click(); else sync(); $('au-email').focus(); };
  $('at-signup').onclick = () => { if (!isSignup()) $('au-mode').click(); else sync(); $('au-email').focus(); };

  // check the two passwords match and the invite code is valid before the account is created
  const err = t => { const m = $('au-msg'); m.textContent = t; m.className = 'authmsg' + (t ? ' err' : ''); };
  let checked = '';
  form.addEventListener('submit', async e => {
    if (!isSignup()) return;
    const p = pass.value, c = $('au-confirm').value;
    if (p.length >= 8 && p !== c) {
      e.preventDefault(); e.stopImmediatePropagation();
      err('The two passwords don’t match.'); $('au-confirm').focus(); return;
    }
    if (!$('au-email').value.trim() || p.length < 8) return; // let the main handler explain
    const code = codeIn.value.trim().toUpperCase();
    if (code && code === checked) return; // already verified: go ahead and create the account
    e.preventDefault(); e.stopImmediatePropagation();
    if (!code) { err('Enter your invite code. You need one from a member to join.'); codeIn.focus(); return; }
    $('au-go').disabled = true; err(''); $('au-msg').textContent = 'Checking your invite…';
    let data = null, error = null;
    try { ({ data, error } = await sb.rpc('invite_info', { p_code: code })); } catch (x) { error = x; }
    $('au-go').disabled = false;
    if (error) { err('Could not check the invite code. Check your connection and try again.'); return; }
    if (!data || !data.valid) { err('That invite code isn’t valid. It may have expired or already been used.'); codeIn.focus(); return; }
    try { localStorage.setItem('lib:invite', code); } catch (x) {}
    codeIn.value = code; checked = code;
    form.requestSubmit();
  }, true);
  sync();
  // someone arriving from an invite link most likely needs a new account
  if (typeof pendingInvite === 'function' && pendingInvite() && !isSignup()) $('au-mode').click();
})();
