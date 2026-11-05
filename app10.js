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
    $('au-confirm').required = up;
  }
  $('au-mode').addEventListener('click', () => setTimeout(sync, 0));
  $('at-login').onclick = () => { if (isSignup()) $('au-mode').click(); else sync(); $('au-email').focus(); };
  $('at-signup').onclick = () => { if (!isSignup()) $('au-mode').click(); else sync(); $('au-email').focus(); };

  // check the two passwords match before the account is created
  form.addEventListener('submit', e => {
    if (!isSignup()) return;
    const p = pass.value, c = $('au-confirm').value;
    if (p.length >= 8 && p !== c) {
      e.preventDefault(); e.stopImmediatePropagation();
      const m = $('au-msg'); m.textContent = 'The two passwords don’t match.'; m.className = 'authmsg err';
      $('au-confirm').focus();
    }
  }, true);
  sync();
  // someone arriving from an invite link most likely needs a new account
  if (typeof pendingInvite === 'function' && pendingInvite() && !isSignup()) $('au-mode').click();
})();
