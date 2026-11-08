// Header account icon: shows the signed-in person's Google photo (or their initial) on every page.
// Reads the sign-in Firebase already keeps in this browser, so Firebase itself only loads on the account page.
(function () {
  var K = 'firebase:authUser:AIzaSyBQj8XIb3GoolGwK92ZZxBrAc3bhqdWM8Q:[DEFAULT]';
  function pick(v) { return v && (v.email || v.displayName) ? { name: v.displayName || v.name || '', email: v.email || '', photo: v.photoURL || v.photo || '' } : null; }
  function letter(ch) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="28" fill="#f4f3ee"/><text x="28" y="37" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="600" fill="#162725">' + ch + '</text></svg>');
  }
  function render(u) {
    try { if (u) localStorage.setItem('ft_user', JSON.stringify(u)); else localStorage.removeItem('ft_user'); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('header a[href="/login-profile"]'), function (a) {
      var icon = a.querySelector('img.icon'); if (!icon) return;
      if (!icon.getAttribute('data-ft-src')) icon.setAttribute('data-ft-src', icon.getAttribute('src'));
      icon.onerror = null;
      if (!u) {
        icon.classList.remove('ft-hav'); icon.src = icon.getAttribute('data-ft-src');
        a.removeAttribute('aria-label'); return;
      }
      var first = (u.name || '').trim().split(/\s+/)[0];
      var fallback = letter((first || u.email || '?').charAt(0).toUpperCase().replace(/[<>&"]/g, '?'));
      icon.classList.add('ft-hav'); icon.referrerPolicy = 'no-referrer'; icon.removeAttribute('srcset');
      if (u.photo) { icon.onerror = function () { icon.onerror = null; icon.src = fallback; }; icon.src = u.photo; }
      else icon.src = fallback;
      a.setAttribute('aria-label', 'Your account' + (first ? ', signed in as ' + first : ''));
    });
  }
  function check() {
    var s = null; try { s = JSON.parse(sessionStorage.getItem(K)); } catch (e) {}
    if (s) { render(pick(s)); return; }
    if (!window.indexedDB) return;
    var r; try { r = indexedDB.open('firebaseLocalStorageDb'); } catch (e) { return; }
    r.onupgradeneeded = function () { r.transaction.abort(); };
    r.onerror = function () { render(null); };
    r.onsuccess = function () {
      var db = r.result;
      if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); render(null); return; }
      try {
        var g = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').get(K);
        g.onsuccess = function () { db.close(); render(pick(g.result && g.result.value)); };
        g.onerror = function () { db.close(); };
      } catch (e) { db.close(); }
    };
  }
  // Draw straight away from the last known state (no flicker), then confirm with Firebase's saved sign-in.
  var cached = null; try { cached = pick(JSON.parse(localStorage.getItem('ft_user'))); } catch (e) {}
  if (cached) render(cached);
  check();
  // On the account page, update the moment someone signs in or out.
  var sec = document.querySelector('.section---customer-login');
  if (sec && window.MutationObserver) { var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(check, 150); }).observe(sec, { childList: true, subtree: true }); }
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
})();
