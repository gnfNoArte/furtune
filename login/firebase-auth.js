// Real accounts for Furtune, powered by Firebase Authentication (project furtune-7d6c9).
// These keys are public by design; access is restricted to the authorized domains set in the Firebase console.
const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
const root = document.querySelector('.section---customer-login');
if (root) {
  root.classList.add('ft-auth-wait');
  setTimeout(() => root.classList.remove('ft-auth-wait'), 2500);
  const [{ initializeApp }, A] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js')]);
  const app = initializeApp({
    apiKey: 'AIzaSyBQj8XIb3GoolGwK92ZZxBrAc3bhqdWM8Q',
    authDomain: 'furtune-7d6c9.firebaseapp.com',
    projectId: 'furtune-7d6c9',
    storageBucket: 'furtune-7d6c9.firebasestorage.app',
    messagingSenderId: '440342557796',
    appId: '1:440342557796:web:9a6e4278d49b0ee2381b71'
  });
  const auth = A.getAuth(app);
  auth.useDeviceLanguage();
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const tabs = $('.w-tabs', root);
  const signinForm = $('#email-formmm'), signupForm = $('#email-form-2');

  const ERR = {
    'auth/invalid-credential': 'That email and password don’t match. Try again, or reset your password.',
    'auth/wrong-password': 'That email and password don’t match. Try again, or reset your password.',
    'auth/user-not-found': 'That email and password don’t match. Try again, or reset your password.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Please enter your password.',
    'auth/email-already-in-use': 'There’s already an account with this email. Sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/account-exists-with-different-credential': 'This email already has an account. Sign in with your password instead.',
    'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
    'auth/network-request-failed': 'We can’t reach the sign-in service. Check your connection and try again.',
    'auth/user-disabled': 'This account has been turned off. Contact us for help.'
  };
  const QUIET = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

  // One message line under each form, read out by screen readers.
  function msgFor(form) {
    const block = form.closest('.w-form') || form.parentNode;
    let m = $('.ft-auth-msg', block);
    if (!m) { m = document.createElement('p'); m.className = 'ft-auth-msg'; m.setAttribute('role', 'alert'); block.appendChild(m); }
    return m;
  }
  function say(form, text, ok) { const m = msgFor(form); m.textContent = text || ''; m.classList.toggle('ok', !!ok); }
  function fail(form, e) { if (!QUIET.includes(e && e.code)) say(form, ERR[e && e.code] || 'Something went wrong. Please try again.'); }
  function busy(form, on) {
    const b = $('input[type=submit]', form); if (!b) return;
    if (on) { b.dataset.label = b.value; b.value = b.getAttribute('data-wait') || 'Please wait…'; b.disabled = true; }
    else { b.value = b.dataset.label || b.value; b.disabled = false; }
  }

  // Sign in with email.
  async function doSignin() {
    const f = signinForm; say(f, '');
    const email = $('#signin-email', f).value.trim(), pass = $('#signin-password', f).value;
    const remember = $('#signin-remember', f);
    busy(f, true);
    try {
      await A.setPersistence(auth, remember && !remember.checked ? A.browserSessionPersistence : A.browserLocalPersistence);
      await A.signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { fail(f, e); } finally { busy(f, false); }
  }

  // Create an account.
  async function doSignup() {
    const f = signupForm; say(f, '');
    const first = $('#signup-first-name', f).value.trim(), last = $('#signup-last-name', f).value.trim();
    const email = $('#signup-email', f).value.trim(), pass = $('#signup-password', f).value, again = $('#signup-password-confirm', f).value;
    if (pass !== again) { say(f, 'The two passwords don’t match.'); $('#signup-password-confirm', f).focus(); return; }
    busy(f, true);
    try {
      await A.setPersistence(auth, A.browserLocalPersistence);
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      const name = [first, last].filter(Boolean).join(' ');
      if (name) { await A.updateProfile(cred.user, { displayName: name }); show(auth.currentUser); }
    } catch (e) { fail(f, e); } finally { busy(f, false); }
  }

  // Webflow would otherwise send these forms to its own form inbox, with the password in it.
  document.addEventListener('submit', (e) => {
    if (e.target !== signinForm && e.target !== signupForm) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.target === signinForm) doSignin(); else doSignup();
  }, true);

  // Continue with Google (always remembered on this device; Firebase's default).
  const google = new A.GoogleAuthProvider(); google.setCustomParameters({ prompt: 'select_account' });
  $$('.continue-with-google-button', root).forEach((btn) => {
    btn.removeAttribute('target'); btn.setAttribute('href', '#'); btn.setAttribute('role', 'button');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const form = $('form', btn.closest('.login-form')) || signinForm;
      say(form, ''); btn.setAttribute('aria-busy', 'true');
      // Safari only allows a pop-up that opens in the same instant as the click, so nothing is awaited before it.
      try { await A.signInWithPopup(auth, google); }
      catch (err) { fail(form, err); } finally { btn.removeAttribute('aria-busy'); }
    });
  });

  // Forgotten password: email a reset link to the address typed above.
  const forgot = $('.forgotten-passsword-link', root);
  if (forgot) forgot.addEventListener('click', async (e) => {
    e.preventDefault();
    const f = signinForm, email = $('#signin-email', f).value.trim();
    if (!email) { say(f, 'Type your email above first, then choose “Forgotten password?”.'); $('#signin-email', f).focus(); return; }
    try { await A.sendPasswordResetEmail(auth, email); say(f, 'If there’s an account for ' + email + ', a reset link is on its way. Check your inbox.', true); }
    catch (err) { fail(f, err); }
  });

  // "Create account" / "Already have an account?" switch tabs.
  $$('.tab-pane-tab-1 .create-accnt-link', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const t = $('.tab-link-tab-2', root); if (t) t.click(); }));
  $$('.tab-pane-tab-2 .create-accnt-link', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const t = $('.tab-link-tab-1', root); if (t) t.click(); }));

  // Signed-in view: replaces the forms on this page.
  let card = null;
  function show(user) {
    if (card) { card.remove(); card = null; }
    try {
      if (user) localStorage.setItem('ft_user', JSON.stringify({ name: user.displayName || '', email: user.email || '', photo: user.photoURL || '' }));
      else localStorage.removeItem('ft_user');
    } catch (e) {}
    if (!user) { if (tabs) tabs.style.display = ''; document.title = 'Sign In | Furtune'; return; }
    if (tabs) tabs.style.display = 'none';
    const first = (user.displayName || '').split(' ')[0];
    card = document.createElement('div'); card.className = 'login-form ft-profile';
    let av;
    if (user.photoURL) { av = document.createElement('img'); av.src = user.photoURL; av.alt = ''; av.referrerPolicy = 'no-referrer'; }
    else { av = document.createElement('div'); av.textContent = (first || user.email || '?').charAt(0).toUpperCase(); av.setAttribute('aria-hidden', 'true'); }
    av.className = 'ft-av';
    const h = document.createElement('h1'); h.textContent = first ? 'Welcome, ' + first : 'Welcome back';
    const p = document.createElement('p'); p.textContent = 'Signed in as ' + (user.email || 'your account');
    const acts = document.createElement('div'); acts.className = 'ft-actions';
    const shop = document.createElement('a'); shop.className = 'ft-btn'; shop.href = '/shop'; shop.textContent = 'Continue shopping';
    const cart = document.createElement('a'); cart.className = 'ft-btn alt'; cart.href = '/cart'; cart.textContent = 'View your cart';
    acts.append(shop, cart);
    const out = document.createElement('button'); out.type = 'button'; out.className = 'ft-out'; out.textContent = 'Sign out';
    out.addEventListener('click', () => A.signOut(auth));
    card.append(av, h, p, acts, out);
    (tabs ? tabs.parentNode : root).appendChild(card);
    document.title = 'Your Account | Furtune';
  }
  A.onAuthStateChanged(auth, (u) => { show(u); root.classList.remove('ft-auth-wait'); });
}
