/* Dilam B' — page de vente d'un ebook : /ebook/<adresse>
   Le contenu vient du document D1 ebooks/<adresse>, injecté par le serveur dans #ebdata. */
(function () {
  'use strict';

  var DEFAULT_WA = '2250546494484';
  var CONFIG = { waNumber: DEFAULT_WA, pixelId: '1671688320192246' };
  var E = null;
  var root = document.getElementById('eb');
  var slug = (location.pathname.split('/')[2] || '').toLowerCase();

  // ───────────── Utilitaires ─────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Typographie française : apostrophe courbe, espaces fines insécables avant ; ! ? et dans les guillemets,
  // espace insécable avant les deux-points.
  function fr(s) {
    return esc(String(s == null ? '' : s)
      .replace(/'/g, '’')
      .replace(/(\S)-(ce|je|tu|il|elle|on|nous|vous|ils|elles|t-il|t-elle|t-on)\b/g, '$1\u2011$2')
      .replace(/\s*([;!?])/g, ' $1')
      .replace(/\s*:(?=\s)/g, ' :')
      .replace(/«\s*/g, '« ')
      .replace(/\s*»/g, ' »')
      .replace(/(\d)\s(\d{3})\b/g, '$1 $2')
      .replace(/(\d)\s(FCFA|F|pages|jours|heures|minutes)\b/g, '$1 $2'));
  }
  function money(n) { return (parseInt(n, 10) || 0).toLocaleString('fr-FR').replace(/[\s  ]/g, ' ') + ' FCFA'; }
  function waNumber() { return String(CONFIG.waNumber || DEFAULT_WA).replace(/[^0-9]/g, ''); }
  function waLink(text) { return 'https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(text); }
  function paras(list) { return (list || []).map(function (p) { return '<p>' + fr(p) + '</p>'; }).join(''); }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function api(path, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {});
    opt.credentials = 'same-origin';
    return fetch('/api' + path, opt);
  }

  // ───────────── Mesure Meta ─────────────
  function readCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function initPixel() {
    if (!CONFIG.pixelId || window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CONFIG.pixelId);
  }
  function track(name, data) {
    var id = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { if (window.fbq) window.fbq('track', name, data || {}, { eventID: id }); } catch (e) {}
    api('/capi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: name, event_id: id, event_source_url: location.href, custom_data: data || {}, fbp: readCookie('_fbp'), fbc: readCookie('_fbc') })
    }).catch(function () {});
  }
  function product() { return { content_ids: [E.slug], content_type: 'product', content_name: E.title, value: E.price, currency: 'XOF' }; }

  // ───────────── Rendu ─────────────
  function buyBlock(label, id) {
    return '<div class="eb-buy"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<p class="eb-price"><strong>' + money(E.price) + '</strong>' + fr(E.price_label || 'Paiement unique') + '</p>' +
      '<button class="btn btn-primary" type="button" data-buy>' + fr(label) + '</button>' +
      '</div>';
  }
  function payPills() {
    return '<div class="paylogos" aria-label="Moyens de paiement acceptés">' +
      ['Wave', 'Orange Money', 'MTN MoMo', 'Visa', 'Mastercard'].map(function (p) { return '<span>' + p + '</span>'; }).join('') +
      '</div>';
  }
  // Images et vidéos ajoutées depuis l'admin, chacune à un emplacement de la structure.
  var YT_RE = /^[A-Za-z0-9_-]{11}$/;
  function okSrc(u) { return typeof u === 'string' && (/^\/media\/(img|vid)\//.test(u) || /^\/public\//.test(u)); }
  function mediaFor(slot) {
    return (E.media || []).filter(function (m) { return m && m.slot === slot; }).map(function (m) {
      var cap = m.caption ? '<figcaption>' + fr(m.caption) + '</figcaption>' : '';
      var tall = m.w && m.h && m.h > m.w;
      var dims = (m.w && m.h) ? ' width="' + (parseInt(m.w, 10) || '') + '" height="' + (parseInt(m.h, 10) || '') + '"' : '';
      if (m.type === 'image' && okSrc(m.src)) {
        return '<figure class="eb-media' + (tall ? ' tall' : '') + '"><button type="button" class="media-zoom" data-zoom="' + esc(m.src) + '" aria-label="Agrandir l’image' + (m.caption ? ' : ' + esc(m.caption) : '') + '">' +
          '<img src="' + esc(m.src) + '" alt="' + esc(m.caption || '') + '" loading="lazy" decoding="async"' + dims + '></button>' + cap + '</figure>';
      }
      if (m.type === 'video' && okSrc(m.src)) {
        return '<figure class="eb-media' + (tall ? ' tall' : '') + '"><video controls preload="none" playsinline src="' + esc(m.src) + '"' +
          (okSrc(m.poster) ? ' poster="' + esc(m.poster) + '"' : '') + dims + '></video>' + cap + '</figure>';
      }
      if (m.type === 'youtube' && YT_RE.test(m.yt || '')) {
        return '<figure class="eb-media' + (m.vertical ? ' tall' : '') + '"><button type="button" class="yt' + (m.vertical ? ' v' : '') + '" data-yt="' + esc(m.yt) + '" aria-label="Lire la vidéo' + (m.caption ? ' : ' + esc(m.caption) : '') + '">' +
          '<img src="https://i.ytimg.com/vi/' + esc(m.yt) + '/hqdefault.jpg" alt="" loading="lazy" decoding="async"><span class="play" aria-hidden="true"></span></button>' + cap + '</figure>';
      }
      return '';
    }).join('');
  }
  function playYt(btn) {
    var id = btn.getAttribute('data-yt');
    if (!YT_RE.test(id)) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1';
    f.title = 'Vidéo';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.className = 'yt-frame' + (btn.classList.contains('v') ? ' v' : '');
    btn.replaceWith(f);
  }

  function section(cls, inner) { return '<section class="eb-sec ' + (cls || '') + '"><div class="eb-col">' + inner + '</div></section>'; }

  var PAGES = [];
  function render() {
    var files = (E.files && E.files.items) || [];
    PAGES = [];
    files.forEach(function (f) { (f.previews || []).forEach(function (p) { PAGES.push(p); }); });
    var totalPages = files.reduce(function (s, f) { return s + (parseInt(f.pages, 10) || 0); }, 0);
    var extra = (E.extra_covers || []).slice(0, 2);
    var h = '';

    // Haut de page
    h += '<section class="eb-hero"><div class="eb-col">' +
      '<div class="eb-hero-txt">' +
        '<p class="eb-sur">' + fr(E.title) + (E.author_name ? ', par ' + fr(E.author_name) : '') + '</p>' +
        '<h1>' + fr(E.headline || E.title) + '</h1>' +
        (E.subtitle ? '<p class="eb-sub">' + fr(E.subtitle) + '</p>' : '') +
      '</div>' +
      (E.banner
        ? '<div class="eb-visual eb-banner"><img src="' + esc(E.banner) + '" alt="' + esc(E.title) + ' : aperçu du guide" width="1200" height="900" fetchpriority="high"></div>'
        : '<div class="eb-visual">' +
          (extra[0] ? '<img class="fan l" src="' + esc(extra[0]) + '" alt="" loading="lazy">' : '') +
          (extra[1] ? '<img class="fan r" src="' + esc(extra[1]) + '" alt="" loading="lazy">' : '') +
          '<img class="main" src="' + esc(E.cover) + '" alt="Couverture : ' + esc(E.title) + '" width="600" height="800" fetchpriority="high">' +
        '</div>') +
      '<div class="eb-buy-wrap">' + buyBlock(E.cta || 'Acheter', 'heroBuy') +
        (PAGES.length ? '<button type="button" class="eb-peek" data-peek>Voir un extrait (' + PAGES.length + ' pages)</button>' : '') +
        payPills() +
        // Les moyens de paiement sont déjà affichés juste au-dessus : on ne les répète pas dans la liste.
        '<ul class="eb-assure">' + (E.reassure || []).filter(function (r) { return !/wave|orange money/i.test(r); }).map(function (r) { return '<li>' + fr(r) + '</li>'; }).join('') + '</ul>' +
      '</div>' +
    '</div></section>';
    var mh = mediaFor('hero');
    if (mh) h += section('media-sec', mh);

    // Problème, agitation, solution
    if (E.problem) h += section('', '<h2>' + fr(E.problem.title) + '</h2>' + paras(E.problem.paragraphs) + mediaFor('problem'));
    if (E.agitation) h += section('', '<h2>' + fr(E.agitation.title) + '</h2>' + paras(E.agitation.paragraphs) + mediaFor('agitation'));
    if (E.solution) {
      var lad = E.ladder || {};
      h += section('tint',
        '<h2>' + fr(E.solution.title) + '</h2>' + paras(E.solution.paragraphs) +
        (lad.steps ? '<h3>' + fr(lad.title) + '</h3>' + (lad.intro ? '<p>' + fr(lad.intro) + '</p>' : '') +
          '<ol class="ladder" aria-label="Les cinq marches, de la première à la dernière">' +
          lad.steps.map(function (s, k, all) {
            // Escalier : chaque marche se décale d'un cran, quel que soit le nombre de marches.
            var n = all.length, unit = n > 1 ? 32 / (n - 1) : 0;
            return '<li class="' + (k === n - 1 ? 'top' : '') + '" style="margin-left:' + (k * unit).toFixed(1) + '%;margin-right:' + ((n - 1 - k) * unit).toFixed(1) + '%"><span class="st">' + fr(s.name) + '</span><span class="tx">' + fr(s.text) + '</span></li>';
          }).join('') +
          '</ol>' : '') + mediaFor('solution'));
    }

    // Compétences
    if (E.skills) h += section('', '<h2>' + fr(E.skills.title) + '</h2><ul class="checks">' +
      E.skills.items.map(function (s) { return '<li>' + fr(s) + '</li>'; }).join('') + '</ul>' + mediaFor('skills'));

    // Fichiers
    if (files.length) h += section('', '<h2>' + fr(E.files.title) + '</h2><div class="files">' +
      files.map(function (f) {
        var prev = (f.previews || []).length ? '<div class="file-prev" role="list" aria-label="Pages intérieures : ' + esc(f.name) + '">' + f.previews.map(function (p, k) { return '<button type="button" class="prev-btn" role="listitem" data-zoom="' + esc(p) + '" aria-label="Agrandir la page ' + (k + 1) + ' : ' + esc(f.name) + '"><img src="' + esc(p) + '" alt="" loading="lazy" decoding="async" width="640" height="907"></button>'; }).join('') + '</div>' : '';
        return '<div class="file"><div class="file-head">' +
          (f.cover ? '<img class="file-cv" src="' + esc(f.cover) + '" alt="" loading="lazy" decoding="async">' : '') +
          '<span class="file-name">' + fr(f.name) + '</span>' +
          (f.pages ? '<span class="file-pages">' + f.pages + ' pages</span>' : '') + '</div>' +
          (f.content ? '<p>' + fr(f.content) + '</p>' : '') + prev + '</div>';
      }).join('') + '</div>' +
      (files.some(function (f) { return (f.previews || []).length; }) ? '<p class="prev-hint">Touche une page pour l’agrandir.</p>' : '') +
      (E.files.total_note ? '<p class="files-total">' + fr(E.files.total_note) + '</p>' :
       (files.length > 1 && totalPages ? '<p class="files-total">' + files.length + ' fichiers PDF, ' + totalPages + ' pages au total.</p>' : '')) +
      (E.files.roles ? '<p class="files-roles">' + fr(E.files.roles) + '</p>' : '') +
      mediaFor('files') + buyBlock(E.cta || 'Acheter'));

    // Pour qui : deux listes courtes (un texte simple reste accepté)
    function fitList(v) {
      if (Array.isArray(v)) return '<ul>' + v.map(function (x) { return '<li>' + fr(x) + '</li>'; }).join('') + '</ul>';
      return '<p>' + fr(v) + '</p>';
    }
    if (E.audience) h += section('', '<h2>' + fr(E.audience.title) + '</h2><div class="fit">' +
      '<div class="yes">' + (E.audience.yes_title ? '<p class="fit-t">' + fr(E.audience.yes_title) + '</p>' : '') + fitList(E.audience.yes) + '</div>' +
      '<div class="no">' + (E.audience.no_title ? '<p class="fit-t">' + fr(E.audience.no_title) + '</p>' : '') + fitList(E.audience.no) + '</div></div>' + mediaFor('audience'));

    // Auteur
    if (E.author) h += section('tint', '<h2>' + fr(E.author.title) + '</h2><div class="author">' +
      (E.author.photo ? '<img src="' + esc(E.author.photo) + '" alt="' + esc(E.author_name || '') + '" loading="lazy">' : '') +
      '<p>' + fr(E.author.text) + '</p></div>' + mediaFor('author'));

    // Action
    var A = E.action || {};
    h += section('', '<h2>' + fr(A.title || 'Commence aujourd’hui.') + '</h2>' +
      (A.price_line ? '<p class="price-big">' + fr(A.price_line) + '</p>' : '') +
      (A.items ? '<ul class="checks">' + A.items.map(function (s) { return '<li>' + fr(s) + '</li>'; }).join('') + '</ul>' : '') +
      (A.value ? '<p class="value-line">' + fr(A.value) + '</p>' : '') +
      (A.payment ? '<p>' + fr(A.payment) + '</p>' : '') + payPills() +
      (A.delivery ? '<p>' + fr(A.delivery) + '</p>' : '') + mediaFor('action') +
      '<div class="cta-block">' + buyBlock(E.cta_final || E.cta || 'Acheter', 'finalBuy') + '</div>');

    // FAQ
    if ((E.faq || []).length) h += section('', '<h2>Questions fréquentes</h2><div class="faq">' +
      E.faq.map(function (f) {
        return '<details><summary>' + fr(f.q) + '</summary><p>' + fr(f.a) +
          (f.whatsapp ? ' <a href="' + esc(waLink('Bonjour, j’ai un souci avec mes fichiers « ' + E.title + ' ». Mon adresse e-mail : ')) + '" target="_blank" rel="noopener" data-lead>Écrire sur WhatsApp</a>' : '') +
          '</p></details>';
      }).join('') + '</div>');

    // Dernier mot
    if (E.final) h += section('tint final', '<p>' + fr(E.final) + '</p>' + mediaFor('final') + buyBlock(E.cta_final || E.cta || 'Acheter'));

    root.innerHTML = h;
    document.getElementById('buybarPrice').textContent = money(E.price);
    setupBuybar();
  }

  // Barre d'achat fixe : visible une fois le bouton du haut dépassé, masquée quand le dernier bouton est à l'écran.
  function setupBuybar() {
    var bar = document.getElementById('buybar');
    var hero = document.getElementById('heroBuy');
    var fin = document.getElementById('finalBuy');
    if (!hero) return;
    var ticking = false;
    function upd() {
      ticking = false;
      var h = hero.getBoundingClientRect();
      var f = fin ? fin.getBoundingClientRect() : null;
      var finVisible = f && f.top < innerHeight && f.bottom > 0;
      var show = h.bottom < 0 && !finVisible;
      if (bar.hidden === show) { bar.hidden = !show; document.body.classList.toggle('has-buybar', show); }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }

  // ───────────── Achat ─────────────
  var sheet = document.getElementById('buySheet');
  var lastFocus = null;
  function openBuy() {
    lastFocus = document.activeElement;
    var saved = '';
    try { saved = localStorage.getItem('eb_email') || ''; } catch (e) {}
    document.getElementById('buyBody').innerHTML =
      '<p class="buy-sum"><strong>' + fr(E.title) + '</strong><br>' + money(E.price) + '</p>' +
      '<form id="buyForm" novalidate>' +
        '<div class="field"><label for="buyEmail">Ton adresse e-mail</label>' +
        '<input id="buyEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required value="' + esc(saved) + '" aria-describedby="buyHelp">' +
        '<p class="field-help" id="buyHelp">Ton lien de téléchargement sera envoyé à cette adresse. Vérifie-la bien.</p></div>' +
        '<button class="btn btn-primary btn-block" type="submit" id="buyGo">Payer ' + money(E.price) + '</button>' +
        '<p class="buy-note">Wave, Orange Money, MTN ou carte bancaire. Paiement sécurisé par Paystack.</p>' +
      '</form><div id="buyMsg"></div>';
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var i = document.getElementById('buyEmail'); if (i) i.focus(); }, 60);
    document.getElementById('buyForm').addEventListener('submit', submitBuy);
    track('InitiateCheckout', product());
  }
  function closeBuy() {
    sheet.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v); }

  function submitBuy(ev) {
    ev.preventDefault();
    var input = document.getElementById('buyEmail');
    var email = input.value.trim().toLowerCase();
    var help = document.getElementById('buyHelp');
    if (!validEmail(email)) {
      input.setAttribute('aria-invalid', 'true');
      help.textContent = 'Cette adresse ne semble pas complète. Exemple : prenom@gmail.com';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    try { localStorage.setItem('eb_email', email); } catch (e) {}
    var btn = document.getElementById('buyGo');
    btn.disabled = true; btn.textContent = 'Un instant…';
    api('/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: E.slug, email: email, fbp: readCookie('_fbp'), fbc: readCookie('_fbc') }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d && res.d.url) { location.href = res.d.url; return; }
        if (res.status === 429) { fail('Trop de tentatives. Réessaie dans quelques minutes.'); return; }
        if (res.status === 400) { fail('Vérifie ton adresse e-mail puis réessaie.'); return; }
        if (res.status === 503) { pending(email); return; }
        fail('Le paiement n’a pas pu démarrer. Réessaie dans un instant, ou commande sur WhatsApp.');
        showWa(email);
      })
      .catch(function () { fail('Connexion impossible. Vérifie ton réseau puis réessaie.'); });
    function fail(msg) { btn.disabled = false; btn.textContent = 'Payer ' + money(E.price); help.textContent = msg; }
  }
  function showWa(email) {
    var msg = (E.whatsapp_buy || ('Bonjour, je veux acheter « ' + E.title + ' ».')) + '\nMon adresse e-mail : ' + email;
    document.getElementById('buyMsg').innerHTML = '<a class="btn btn-secondary btn-block" style="margin-top:12px" href="' + esc(waLink(msg)) + '" target="_blank" rel="noopener" data-lead>Commander sur WhatsApp</a>';
  }
  // Paiement en ligne pas encore ouvert : on bascule sur WhatsApp, avec l'e-mail déjà dans le message.
  function pending(email) {
    var msg = (E.whatsapp_buy || ('Bonjour, je veux acheter « ' + E.title + ' ».')) + '\nMon adresse e-mail : ' + email;
    document.getElementById('buyForm').hidden = true;
    document.getElementById('buyMsg').innerHTML =
      '<div class="pending"><strong>Le paiement en ligne ouvre très bientôt.</strong>' +
      '<p>En attendant, commande sur WhatsApp : ton adresse e-mail est déjà dans le message. Tu reçois les moyens de paiement, puis tes fichiers.</p></div>' +
      '<a class="btn btn-primary btn-block" style="margin-top:14px" href="' + esc(waLink(msg)) + '" target="_blank" rel="noopener" data-lead>Commander sur WhatsApp</a>';
  }

  // Visionneuse : une image, ou plusieurs pages à feuilleter (boutons, flèches du clavier, glisser du doigt).
  var zoom = null, zList = [], zIdx = 0;
  function openZoom(src, list) {
    zList = list && list.length ? list : [src];
    zIdx = Math.max(0, zList.indexOf(src));
    var multi = zList.length > 1;
    zoom = document.createElement('div');
    zoom.className = 'zoom';
    zoom.setAttribute('role', 'dialog');
    zoom.setAttribute('aria-modal', 'true');
    zoom.setAttribute('aria-label', multi ? 'Extrait du guide' : 'Image agrandie');
    zoom.innerHTML = '<button type="button" class="zoom-close" aria-label="Fermer">×</button><img alt="">' +
      (multi ? '<button type="button" class="zoom-nav prev" aria-label="Page précédente">‹</button><button type="button" class="zoom-nav next" aria-label="Page suivante">›</button><p class="zoom-count" aria-live="polite"></p>' : '');
    document.body.appendChild(zoom);
    document.body.style.overflow = 'hidden';
    showZoom();
    var x0 = null;
    zoom.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    zoom.addEventListener('touchend', function (e) {
      if (x0 === null || !multi) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { e.preventDefault(); step(dx < 0 ? 1 : -1); }
    });
    zoom.querySelector('.zoom-close').focus();
  }
  function showZoom() {
    zoom.querySelector('img').src = zList[zIdx];
    var c = zoom.querySelector('.zoom-count');
    if (c) c.textContent = 'Page ' + (zIdx + 1) + ' sur ' + zList.length;
  }
  function step(d) { zIdx = (zIdx + d + zList.length) % zList.length; showZoom(); }
  function closeZoom() {
    if (!zoom) return;
    zoom.remove(); zoom = null;
    if (sheet.hidden) document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var y = e.target.closest('[data-yt]');
    if (y) { playYt(y); return; }
    if (e.target.closest('[data-peek]')) { openZoom(PAGES[0], PAGES); return; }
    var z = e.target.closest('[data-zoom]');
    if (z) {
      var src = z.getAttribute('data-zoom');
      openZoom(src, PAGES.indexOf(src) > -1 ? PAGES : null);
      return;
    }
    var nav = e.target.closest('.zoom-nav');
    if (zoom && nav) { step(nav.classList.contains('next') ? 1 : -1); return; }
    if (zoom && e.target.closest('.zoom')) { closeZoom(); return; }
    if (e.target.closest('[data-buy]')) { e.preventDefault(); openBuy(); return; }
    if (e.target.closest('[data-close]')) { closeBuy(); return; }
    if (e.target.closest('[data-lead]')) track('Lead', product());
  });
  // Une seule vidéo à la fois.
  document.addEventListener('play', function (e) {
    [].forEach.call(document.querySelectorAll('video'), function (v) { if (v !== e.target) v.pause(); });
  }, true);
  document.addEventListener('keydown', function (e) {
    if (zoom && zList.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { step(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key !== 'Escape') return;
    if (zoom) closeZoom(); else if (!sheet.hidden) closeBuy();
  });

  // ───────────── Démarrage ─────────────
  function start(data) {
    E = data;
    if (!E || E.active === false) { root.innerHTML = '<div class="loading">Cette page n’est plus en ligne.</div>'; return; }
    E.slug = E.slug || slug;
    render();
  }
  document.getElementById('year').textContent = new Date().getFullYear();

  var cfgP = api('/db/shop_config').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (docs) {
      (docs || []).forEach(function (d) { if (d._id === 'sell_config' && d.value) Object.assign(CONFIG, d.value); });
      initPixel();
    });

  var inline = document.getElementById('ebdata');
  var data = null;
  if (inline) { try { data = JSON.parse(inline.textContent); } catch (e) {} }
  var dataP = data ? Promise.resolve(data)
    : api('/db/ebooks/' + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  dataP.then(start);
  Promise.all([dataP, cfgP]).then(function () { if (E && E.title) track('ViewContent', product()); });
})();
