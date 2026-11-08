(function () {
  var CART = 'ft_cart_v1', ORDER = 'ft_last_order_v1';
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var CURRENCIES = [
    { code: 'USD', region: 'United States', rate: 1 },
    { code: 'GBP', region: 'United Kingdom', rate: 0.79 },
    { code: 'EUR', region: 'Europe', rate: 0.92 },
    { code: 'CAD', region: 'Canada', rate: 1.37 },
    { code: 'AUD', region: 'Australia', rate: 1.52 },
    { code: 'JPY', region: 'Japan', rate: 152 }
  ];
  var cur = CURRENCIES[0];
  CURRENCIES.forEach(function (c) { if (c.code === read('ft_currency', 'USD')) cur = c; });
  var fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.code, maximumFractionDigits: 0 });
  function money(n) { return fmt.format(Math.round(n * cur.rate)); }
  function symbol(c) { return (new Intl.NumberFormat('en-US', { style: 'currency', currency: c.code }).formatToParts(0).filter(function (p) { return p.type === 'currency'; })[0] || {}).value; }
  function load() { var c = read(CART, []); return Array.isArray(c) ? c : []; }
  function save(c) { write(CART, c); badge(); }
  function count(c) { return c.reduce(function (s, i) { return s + i.qty; }, 0); }
  function totals(c) {
    var sub = c.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var disc = Math.floor(sub / 1000) * 150;
    return { sub: sub, disc: disc, total: sub - disc };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function setText(s, t) { $$(s).forEach(function (el) { el.textContent = t; }); }

  // The navbar is position: fixed; store pages start below its last painted bar.
  var header = $('body > header'), pages = $$('body > .ft-page, body > .section---customer-login');
  function headerBottom() {
    var top = header.getBoundingClientRect().top, bottom = 0;
    $$('*', header).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.height && r.width > window.innerWidth / 2 && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') bottom = Math.max(bottom, r.bottom - top);
    });
    return Math.round(bottom) || header.offsetHeight;
  }
  function offset() { var h = headerBottom(); pages.forEach(function (p) { p.style.marginTop = h + 'px'; }); }
  if (header && pages.length) {
    document.body.style.backgroundColor = '#f6f6f4';
    offset(); if (window.ResizeObserver) new ResizeObserver(offset).observe(header); window.addEventListener('resize', offset);
  }

  $$('.ft-card-price, .ft-pdp-price, .price').forEach(function (el) {
    var n = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
    if (!isNaN(n)) el.textContent = (el.classList.contains('ft-pdp-price') ? '' : 'From ') + money(n);
  });

  var year = $('.footer-copyright');
  if (year) year.textContent = year.textContent.replace(/©\s*\d{4}/, '© ' + new Date().getFullYear());

  // Footer currency picker.
  var curBox = $('.country-currency');
  if (curBox) {
    var label = function (c) { return c.region + ' (' + c.code + ' ' + symbol(c) + ')'; };
    curBox.innerHTML = '<button type="button" class="ft-cur-btn" aria-haspopup="listbox" aria-expanded="false"><span>' + esc(label(cur)) +
      '</span><svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>' +
      '<ul class="ft-cur-menu" role="listbox" aria-label="Currency" hidden>' + CURRENCIES.map(function (c) {
        return '<li class="ft-cur-opt" role="option" tabindex="-1" data-code="' + c.code + '" aria-selected="' + (c === cur) + '"><span>' + esc(c.region) + '</span><span>' + c.code + ' ' + esc(symbol(c)) + '</span></li>';
      }).join('') + '</ul>';
    curBox.classList.add('ft-cur');
    var btn = $('.ft-cur-btn', curBox), menu = $('.ft-cur-menu', curBox);
    var setOpen = function (open) { menu.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) ($('[aria-selected="true"]', menu) || menu.firstChild).focus(); };
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(menu.hidden); });
    document.addEventListener('click', function () { setOpen(false); });
    menu.addEventListener('keydown', function (e) {
      var items = $$('.ft-cur-opt', menu), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { setOpen(false); btn.focus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
    });
    menu.addEventListener('click', function (e) {
      var opt = e.target.closest('.ft-cur-opt'); if (!opt) return;
      write('ft_currency', opt.getAttribute('data-code'));
      location.reload();
    });
  }

  var TONES = [['espresso', '#3b2419'], ['cognac', '#9a4f24'], ['walnut', '#5a3a24'], ['smoked', '#6b5642'], ['ebon', '#2b2b2b'], ['charcoal', '#3d3d3b'],
    ['dark maple', '#6e3b22'], ['maple', '#b07a4a'], ['honey', '#c99a5b'], ['teak', '#a0703f'], ['whitewash', '#e6dfd1'], ['white', '#efece4'], ['ivory', '#efe8d8'],
    ['oak', '#c8a77a'], ['sand', '#cbb592'], ['taupe', '#a39383'], ['oatmeal', '#d8cdb8'], ['rust', '#a4532c'], ['saffron', '#d4a33a'], ['rattan', '#c9a46b']];
  function tone(name) { var n = name.toLowerCase(); for (var i = 0; i < TONES.length; i++) if (n.indexOf(TONES[i][0]) > -1) return TONES[i][1]; return '#b9b6ae'; }
  function finishList(s) { return (s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function dot(name) { return '<span class="ft-sw" style="background:' + tone(name) + '" title="' + esc(name) + '"></span>'; }
  $$('.ft-card-swatches').forEach(function (el) {
    var f = finishList(el.textContent);
    el.innerHTML = f.length ? f.map(dot).join('') + '<span class="ft-sw-label">' + f.length + (f.length === 1 ? ' finish' : ' finishes') + '</span>' : '';
  });

  // Top-row navbar items are plain text blocks in the component; give them destinations.
  var NAV = { 'shop': '/shop', 'ideas': '/#ideas', 'why furtune?': '/about', 'stores': '/help#visit', 'entryway': '/collections/entryway', 'kitchen': '/collections/kitchen' };
  if (header) $$('*', header).forEach(function (el) {
    if (el.children.length || el.closest('a')) return;
    var href = NAV[el.textContent.trim().toLowerCase()];
    if (href) { var a = document.createElement('a'); a.href = href; a.className = 'ft-linkify'; el.parentNode.insertBefore(a, el); a.appendChild(el); }
  });
  var ideas = $('.section-10'); if (ideas && !ideas.id) ideas.id = 'ideas';
  $$('.navs.shop').forEach(function (s) { if (!$('.ft-shop-label', s)) s.innerHTML = '<span class="ft-shop-label">' + esc(s.textContent.trim()) + '</span>'; });

  $$('.ft-card').forEach(function (a) {
    var s = $('[data-ft-slug]', a);
    if (s && s.getAttribute('data-ft-slug')) a.href = '/product/' + s.getAttribute('data-ft-slug');
  });

  function badge() {
    var n = count(load());
    $$('a[href="/cart"]').forEach(function (a) {
      if (a.closest('.ft-page') || a.closest('.ft-drawer')) return;
      var b = $('.ft-cart-badge', a);
      if (!b) {
        var icon = $('img', a), holder = a;
        if (icon) { holder = document.createElement('span'); holder.className = 'ft-cart-icon'; icon.parentNode.insertBefore(holder, icon); holder.appendChild(icon); }
        b = document.createElement('span'); b.className = 'ft-cart-badge'; holder.appendChild(b);
      }
      b.textContent = n; b.hidden = !n;
      a.setAttribute('aria-label', 'Cart, ' + n + ' item' + (n === 1 ? '' : 's'));
    });
  }
  badge();

  // Menu drawer. The header Menu icon used to be a plain link to /shop.
  var menuLink = $('header .icon-llink.menu');
  if (menuLink) {
    var item = function (h, t) { return '<a href="' + h + '">' + t + '</a>'; };
    var drawer = document.createElement('div');
    drawer.className = 'ft-drawer'; drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = '<div class="ft-drawer-scrim" data-close></div>' +
      '<div class="ft-drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">' +
      '<div class="ft-drawer-head"><span>Menu</span><button type="button" class="ft-drawer-close" data-close aria-label="Close menu">' +
      '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="1.4" fill="none"/></svg></button></div>' +
      '<div class="ft-drawer-body"><nav class="ft-drawer-main">' + item('/shop', 'Shop all') + item('/#ideas', 'Ideas') + item('/about', 'Why Furtune?') + item('/help#visit', 'Stores') + '</nav>' +
      '<p class="ft-drawer-label">Shop by room</p><nav class="ft-drawer-rooms">' +
      [['living-room', 'Living Room'], ['dining', 'Dining'], ['bedroom', 'Bedroom'], ['office', 'Office'], ['outdoor', 'Outdoor'], ['entryway', 'Entryway'], ['kitchen', 'Kitchen'], ['lighting', 'Lighting']]
        .map(function (r) { return item('/collections/' + r[0], r[1]); }).join('') + '</nav>' +
      '<nav class="ft-drawer-meta">' + item('/login-profile', 'Account') + item('/cart', 'Cart') + item('/help#delivery', 'Delivery &amp; returns') + item('/contact', 'Contact us') + '</nav></div></div>';
    document.body.appendChild(drawer);
    var lastFocus = null;
    var openDrawer = function (open) {
      drawer.classList.toggle('is-open', open); drawer.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('ft-lock', open);
      menuLink.setAttribute('aria-expanded', String(open));
      if (open) { lastFocus = document.activeElement; setTimeout(function () { $('.ft-drawer-close', drawer).focus(); }, 50); }
      else if (lastFocus) lastFocus.focus();
    };
    menuLink.setAttribute('role', 'button'); menuLink.setAttribute('aria-haspopup', 'dialog'); menuLink.setAttribute('aria-expanded', 'false');
    menuLink.addEventListener('click', function (e) { e.preventDefault(); openDrawer(true); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('[data-close]') || e.target.closest('a')) openDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') openDrawer(false);
      if (e.key === 'Tab') {
        var f = $$('a, button', drawer), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  $$('.ft-pdp-img').forEach(function (i) { i.loading = 'eager'; i.setAttribute('fetchpriority', 'high'); });

  var toastEl, toastTimer;
  function toast(html) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ft-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = html; toastEl.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }

  if (cur.code !== 'USD') $$('.ft-summary, .ft-ty-card').forEach(function (s) {
    var p = document.createElement('p'); p.className = 'ft-cur-note';
    p.textContent = 'Prices shown in ' + cur.code + ' are a guide. Your order is charged in US dollars.';
    s.appendChild(p);
  });

  function renderTotals(c) {
    var t = totals(c);
    setText('.ft-sum-subtotal', money(t.sub));
    setText('.ft-sum-discount', '−' + money(t.disc));
    setText('.ft-sum-total', money(t.total));
    $$('.ft-sum-discount').forEach(function (el) { var row = el.closest('.ft-summary-row'); if (row) row.classList.toggle('ft-hidden', !t.disc); });
  }
  function mini(c) {
    return c.map(function (i) {
      return '<div class="ft-mini"><img src="' + esc(i.img) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"><div><div class="ft-mini-name">' + esc(i.name) +
        (i.qty > 1 ? ' × ' + i.qty : '') + '</div><div class="ft-mini-meta">' + esc(i.finish) + '</div></div><div class="ft-mini-price">' + money(i.price * i.qty) + '</div></div>';
    }).join('');
  }

  var catPage = $('[data-ft-current-cat]');
  if (catPage) {
    var cat = catPage.getAttribute('data-ft-current-cat');
    $$('.ft-card [data-ft-cat]').forEach(function (b) {
      if (b.getAttribute('data-ft-cat') !== cat) { var it = b.closest('.w-dyn-item'); if (it) it.classList.add('ft-hidden'); }
    });
    $$('[data-ft-chip]').forEach(function (c) { c.classList.toggle('ft-chip-active', c.getAttribute('data-ft-chip') === cat); });
    var crumb = $('.ft-cat-crumb-name'), title = $('.ft-cat-title');
    if (crumb && title) crumb.textContent = title.textContent;
    if (title) document.title = title.textContent + ' Furniture | Furtune';
  }
  $$('.ft-grid-filter, .ft-cat-crumb-name').forEach(function (el) { el.style.opacity = '1'; });

  var pdp = $('[data-ft-product]');
  if (pdp) {
    var d = pdp.dataset, slug = d.ftProduct, price = parseFloat(d.ftPrice) || 0;
    if (d.ftName) document.title = d.ftName + ' | Furtune';
    var catLink = $('.ft-pdp-crumb-cat');
    if (catLink && d.ftCat) catLink.href = '/collections/' + d.ftCat;

    var src = $('.ft-finish-source'), box = $('.ft-finish-options');
    var fins = finishList(src ? src.textContent : '');
    var finish = fins[0] || '';
    fins.forEach(function (f, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ft-fin'; b.innerHTML = dot(f) + esc(f); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () { finish = f; $$('.ft-fin', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
      box.appendChild(b);
    });
    if (!fins.length && box) { var blk = box.closest('.ft-pdp-block'); if (blk) blk.classList.add('ft-hidden'); }

    var qty = 1, qv = $('.ft-qty-value');
    function setQty(n) { qty = Math.max(1, Math.min(10, n)); if (qv) qv.textContent = qty; }
    var minus = $('.ft-qty-minus'), plus = $('.ft-qty-plus');
    if (minus) minus.addEventListener('click', function () { setQty(qty - 1); });
    if (plus) plus.addEventListener('click', function () { setQty(qty + 1); });

    var aboutHead = $('.ft-pdp-h2'), details = aboutHead && aboutHead.parentElement;
    if (details) {
      var row = function (cls) { var v = $('.' + cls, details); return v ? v.closest('.ft-spec') : null; };
      var acc = function (title, nodes, open) {
        var d = document.createElement('details'); d.className = 'ft-acc'; if (open) d.open = true;
        var s = document.createElement('summary'); s.textContent = title; d.appendChild(s);
        var body = document.createElement('div'); body.className = 'ft-acc-body';
        nodes.forEach(function (n) { if (n) body.appendChild(typeof n === 'string' ? Object.assign(document.createElement('div'), { innerHTML: n }) : n); });
        d.appendChild(body); return d;
      };
      var care = $('.ft-spec-care', details), lead = $('.ft-pdp-lead');
      var wrap = document.createElement('div');
      wrap.appendChild(acc('Specification', [row('ft-spec-materials'), row('ft-spec-dimensions'), row('ft-spec-sku')], true));
      wrap.appendChild(acc('Care', [care ? '<p style="margin:0">' + esc(care.textContent) + '</p>' : '']));
      wrap.appendChild(acc('Delivery & returns', ['<p style="margin:0 0 8px">' + esc(lead ? lead.textContent : '') + '. Free white-glove delivery on orders over $1,000, and 30-day returns collected from your door.</p><a href="/help#delivery">Delivery and returns in full</a>']));
      var careRow = care && care.closest('.ft-spec'); if (careRow) careRow.remove();
      details.appendChild(wrap);
    }

    var shown = 0;
    $$('.ft-related [data-ft-slug]').forEach(function (b) {
      var it = b.closest('.w-dyn-item'); if (!it) return;
      if (b.getAttribute('data-ft-slug') === slug || shown >= 4) it.classList.add('ft-hidden'); else shown++;
    });

    var add = $('.ft-add-to-cart'), img = $('.ft-pdp-img');
    if (add) add.addEventListener('click', function (e) {
      e.preventDefault();
      var c = load(), key = slug + '|' + finish, hit = null;
      c.forEach(function (i) { if (i.key === key) hit = i; });
      if (hit) hit.qty = Math.min(10, hit.qty + qty);
      else c.push({ key: key, slug: slug, name: d.ftName, price: price, sku: d.ftSku, finish: finish, qty: qty, img: img ? (img.currentSrc || img.src) : '' });
      save(c);
      add.textContent = 'Added to cart';
      setTimeout(function () { add.textContent = 'Add to cart'; }, 1600);
      toast('<span>' + esc(d.ftName) + ' added</span><a href="/cart">View cart</a>');
    });
  }

  var list = $('.ft-cart-items');
  if (list) {
    var layout = $('.ft-cart-layout'), empty = $('.ft-cart-empty');
    var render = function () {
      var c = load();
      if (layout) layout.classList.toggle('ft-hidden', !c.length);
      if (empty) empty.style.display = c.length ? 'none' : 'block';
      list.innerHTML = c.map(function (i, n) {
        var href = '/product/' + encodeURIComponent(i.slug);
        return '<div class="ft-row"><a class="ft-row-media" href="' + href + '"><img src="' + esc(i.img) + '" alt="' + esc(i.name) + '" onerror="this.remove()"></a>' +
          '<div><a class="ft-row-name" href="' + href + '">' + esc(i.name) + '</a><div class="ft-row-meta">' + esc(i.finish) + '</div>' +
          '<div class="ft-row-ctrls"><div class="ft-qty"><button type="button" class="ft-qty-btn" data-a="dec" data-i="' + n + '" aria-label="Decrease quantity">−</button>' +
          '<div class="ft-qty-value">' + i.qty + '</div><button type="button" class="ft-qty-btn" data-a="inc" data-i="' + n + '" aria-label="Increase quantity">+</button></div>' +
          '<button type="button" class="ft-row-remove" data-a="rm" data-i="' + n + '">Remove</button></div></div>' +
          '<div class="ft-row-price">' + money(i.price * i.qty) + '</div></div>';
      }).join('');
      renderTotals(c);
    };
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var c = load(), i = +b.getAttribute('data-i'), a = b.getAttribute('data-a');
      if (!c[i]) return;
      if (a === 'inc') c[i].qty = Math.min(10, c[i].qty + 1);
      if (a === 'dec') c[i].qty -= 1;
      if (a === 'rm' || c[i].qty < 1) c.splice(i, 1);
      save(c); render();
    });
    render();
  }

  var form = $('#ft-checkout') || $('form[name="ft-checkout"]');
  if (form) {
    var items = load();
    if (!items.length) { location.replace('/cart'); return; }
    var coItems = $('.ft-co-items');
    if (coItems) coItems.innerHTML = mini(items);
    renderTotals(items);
    var HINTS = { 'first-name': '', 'last-name': '', address: 'House number and street', city: '', state: '', zip: '', phone: 'For delivery updates', 'demo-card': '1234 1234 1234 1234', 'demo-exp': 'MM / YY', 'demo-cvc': 'CVC' };
    Object.keys(HINTS).forEach(function (n) { var el = form.querySelector('[name="' + n + '"]'); if (el) el.placeholder = HINTS[n]; });
    ['demo-card', 'demo-exp', 'demo-cvc', 'zip'].forEach(function (n) { var el = form.querySelector('[name="' + n + '"]'); if (el) el.setAttribute('inputmode', 'numeric'); });
    var val = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    document.addEventListener('submit', function (e) {
      if (e.target !== form) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var c = load(); if (!c.length) { location.href = '/cart'; return; }
      write(ORDER, { number: 'FT-' + String(Date.now()).slice(-6), first: val('first-name'), email: val('email'), items: c, totals: totals(c) });
      save([]);
      location.href = '/order-confirmed';
    }, true);
  }

  function linkify(el, href) {
    if (!el || el.closest('a')) return;
    var a = document.createElement('a'); a.href = href; a.className = 'ft-linkify';
    el.parentNode.insertBefore(a, el); a.appendChild(el);
  }
  function slugify(s) { return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  $$('.product-info').forEach(function (card) { var n = $('.product-name', card); if (n) linkify(card, '/product/' + slugify(n.textContent)); });
  var rooms = { office: '/collections/office', home: '/collections/living-room', outdoor: '/collections/outdoor' };
  $$('.template-naming').forEach(function (h) {
    var k = h.textContent.trim().toLowerCase(); if (!rooms[k]) return;
    var tile = h.closest('.template-content-1, .template-naming-2');
    linkify(tile && !tile.closest('a') ? tile : h, rooms[k]);
  });
  $$('.text-link-wrapper, .explore-our-space, .discover-more').forEach(function (el) { linkify(el, '/shop'); });

  var tyItems = $('.ft-ty-items');
  if (tyItems) {
    var o = read(ORDER, null);
    if (o && o.items) {
      setText('.ft-ty-number', o.number);
      if (o.first) setText('.ft-ty-name', ', ' + o.first);
      if (o.email) setText('.ft-ty-email', o.email);
      tyItems.innerHTML = mini(o.items);
      renderTotals(o.items);
    } else {
      var card = $('.ft-ty-card'); if (card) card.classList.add('ft-hidden');
      setText('.ft-ty-number', '');
    }
  }
})();
