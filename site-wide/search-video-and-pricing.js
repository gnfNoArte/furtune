(function () {
  // Webflow site search is not indexed on this plan, so search filters the real catalogue on /shop instead.
  if (location.pathname === '/search') {
    var sq = new URLSearchParams(location.search).get('query') || '';
    location.replace('/shop' + (sq ? '?q=' + encodeURIComponent(sq) : ''));
    return;
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.closest || !f.closest('header')) return;
    var i = f.querySelector('input[name="query"], input[type="search"]');
    if (!i) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var q = i.value.trim();
    location.href = '/shop' + (q ? '?q=' + encodeURIComponent(q) : '');
  }, true);

  // Speed: the workshop video (1.7 MB) sits far down the homepage. Hold it until it is about to scroll into view,
  // and pause it whenever it is off screen so it never competes with scrolling.
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function holdVideo(v) {
    if (v.__ftHeld) return; v.__ftHeld = true;
    Array.prototype.forEach.call(v.querySelectorAll('source'), function (s) { s.setAttribute('data-ft-src', s.getAttribute('src')); s.removeAttribute('src'); });
    v.removeAttribute('autoplay'); v.autoplay = false; v.preload = 'none'; try { v.load(); } catch (e) {}
    var started = false;
    function wake() { if (started) return; started = true; Array.prototype.forEach.call(v.querySelectorAll('source'), function (s) { s.setAttribute('src', s.getAttribute('data-ft-src')); }); v.preload = 'auto'; v.load(); }
    if (reduce) return;
    if (!('IntersectionObserver' in window)) { wake(); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { wake(); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (started) v.pause();
      });
    }, { rootMargin: '400px 0px' }).observe(v);
  }
  function scan() { Array.prototype.forEach.call(document.querySelectorAll('.w-background-video video'), holdVideo); }
  if (window.MutationObserver) {
    var mo = new MutationObserver(scan); mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { scan(); mo.disconnect(); });
  }

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function slugOf(s) { return (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // Order totals follow the Help page: $150 off every $1,000, free white-glove delivery over $1,000, a flat fee below.
  var FREE_FROM = 1000, FEE = 79, RATES = { USD: 1, GBP: 0.79, EUR: 0.92, CAD: 1.37, AUD: 1.52, JPY: 152 };
  function code() { var c = 'USD'; try { c = JSON.parse(localStorage.getItem('ft_currency')) || 'USD'; } catch (e) {} return RATES[c] ? c : 'USD'; }
  function money(n) { var c = code(); return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(Math.round(n * RATES[c])); }
  function lines() {
    try {
      if (document.querySelector('.ft-ty-items')) { var o = JSON.parse(localStorage.getItem('ft_last_order_v1')); return (o && o.items) || []; }
      var c = JSON.parse(localStorage.getItem('ft_cart_v1')); return Array.isArray(c) ? c : [];
    } catch (e) { return []; }
  }
  function put(el, text) { if (el && el.textContent !== text) el.textContent = text; }
  function fixTotals() {
    if (!document.querySelector('.ft-summary, .ft-ty-card')) return;
    var c = lines(), sub = c.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var disc = Math.floor(sub / 1000) * 150, ship = sub > 0 && sub < FREE_FROM ? FEE : 0;
    each('.ft-sum-shipping', function (el) { put(el, ship ? money(ship) : 'Free'); var r = el.closest('.ft-summary-row'); if (r) put(r.firstElementChild, ship ? 'Delivery' : 'White-glove delivery'); });
    each('.ft-sum-discount', function (el) { var r = el.closest('.ft-summary-row'); if (r) put(r.firstElementChild, '$150 off every $1,000'); });
    each('.ft-sum-total', function (el) { put(el, money(sub - disc + ship)); });
    each('.ft-summary', function (s) {
      if (s.closest('.ft-ty-card')) return;
      var n = s.querySelector('.ft-ship-note');
      if (!n) { n = document.createElement('p'); n.className = 'ft-ship-note'; var t = s.querySelector('.ft-summary-total'); if (t && t.parentNode) t.parentNode.insertBefore(n, t.nextSibling); else s.appendChild(n); }
      put(n, ship ? 'Add ' + money(FREE_FROM - sub) + ' more for free white-glove delivery.' : '');
      n.hidden = !ship;
    });
  }

  // Small corrections found in the full-site audit.
  function polish() {
    // One price per piece (finishes don't change it), so no "From".
    each('.ft-card-price, .price', function (el) { el.textContent = el.textContent.replace(/^\s*From\s+/, ''); });
    // Category bar: Lighting is a plain label in the Designer; make it a link like the others.
    each('header .navs', function (n) {
      if (n.closest('a') || n.children.length || n.textContent.trim().toLowerCase() !== 'lighting') return;
      var a = document.createElement('a'); a.href = '/collections/lighting'; a.className = 'ft-linkify';
      n.parentNode.insertBefore(a, n); a.appendChild(n);
    });
    // Homepage links that pointed at Shop All.
    each('.div-designss', function (d) {
      var a = d.querySelector('a.ft-linkify'); if (!a) return;
      a.href = /kitchen/i.test(d.textContent) ? '/collections/kitchen' : '/collections/living-room';
    });
    each('.explore-our-space', function (el) { var a = el.closest('a'); if (a) a.href = '/help#visit'; });
    // US spelling in the contact form's topic list; no hint that just repeats a label.
    each('select option', function (o) { if (/programme/i.test(o.textContent)) o.textContent = o.textContent.replace(/programme/i, 'program'); });
    var ph = document.getElementById('ft-phone'); if (ph) ph.placeholder = '';
    // "You may also like": same room first, then the rest, four in total, never the current piece.
    var pdp = document.querySelector('[data-ft-product]');
    if (pdp) {
      var cat = pdp.getAttribute('data-ft-cat'), slug = pdp.getAttribute('data-ft-product');
      var items = Array.prototype.slice.call(document.querySelectorAll('.ft-related .w-dyn-item'));
      if (items.length) {
        var info = items.map(function (it) { var b = it.querySelector('[data-ft-slug]'), c = it.querySelector('.ft-card-cat'); return { it: it, slug: b && b.getAttribute('data-ft-slug'), cat: slugOf(c && c.textContent) }; })
          .filter(function (x) { return x.slug !== slug; });
        var same = info.filter(function (x) { return cat && x.cat === cat; }), other = info.filter(function (x) { return !(cat && x.cat === cat); });
        var pick = same.concat(other).slice(0, 4), parent = items[0].parentNode;
        items.forEach(function (it) { it.classList.add('ft-hidden'); });
        pick.forEach(function (x) { x.it.classList.remove('ft-hidden'); parent.appendChild(x.it); });
      }
    }
    // Keep order totals honest, and re-check whenever the cart re-renders.
    fixTotals();
    if (window.MutationObserver) each('.ft-summary, .ft-ty-card', function (s) { new MutationObserver(fixTotals).observe(s, { childList: true, subtree: true, characterData: true }); });
  }

  function run() {
    polish();
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    each('header input[name="query"]', function (i) { i.value = q; });
    if (!q || location.pathname !== '/shop') return;
    var words = q.toLowerCase().split(/\s+/), n = 0;
    each('.ft-grid .w-dyn-item', function (it) {
      var extra = Array.prototype.map.call(it.querySelectorAll('[title], img[alt]'), function (x) { return (x.getAttribute('title') || '') + ' ' + (x.getAttribute('alt') || ''); }).join(' ');
      var text = (it.textContent + ' ' + extra).toLowerCase();
      var ok = words.every(function (w) { return text.indexOf(w) > -1; });
      it.classList.toggle('ft-hidden', !ok);
      if (ok) n++;
    });
    var h1 = document.querySelector('.ft-h1'), lede = document.querySelector('.ft-lede');
    if (h1) h1.textContent = 'Results for “' + q + '”';
    if (lede) {
      lede.textContent = n ? n + (n === 1 ? ' piece matches' : ' pieces match') + ' your search.' : 'Nothing matches that yet. Try a room, or a material like oak, walnut or rattan.';
      var a = document.createElement('a'); a.href = '/shop'; a.className = 'ft-search-clear'; a.textContent = n ? 'Clear search' : 'Browse all furniture';
      lede.parentNode.insertBefore(a, lede.nextSibling);
    }
    each('.ft-filters .w--current, .ft-filters .ft-chip-active', function (c) { c.classList.remove('w--current', 'ft-chip-active'); });
    document.title = 'Search: ' + q + ' | Furtune';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
