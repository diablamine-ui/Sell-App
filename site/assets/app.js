/* Dilam B' — site public
   Données : /api/db/books et /api/db/shop_config (lecture seule).
   Liens hérités conservés : /?livre=<slug> et /?cat=<catégorie>. */
(function () {
  'use strict';

  // ───────────── Réglages ─────────────
  var DEFAULT_WA = '2250546494484';
  var DEFAULT_PIXEL = '1671688320192246';
  // Réglages de livraison : valeurs par défaut, remplacées par celles de l'admin (shop_config / sell_delivery).
  var OFFER = { active: true, packs: 2, zones: ['abidjan'] };
  var ZONES = [
    { key: 'abidjan', label: 'Abidjan', sub: 'Livré en 24 h', fee: 1500 },
    { key: 'peripherie', label: 'Périphérie', sub: 'Anyama, Grand-Bassam, Songon, N’Dotré, Bingerville', fee: 2000 },
    { key: 'interieur', label: 'Intérieur du pays', sub: 'Expédition dans ta ville', fee: 2500 }
  ];
  var CATS = [
    { key: 'finance', label: 'Finances', goal: 'Mieux gérer mon argent', sub: 'Épargne, investissement, richesse' },
    { key: 'devperso', label: 'Développement personnel', goal: 'Renforcer mon mental', sub: 'Confiance, discipline, relations' },
    { key: 'productivite', label: 'Productivité', goal: 'Être plus efficace', sub: 'Temps, concentration, stratégie' },
    { key: 'cheikh', label: 'Cheikh Anta Diop', goal: "Connaître l'histoire africaine", sub: "L'œuvre de Cheikh Anta Diop" },
    { key: 'pack', label: 'Packs', goal: 'Les packs de deux livres', sub: 'Deux livres qui se complètent, à prix réduit' },
    { key: 'autre', label: 'Autres', goal: 'Autres livres', sub: '' }
  ];
  var CAT_BY_KEY = {};
  CATS.forEach(function (c) { CAT_BY_KEY[c.key] = c; });
  var BADGE_SCORE = { bestseller: 4, recommended: 3, coup: 2, new: 1, promo: 1, limited: 1, none: 0 };
  var TAGS = { bestseller: 'Meilleure vente', new: 'Nouveau', coup: 'Coup de cœur' };
  // Images au gabarit « livre posé sur un bureau » que l'on peut recadrer sur le livre seul.
  var NO_CROP = ['rien-changer.png', 'pensee-positive.jpg', 'pere-psychologie.jpg'];

  var BOOKS = [];
  var EBOOKS = [];
  // Mise en avant des ebooks (admin > Ebooks > Mise en avant). Valeurs par défaut si rien n'est réglé.
  var PROMO = null;
  var CONFIG = { waNumber: DEFAULT_WA, pixelId: DEFAULT_PIXEL, waMessage: '' };
  var cart = [];
  var view = document.getElementById('view');

  // ───────────── Utilitaires ─────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Description : **texte** s'affiche en gras ; les astérisques orphelins disparaissent.
  function richText(t) {
    return esc(t).replace(/\*\*([^*\n][^*]*?)\*\*/g, '<strong>$1</strong>').replace(/\*\*/g, '');
  }
  // Description d'un livre : des paragraphes courts, sans les grands blancs des textes publicitaires.
  function descHTML(t) {
    return String(t || '').split(/\n\s*\n+/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + richText(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function money(n) { return (parseInt(n, 10) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA'; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function imgSrc(u) {
    if (!u) return '';
    var raw = u;
    try { raw = decodeURI(u); } catch (e) {}
    return encodeURI(raw);
  }
  // Images du catalogue : versions WebP légères (tools/optimize_images.py), l'original sert au partage.
  function picAttrs(u, sizes) {
    var m = /^\/public\/images\/([^/]+)\.(jpe?g|png)$/i.exec((function () { try { return decodeURI(u || ''); } catch (e) { return u || ''; } })());
    if (!m) return 'src="' + esc(imgSrc(u)) + '"';
    var base = '/public/images/opt/' + m[1];
    return 'src="' + esc(encodeURI(base + '-400.webp')) + '" srcset="' + esc(encodeURI(base + '-400.webp')) + ' 400w, ' +
      esc(encodeURI(base + '-800.webp')) + ' 800w" sizes="' + sizes + '"';
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function waNumber() { return String(CONFIG.waNumber || DEFAULT_WA).replace(/[^0-9]/g, ''); }
  function waLink(text) { return 'https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(text); }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function api(path, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {});
    opt.credentials = 'same-origin';
    return fetch('/api' + path, opt);
  }

  // ───────────── Mesure (Meta + compteurs) ─────────────
  function readCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function initPixel() {
    if (!CONFIG.pixelId || window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CONFIG.pixelId);
  }
  // Un même identifiant pour le pixel et le serveur : Meta ne compte l'événement qu'une fois.
  function track(name, data) {
    var id = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { if (window.fbq) window.fbq('track', name, data || {}, { eventID: id }); } catch (e) {}
    api('/capi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: name, event_id: id, event_source_url: location.href, custom_data: data || {}, fbp: readCookie('_fbp'), fbc: readCookie('_fbc') })
    }).catch(function () {});
  }
  function stat(book, type) {
    api('/stats/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: book.pos, type: type }) }).catch(function () {});
  }

  // ───────────── Données ─────────────
  function mapBook(r) {
    return {
      fid: r._id,
      title: r.title || 'Sans titre',
      author: r.author || '',
      price: parseInt(r.price, 10) || 0,
      oldPrice: r.old_price ? parseInt(r.old_price, 10) || 0 : 0,
      category: CAT_BY_KEY[r.category] ? r.category : 'autre',
      badge: r.badge || 'none',
      oos: !!r.out_of_stock,
      image: r.image || '',
      desc: r.description || '',
      slug: r.slug || '',
      sort: typeof r.sort_order === 'number' ? r.sort_order : null
    };
  }
  function load() {
    return Promise.all([
      api('/db/books').then(function (r) { if (!r.ok) throw new Error('books ' + r.status); return r.json(); }),
      api('/db/shop_config').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      api('/db/ebooks').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (res) {
      EBOOKS = (res[2] || []).filter(function (e) { return e && e.active !== false && !e.hidden && e.title; });
      var rows = res[0].map(mapBook);
      // Même ordre que l'administration, pour que les statistiques correspondent aux bons livres.
      rows.forEach(function (b, i) { b._i = i + 1; });
      rows.sort(function (a, b) {
        var x = a.sort != null ? a.sort : 1e6 + a._i, y = b.sort != null ? b.sort : 1e6 + b._i;
        return x - y;
      });
      rows.forEach(function (b, i) { b.pos = i + 1; });
      BOOKS = rows;
      res[1].forEach(function (d) {
        if (d._id === 'sell_config' && d.value) Object.assign(CONFIG, d.value);
        if (d._id === 'sell_delivery' && d.value) applyDelivery(d.value);
        if (d._id === 'sell_promo' && d.value) PROMO = d.value;
        if (d._id === 'sell_bandeau' && d.value && d.value.active && d.value.texte) {
          // Bandeau de promotion : rouge et défilant, pour attirer l'œil.
          var n = document.getElementById('notice');
          var item = '<span class="notice-item">' + esc(d.value.texte) + '</span>';
          var run = new Array(6).join(item);
          n.innerHTML = '<span class="sr-only">' + esc(d.value.texte) + '</span><div class="notice-track" aria-hidden="true">' + run + run + '</div>';
          n.hidden = false;
        }
      });
    });
  }
  function bySlug(slug) {
    return BOOKS.find(function (b) { return b.slug === slug; }) ||
      BOOKS.find(function (b) { return String(b.pos) === String(slug) || b.fid === slug; });
  }
  // Ebook mis en avant à un emplacement ('home' ou 'pdp'), ou null si l'emplacement est coupé.
  function promoEbook(where) {
    var c = PROMO && PROMO[where];
    if (c && c.active === false) return null;
    var slug = c && c.slug ? c.slug : (where === 'pdp' ? 'lire-autrement' : null);
    var e = slug ? EBOOKS.find(function (x) { return (x.slug || x._id) === slug; }) : EBOOKS[0];
    return e || null;
  }
  function pdpPromo() {
    var e = promoEbook('pdp');
    if (!e) return '';
    var c = (PROMO && PROMO.pdp) || {};
    var title = c.title || 'Tu vas lire ce livre ? Retiens-en l’essentiel.';
    var text = c.text || (e.title + ' : ' + (cardLine(e) || 'le guide en PDF')).replace(/([^.!?…])$/, '$1.');
    return '<a class="pdp-promo" href="/ebook/' + encodeURIComponent(e.slug || e._id) + '?depuis=fiche-livre">' +
      '<img src="' + esc(imgSrc(e.cover)) + '" alt="" loading="lazy" decoding="async" width="56" height="79">' +
      '<span class="pdp-promo-txt"><strong>' + esc(title) + '</strong><span>' + esc(text) + '</span>' +
      '<span class="pdp-promo-price">' + money(e.price) + ' en PDF, reçu tout de suite</span>' +
      '<span class="pdp-promo-go">Découvrir le guide' + ICON.chevron + '</span></span></a>';
  }
  function bookUrl(b) { return '/?livre=' + encodeURIComponent(b.slug || b.fid); }
  function inCat(key) { return BOOKS.filter(function (b) { return b.category === key; }); }
  function ranked(list) {
    return list.slice().sort(function (a, b) {
      if (a.oos !== b.oos) return a.oos ? 1 : -1;
      return (BADGE_SCORE[b.badge] || 0) - (BADGE_SCORE[a.badge] || 0) || a.pos - b.pos;
    });
  }
  function isPromo(b) { return b.badge === 'promo' && b.oldPrice > b.price; }

  // ───────────── Composants ─────────────
  function canCrop(b) {
    if (!b.image || b.category === 'pack' || b.category === 'cheikh') return false;
    if (b.image.indexOf('/public/images/') !== 0) return false;
    var file = b.image.split('/').pop();
    return NO_CROP.indexOf(file) === -1;
  }
  // Nouveaux visuels déposés depuis l'administration (livre seul sur fond neutre) : recadrés au carré, centrés sur le livre.
  function isCleanVisual(b) {
    return !!b.image && /^\/media\/img\//.test(b.image) && b.category !== 'pack' && b.category !== 'cheikh';
  }
  function cover(b, opts) {
    opts = opts || {};
    var tag = '';
    if (opts.tag) {
      if (isPromo(b)) tag = '<span class="cv-tag promo">Promo</span>';
      else if (TAGS[b.badge]) tag = '<span class="cv-tag">' + TAGS[b.badge] + '</span>';
    }
    if (!b.image) {
      return '<div class="cv"><div class="cv-ph">' + esc(b.title) + '</div>' + tag + '</div>';
    }
    var crop = opts.full ? false : canCrop(b);
    var cls = isCleanVisual(b) ? 'cv-sq' : (crop ? 'cv-crop' : 'cv-full');
    return '<div class="cv ' + cls + '"><img ' + picAttrs(b.image, crop ? '(min-width: 820px) 280px, 56vw' : '(min-width: 820px) 220px, 45vw') + ' alt="" loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async">' + tag + '</div>';
  }
  function priceHTML(b) {
    if (isPromo(b)) {
      return '<p class="price"><span class="now is-promo">' + money(b.price) + '</span><span class="was"><span class="sr-only">au lieu de </span>' + money(b.oldPrice) + '</span></p>';
    }
    return '<p class="price"><span class="now">' + money(b.price) + '</span></p>';
  }
  function card(b) {
    return '<a class="card' + (b.oos ? ' oos' : '') + '" href="' + bookUrl(b) + '" data-nav="livre">' +
      cover(b, { tag: true }) +
      '<div class="card-body"><h3 class="card-title">' + esc(b.title) + '</h3>' +
      '<p class="card-author">' + esc(b.category === 'pack' ? 'Pack de deux livres' : b.author) + '</p>' +
      priceHTML(b) + (b.oos ? '<p class="oos-note">Épuisé pour le moment</p>' : '') +
      '</div></a>';
  }
  var ICON = {
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.3A11.8 11.8 0 0 0 1.6 17.9L0 24l6.3-1.7A11.8 11.8 0 0 0 23.9 12a11.7 11.7 0 0 0-3.5-8.5z"/></svg>'
  };

  // ───────────── Pages ─────────────
  function renderHome() {
    var singles = ranked(BOOKS.filter(function (b) { return b.category !== 'pack' && !b.oos; }));
    var shelf = singles.filter(canCrop).slice(0, 5);
    var packs = ranked(inCat('pack')).slice(0, 8);
    var best = singles.slice(0, 10);
    var goals = ['finance', 'devperso', 'productivite', 'cheikh', 'pack'].map(function (k) {
      var n = inCat(k).length;
      if (!n) return '';
      var c = CAT_BY_KEY[k];
      return '<li class="goal"><a href="/?cat=' + k + '" data-nav="cat"><span class="goal-txt"><span class="goal-name">' + esc(c.goal) + '</span><span class="goal-sub">' + esc(c.sub) + '</span></span><span class="goal-n">' + n + '</span>' + ICON.chevron + '</a></li>';
    }).join('');

    view.innerHTML =
      '<section class="hero"><div class="hero-in"><div class="hero-txt">' +
        '<h1>Les bons livres pour avancer, livrés chez toi.</h1>' +
        '<p class="hero-lead">Finances, mental, productivité et histoire africaine. Tu paies seulement à la réception de ton colis.</p>' +
        '<div class="hero-cta"><a class="btn btn-light" href="/?vue=livres" data-nav="livres">Voir les ' + BOOKS.length + ' livres</a>' +
        '<a class="btn btn-ghost-light" href="' + esc(waLink("Bonjour Dilam B', je viens du site. J'aimerais un conseil pour choisir un livre.")) + '" target="_blank" rel="noopener">Demander un conseil</a></div>' +
        '</div>' +
        '<div class="shelf" aria-hidden="true"><div class="shelf-row">' +
          shelf.map(function (b) { return '<a class="shelf-book" href="' + bookUrl(b) + '" data-nav="livre" tabindex="-1">' + cover(b, { eager: true }) + '</a>'; }).join('') +
        '</div><div class="shelf-plank"></div></div>' +
      '</div></section>' +

      '<section class="facts"><div class="wrap"><ul class="facts-list">' +
        fact('<path d="M3 7h18v10H3z"/><path d="M3 10h18"/><path d="M7 14h3"/>', 'Paiement à la livraison', 'Espèces ou Wave, quand tu reçois tes livres.') +
        fact('<path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/>', 'Livraison en 24 h à Abidjan', 'Et partout en Côte d\'Ivoire.') +
        fact('<path d="M4.5 19.5l1.1-3.6A8 8 0 1 1 8.4 18.6z"/>', 'Commande simple', 'Panier ou WhatsApp, on confirme avec toi.') +
      '</ul></div></section>' +

      ebooksSection() +

      '<section class="section"><div class="wrap">' +
        '<div class="section-head"><h2>Que veux-tu améliorer ?</h2></div>' +
        '<ul class="goals">' + goals + '</ul>' +
      '</div></section>' +

      (packs.length ? '<section class="section"><div class="wrap">' +
        '<div class="section-head"><h2>Les packs</h2><a href="/?cat=pack" data-nav="cat">Tout voir</a></div>' +
        '<p class="section-intro">Deux livres qui se répondent sur un même sujet, moins cher qu\'achetés séparément.</p>' +
        '<div class="rail rail-wide" data-auto>' + packs.map(card).join('') + '</div>' +
      '</div></section>' : '') +

      '<section class="section"><div class="wrap">' +
        '<div class="section-head"><h2>Les plus demandés</h2><a href="/?vue=livres" data-nav="livres">Tout voir</a></div>' +
        '<div class="rail" data-auto>' + best.map(card).join('') + '</div>' +
      '</div></section>' +

      '<section class="section"><div class="wrap">' +
        '<div class="section-head"><h2>Comment ça marche</h2></div>' +
        '<ol class="steps">' +
          '<li class="step"><div><h3>Choisis tes livres</h3><p>Ajoute-les au panier, ou commande un livre directement depuis sa page.</p></div></li>' +
          '<li class="step"><div><h3>Envoie ta commande sur WhatsApp</h3><p>Ton nom et ton lieu de livraison suffisent. On te répond pour confirmer.</p></div></li>' +
          '<li class="step"><div><h3>Paie à la réception</h3><p>Le livreur t\'apporte tes livres. Tu paies sur place.</p></div></li>' +
        '</ol>' +
      '</div></section>' +

      '<section class="section"><div class="wrap faq">' +
        '<div class="section-head"><h2>Questions fréquentes</h2></div>' +
        faq('Combien coûte la livraison ?', deliveryFaq()) +
        faq('En combien de temps je reçois mes livres ?', 'En 24 h à Abidjan. Pour les autres villes, le délai dépend de ta localité et t\'est donné au moment de la confirmation.') +
        faq('Comment je paie ?', 'À la livraison, en espèces ou par Wave. Tu ne paies rien avant d\'avoir ton colis entre les mains.') +
        faq('Les livres sont-ils neufs ?', 'Oui. Si un livre n\'est plus disponible, on te prévient avant de confirmer la commande.') +
      '</div></section>' +

      '<div class="wrap"><section class="help">' +
        '<h2>Tu hésites entre plusieurs livres ?</h2>' +
        '<p>Dis-nous ce que tu veux améliorer en ce moment. On te conseille le livre adapté sur WhatsApp.</p>' +
        '<a class="btn btn-light" href="' + esc(waLink("Bonjour Dilam B', je viens du site. J'aimerais un conseil pour choisir un livre.")) + '" target="_blank" rel="noopener">' + ICON.wa + 'Écrire sur WhatsApp</a>' +
      '</section></div>';

    // Ebooks Lamine Diabaté : PDF payés en ligne, chacun avec sa page de vente.
    // Un ebook mis en avant en grand ; les autres défilent seuls dès qu'il y en a assez.
    function ebooksSection() {
      if (!EBOOKS.length) return '';
      // L'ebook mis en valeur (choisi dans l'administration) s'affiche en grand ; les autres forment une ligne en dessous.
      var star = promoEbook('home');
      var rest = EBOOKS.filter(function (e) { return e !== star; });
      var feat = star ? '<a class="ebook-feat' + (star.banner ? ' has-ban' : '') + '" href="/ebook/' + encodeURIComponent(star.slug || star._id) + '?depuis=accueil">' +
          (star.banner
            ? '<span class="ebook-feat-ban"><img src="' + esc(imgSrc(star.banner)) + '" alt="" width="1600" height="900" loading="lazy" decoding="async"></span>'
            : '<span class="ebook-feat-cv"><img src="' + esc(imgSrc(star.cover)) + '" alt="" width="360" height="509" decoding="async"></span>') +
          '<span class="ebook-feat-txt">' +
            '<span class="ebook-feat-title">' + esc(star.title) + '</span>' +
            (cardLine(star) ? '<span class="ebook-feat-line">' + esc(cardLine(star)) + '</span>' : '') +
            '<span class="ebook-feat-price">' + money(star.price) + '<span> en PDF, reçu tout de suite</span></span>' +
            '<span class="btn ebook-feat-btn">Découvrir le guide</span></span></a>' : '';
      var row = rest.length >= 2
        ? '<div class="rail ebooks-rail" data-auto data-dots>' + rest.map(function (e) { return ebookCard(e, 'accueil'); }).join('') + '</div>'
        : (rest.length ? '<div class="ebooks-list">' + rest.map(function (e) { return ebookCard(e, 'accueil'); }).join('') + '</div>' : '');
      return '<section class="ebooks"><div class="wrap">' +
        '<div class="section-head ebooks-head"><h2>Ebooks</h2>' + (EBOOKS.length > 1 ? '<a href="/?vue=ebooks" data-nav="ebooks">Tout voir</a>' : '') + '</div>' +
        '<p class="ebooks-intro">Des livres et des guides pratiques en PDF. Tu paies en ligne et tu reçois tes fichiers par e-mail, à lire sur ton téléphone.</p>' +
        feat + row +
      '</div></section>';
    }
    function fact(path, t, s) {
      return '<li class="fact"><svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg><div><strong>' + t + '</strong><span>' + s + '</span></div></li>';
    }
    function faq(q, a) { return '<details><summary>' + q + '</summary><p>' + a + '</p></details>'; }
    document.title = "Dilam B' | Les livres à p'tits prix, livrés à Abidjan";
  }

  // Phrase courte pour les cartes : l'accroche de la page de vente peut tenir sur plusieurs lignes.
  function cardLine(e) { return e.card_line || String(e.headline || '').replace(/\s*\n\s*/g, ' '); }

  function ebookCard(e, from) {
    var slug = e.slug || e._id;
    return '<a class="ebook" href="/ebook/' + encodeURIComponent(slug) + (from ? '?depuis=' + from : '') + '">' +
      '<span class="ebook-cv"><img src="' + esc(imgSrc(e.cover)) + '" alt="" loading="lazy" decoding="async"></span>' +
      '<span class="ebook-txt"><span class="ebook-title">' + esc(e.title) + '</span>' +
      (cardLine(e) ? '<span class="ebook-line">' + esc(cardLine(e)) + '</span>' : '') +
      '<span class="ebook-price">' + money(e.price) + '<span> en PDF</span></span>' +
      '</span><span class="btn ebook-btn">Découvrir le guide</span></a>';
  }
  function renderEbooks() {
    view.innerHTML =
      '<section class="ebooks ebooks-page"><div class="wrap">' +
        '<nav class="crumbs" aria-label="Tu es ici"><a href="/" data-nav="home">Accueil</a><span class="crumbs-sep" aria-hidden="true">›</span><span aria-current="page">Ebooks</span></nav>' +
        '<div class="cat-head"><h1>Ebooks</h1><p>Des livres et des guides pratiques en PDF. Tu paies en ligne et tu reçois tes fichiers par e-mail, juste après le paiement.</p></div>' +
        (EBOOKS.length ? '<div class="ebooks-list">' + EBOOKS.map(ebookCard).join('') + '</div>' : '<p class="empty">Aucun guide en ligne pour le moment.</p>') +
      '</div></section>';
    document.title = "Ebooks | Dilam B'";
  }

  // Rangées de l'accueil qui défilent seules, de droite à gauche.
  // Le contenu est doublé pour boucler sans fin ; tout s'arrête dès qu'on touche, survole ou utilise le clavier,
  // et reprend quelques secondes après. Rien ne bouge si l'appareil demande à réduire les animations.
  var autoRails = [];
  // La ligne glisse lentement jusqu'au bout, marque une pause, puis revient.
  function pingPong(el, calm) {
    // Le fondu sur les bords n'apparaît que si la ligne dépasse de l'écran.
    function fits() { var over = el.scrollWidth - el.clientWidth > 2; el.classList.toggle('is-auto', over); return !over; }
    fits();
    window.addEventListener('resize', fits);
    if (calm) return;
    var pos = el.scrollLeft, dir = 1, last = 0, paused = false, visible = true, raf = 0, timer = 0, rest = 0, speed = 32;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (!last) { last = t; return; }
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (paused || !visible || document.hidden) return;
      var max = el.scrollWidth - el.clientWidth;
      if (max <= 2) return;                       // tout tient à l'écran : rien à faire défiler
      if (rest > 0) { rest -= dt; return; }       // pause au bout de la ligne
      pos += speed * dt * dir;
      if (pos >= max) { pos = max; dir = -1; rest = 1.8; }
      else if (pos <= 0) { pos = 0; dir = 1; rest = 1.8; }
      el.scrollLeft = pos;
    }
    function hold() { paused = true; clearTimeout(timer); }
    function release() {
      clearTimeout(timer);
      timer = setTimeout(function () { pos = el.scrollLeft; last = 0; paused = false; }, 2500);
    }
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hold(); });
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') release(); });
    el.addEventListener('touchstart', hold, { passive: true });
    el.addEventListener('touchend', release, { passive: true });
    el.addEventListener('wheel', function () { hold(); release(); }, { passive: true });
    el.addEventListener('focusin', hold);
    el.addEventListener('focusout', release);
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null;
    if (io) io.observe(el);
    raf = requestAnimationFrame(frame);
    el._auto = { hold: hold, release: release };
    autoRails.push({ stop: function () { cancelAnimationFrame(raf); clearTimeout(timer); if (io) io.disconnect(); } });
  }

  // Petits points sous une ligne : un par carte, le trait marque la carte visible.
  // Ils n'apparaissent que si des cartes sont cachées hors de l'écran.
  function railDots(el) {
    var cards = [].slice.call(el.children);
    var box = document.createElement('div');
    box.className = 'rail-dots';
    box.setAttribute('aria-label', 'Faire défiler les ebooks');
    cards.forEach(function (c, k) {
      var b = document.createElement('button');
      b.type = 'button';
      var t = c.querySelector('.ebook-title');
      b.setAttribute('aria-label', 'Ebook ' + (k + 1) + ' sur ' + cards.length + (t ? ' : ' + t.textContent : ''));
      b.addEventListener('click', function () {
        if (el._auto) el._auto.hold();
        var max = el.scrollWidth - el.clientWidth;
        el.scrollTo({ left: Math.min(max, c.offsetLeft - cards[0].offsetLeft), behavior: 'smooth' });
        if (el._auto) el._auto.release();
      });
      box.appendChild(b);
    });
    el.insertAdjacentElement('afterend', box);
    var btns = [].slice.call(box.children), cur = -1;
    function upd() {
      var max = el.scrollWidth - el.clientWidth;
      box.hidden = max <= 2;
      var k = max > 0 ? Math.round(el.scrollLeft / max * (cards.length - 1)) : 0;
      if (k !== cur) { btns.forEach(function (b, i) { b.setAttribute('aria-current', i === k ? 'true' : 'false'); }); cur = k; }
    }
    el.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }

  function startAutoRails() {
    autoRails.forEach(function (r) { r.stop(); });
    autoRails = [];
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    view.querySelectorAll('.rail[data-dots]').forEach(railDots);
    view.querySelectorAll('.rail[data-auto]').forEach(function (el) {
      var items = [].slice.call(el.children);
      if (items.length < 2) return;
      // Peu de cartes : aller-retour, sans aucune copie. Beaucoup de cartes : boucle continue.
      if (items.length <= 6) { pingPong(el, calm); return; }
      function addCopy() {
        var first = null;
        items.forEach(function (it) {
          var c = it.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.setAttribute('tabindex', '-1');
          c.querySelectorAll('a,button').forEach(function (x) { x.setAttribute('tabindex', '-1'); });
          el.appendChild(c);
          if (!first) first = c;
        });
        return first;
      }
      var firstCopy = addCopy();
      el.classList.add('is-auto');
      // Une période = la largeur de la série d'origine. Avec peu de cartes, on ajoute des copies
      // pour qu'il reste toujours de quoi remplir l'écran : le défilement ne cale jamais.
      var period = firstCopy.offsetLeft - items[0].offsetLeft;
      for (var n = 0; period > 0 && n < 6 && el.scrollWidth - period < el.clientWidth + 2; n++) addCopy();
      if (calm) return;
      var pos = 0, last = 0, paused = false, visible = true, raf = 0, timer = 0, speed = 32; // pixels par seconde
      function half() { return period > 0 ? period : el.scrollWidth / 2; }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        if (!last) { last = t; return; }
        var dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (paused || !visible || document.hidden) return;
        pos += speed * dt;
        if (pos >= half()) pos -= half();
        el.scrollLeft = pos;
      }
      function hold() { paused = true; clearTimeout(timer); }
      function release() {
        clearTimeout(timer);
        timer = setTimeout(function () {
          pos = el.scrollLeft % half();
          last = 0; paused = false;
        }, 2500);
      }
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hold(); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') release(); });
      el.addEventListener('touchstart', hold, { passive: true });
      el.addEventListener('touchend', release, { passive: true });
      el.addEventListener('wheel', function () { hold(); release(); }, { passive: true });
      el.addEventListener('focusin', hold);
      el.addEventListener('focusout', release);
      var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null;
      if (io) io.observe(el);
      raf = requestAnimationFrame(frame);
      autoRails.push({ stop: function () { cancelAnimationFrame(raf); clearTimeout(timer); if (io) io.disconnect(); } });
    });
  }

  var catState = { cat: 'all', q: '' };
  function renderCatalogue(cat) {
    catState.cat = cat && CAT_BY_KEY[cat] ? cat : 'all';
    var c = CAT_BY_KEY[catState.cat];
    var title = c ? c.label : 'Tous les livres';
    var intro = c && c.sub ? c.sub + '.' : 'Paiement à la livraison. Livraison en 24 h à Abidjan.';
    var chips = '<button class="chip" type="button" data-cat="all">Tous</button>' +
      CATS.filter(function (k) { return inCat(k.key).length; }).map(function (k) {
        return '<button class="chip" type="button" data-cat="' + k.key + '">' + esc(k.label) + ' (' + inCat(k.key).length + ')</button>';
      }).join('');
    view.innerHTML =
      '<div class="wrap">' +
        '<nav class="crumbs" aria-label="Tu es ici"><a href="/" data-nav="home">Accueil</a><span class="crumbs-sep" aria-hidden="true">›</span><span id="crumbCur" aria-current="page">' + esc(title) + '</span></nav>' +
        '<div class="cat-head"><h1 id="catTitle">' + esc(title) + '</h1><p id="catIntro">' + esc(intro) + '</p></div>' +
        '<div class="filters"><label class="search">' + ICON.search + '<span class="sr-only">Rechercher</span><input id="q" type="search" placeholder="Titre ou auteur" autocomplete="off" value="' + esc(catState.q) + '"></label>' +
        '<div class="chips" role="group" aria-label="Catégories">' + chips + '</div></div>' +
        '<p class="count-line" id="countLine" aria-live="polite"></p>' +
        '<div class="grid" id="grid"></div>' +
      '</div>';
    var q = document.getElementById('q');
    q.addEventListener('input', function () { catState.q = q.value; drawGrid(); });
    view.querySelectorAll('.chip').forEach(function (ch) {
      ch.addEventListener('click', function () {
        var k = ch.getAttribute('data-cat');
        history.replaceState({}, '', k === 'all' ? '/?vue=livres' : '/?cat=' + k);
        catState.cat = k;
        var cc = CAT_BY_KEY[k];
        document.getElementById('catTitle').textContent = cc ? cc.label : 'Tous les livres';
        document.getElementById('crumbCur').textContent = cc ? cc.label : 'Tous les livres';
        document.getElementById('catIntro').textContent = cc && cc.sub ? cc.sub + '.' : 'Paiement à la livraison. Livraison en 24 h à Abidjan.';
        drawGrid();
      });
    });
    drawGrid();
    document.title = title + " | Dilam B'";
  }
  function drawGrid() {
    var list = catState.cat === 'all' ? BOOKS.slice() : inCat(catState.cat);
    if (catState.q.trim()) {
      var q = norm(catState.q.trim());
      list = list.filter(function (b) { return norm(b.title).indexOf(q) > -1 || norm(b.author).indexOf(q) > -1; });
    }
    list = ranked(list);
    view.querySelectorAll('.chip').forEach(function (ch) { ch.setAttribute('aria-pressed', ch.getAttribute('data-cat') === catState.cat ? 'true' : 'false'); });
    document.getElementById('countLine').textContent = list.length + (list.length > 1 ? ' livres' : ' livre');
    document.getElementById('grid').innerHTML = list.length ? list.map(card).join('') :
      '<p class="empty">Aucun livre ne correspond à « ' + esc(catState.q) + ' ». Essaie un autre mot, ou demande-nous sur WhatsApp : on peut souvent le trouver.</p>';
  }

  var buyObserver = null;
  function renderBook(b) {
    var cat = CAT_BY_KEY[b.category];
    var related = ranked(inCat(b.category).filter(function (x) { return x !== b && !x.oos; })).slice(0, 8);
    view.innerHTML =
      '<div class="wrap">' +
        '<nav class="crumbs" aria-label="Tu es ici"><a href="/" data-nav="home">Accueil</a><span class="crumbs-sep" aria-hidden="true">›</span><a href="/?cat=' + b.category + '" data-nav="cat">' + esc(cat ? cat.label : 'Catalogue') + '</a></nav>' +
        '<article class="pdp">' +
          '<div class="pdp-cover' + (isCleanVisual(b) ? ' clean' : '') + '">' + (b.image ? '<img ' + picAttrs(b.image, '(min-width: 820px) 360px, 70vw') + ' alt="Couverture : ' + esc(b.title) + '">' : cover(b)) + '</div>' +
          '<div>' +
            '<h1>' + esc(b.title) + '</h1>' +
            '<p class="pdp-author">' + esc(b.category === 'pack' ? 'Pack de deux livres' : b.author) + '</p>' +
            priceHTML(b) +
            (b.oos ? '<p class="oos-note">Ce livre est épuisé pour le moment. Écris-nous pour savoir quand il revient.</p>' : '') +
            '<div class="pdp-actions" id="pdpActions">' +
              (b.oos
                ? '<a class="btn btn-primary btn-block" href="' + esc(waLink("Bonjour, je voudrais savoir quand « " + b.title + " » sera de nouveau disponible.")) + '" target="_blank" rel="noopener">Être prévenu sur WhatsApp</a>'
                : '<button class="btn btn-primary btn-block" type="button" id="orderBtn">Commander ce livre</button>' +
                  '<button class="btn btn-secondary btn-block" type="button" id="addBtn">Ajouter au panier</button>') +
            '</div>' +
            '<ul class="pdp-facts"><li>Paiement à la livraison</li><li>Livré en 24 h à Abidjan</li><li>' + feesLine() + '</li>' + (offerText() ? '<li>' + offerText() + '</li>' : '') + '</ul>' +
            pdpPromo() +
          '</div>' +
        '</article>' +
        (b.desc ? '<section class="pdp-desc"><h2>À propos de ce livre</h2><div class="txt is-clamped" id="descTxt">' + descHTML(b.desc) + '</div>' +
          '<button type="button" class="desc-more" id="descMore" hidden aria-expanded="false" aria-controls="descTxt">Lire la suite</button></section>' : '') +
        (related.length ? '<section class="section"><div class="section-head"><h2>Dans la même catégorie</h2></div><div class="rail">' + related.map(card).join('') + '</div></section>' : '') +
      '</div>';

    document.title = b.title + " | Dilam B'";
    var dt = document.getElementById('descTxt'), dm = document.getElementById('descMore');
    if (dt && dm) {
      if (dt.scrollHeight > dt.clientHeight + 24) {
        dm.hidden = false;
        dm.addEventListener('click', function () {
          var open = dt.classList.toggle('is-clamped') === false;
          dm.setAttribute('aria-expanded', open ? 'true' : 'false');
          dm.textContent = open ? 'Réduire' : 'Lire la suite';
          if (!open) dt.scrollIntoView({ block: 'nearest' });
        });
      } else dt.classList.remove('is-clamped');
    }
    if (!b.oos) {
      document.getElementById('orderBtn').addEventListener('click', function () { openOrder(b); });
      document.getElementById('addBtn').addEventListener('click', function () { addToCart(b); });
      // Barre d'achat fixe quand les boutons sortent de l'écran
      var bar = document.getElementById('buybar');
      document.getElementById('buybarPrice').textContent = money(b.price);
      document.getElementById('buybarBtn').onclick = function () { openOrder(b); };
      if ('IntersectionObserver' in window) {
        buyObserver = new IntersectionObserver(function (en) {
          var show = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
          bar.hidden = !show;
          document.body.classList.toggle('has-buybar', show);
        });
        buyObserver.observe(document.getElementById('pdpActions'));
      }
    }
    stat(b, 'views');
    track('ViewContent', { content_ids: [b.fid], content_name: b.title, content_type: 'product', value: b.price, currency: 'XOF' });
  }

  // ───────────── Navigation ─────────────
  function route(scroll) {
    if (buyObserver) { buyObserver.disconnect(); buyObserver = null; }
    document.getElementById('buybar').hidden = true;
    document.body.classList.remove('has-buybar');
    var p = new URLSearchParams(location.search);
    var slug = p.get('livre');
    var b = slug ? bySlug(slug) : null;
    if (b) renderBook(b);
    else if (p.get('cat') || p.get('vue') === 'livres') renderCatalogue(p.get('cat'));
    else if (p.get('vue') === 'ebooks') renderEbooks();
    else renderHome();
    startAutoRails();
    if (scroll !== false) window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-nav]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    if (a.getAttribute('data-nav') === 'livres') catState.q = '';
    history.pushState({}, '', a.getAttribute('href'));
    route();
    if (a.getAttribute('data-nav') === 'livres' && a.closest('.top')) {
      var q = document.getElementById('q'); if (q) q.focus();
    }
  });
  window.addEventListener('popstate', function () { route(false); });

  // ───────────── Panier ─────────────
  function saveCart() { store('dilam_cart', cart.map(function (i) { return { fid: i.fid, qty: i.qty }; })); }
  function restoreCart() {
    var saved = store('dilam_cart') || [];
    cart = saved.map(function (s) {
      var b = BOOKS.find(function (x) { return x.fid === s.fid; });
      return b && !b.oos ? { fid: b.fid, qty: Math.max(1, Math.min(20, s.qty | 0)) } : null;
    }).filter(Boolean);
  }
  function cartBook(i) { return BOOKS.find(function (b) { return b.fid === i.fid; }); }
  function cartQty() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function cartTotal() { return cart.reduce(function (s, i) { var b = cartBook(i); return s + (b ? b.price * i.qty : 0); }, 0); }
  function updateBadge() {
    var n = cartQty(), el = document.getElementById('cartCount');
    el.textContent = n;
    el.hidden = n === 0;
    document.getElementById('cartBtn').setAttribute('aria-label', n ? 'Ouvrir le panier (' + n + ')' : 'Ouvrir le panier');
  }
  function addToCart(b, silent) {
    if (b.oos) return;
    var it = cart.find(function (i) { return i.fid === b.fid; });
    if (it) it.qty = Math.min(20, it.qty + 1); else cart.push({ fid: b.fid, qty: 1 });
    saveCart(); updateBadge();
    stat(b, 'carts');
    track('AddToCart', { content_ids: [b.fid], content_name: b.title, content_type: 'product', value: b.price, currency: 'XOF' });
    if (!silent) toast('Ajouté au panier : ' + (b.title.length > 32 ? b.title.slice(0, 32) + '…' : b.title));
  }

  var lastFocus = null;
  function openSheet(id) {
    lastFocus = document.activeElement;
    var s = document.getElementById(id);
    s.hidden = false;
    document.body.style.overflow = 'hidden';
    var f = s.querySelector('.sheet-head button');
    if (f) f.focus();
  }
  function closeSheet(id) {
    document.getElementById(id).hidden = true;
    if (document.getElementById('cartSheet').hidden && document.getElementById('orderSheet').hidden) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll('.sheet').forEach(function (s) {
    s.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(s.id); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['orderSheet', 'cartSheet'].forEach(function (id) { if (!document.getElementById(id).hidden) closeSheet(id); });
  });

  // ───────────── Livraison ─────────────
  function applyDelivery(v) {
    var fees = v.fees || {};
    ZONES.forEach(function (z) { var f = parseInt(fees[z.key], 10); if (f >= 0 && f <= 100000) z.fee = f; });
    if (v.offer) {
      OFFER.active = !!v.offer.active;
      var n = parseInt(v.offer.packs, 10); if (n >= 1 && n <= 20) OFFER.packs = n;
      if (Array.isArray(v.offer.zones)) OFFER.zones = v.offer.zones.filter(function (k) { return !!zoneBy(k); });
    }
  }
  function offerZonesLabel() {
    var names = OFFER.zones.map(function (k) { return zoneBy(k).label; });
    if (names.length === ZONES.length) return '';
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0];
  }
  function offerText() {
    if (!OFFER.active || !OFFER.zones.length) return '';
    var where = offerZonesLabel();
    return 'Livraison offerte' + (where ? ' (' + where + ')' : '') + ' dès ' + OFFER.packs + ' packs achetés';
  }
  function feesLine() {
    return 'Livraison ' + money(zoneBy('abidjan').fee) + ' à Abidjan, ' + money(zoneBy('peripherie').fee) + ' en périphérie, ' + money(zoneBy('interieur').fee) + ' à l’intérieur';
  }
  function deliveryFaq() {
    return 'Abidjan\u00a0: ' + money(zoneBy('abidjan').fee) + '. Périphérie (Anyama, Grand-Bassam, Songon, N’Dotré, Bingerville)\u00a0: ' + money(zoneBy('peripherie').fee) +
      '. Intérieur du pays, par expédition\u00a0: ' + money(zoneBy('interieur').fee) + '.' + (offerText() ? ' ' + offerText() + '.' : '');
  }
  function zoneBy(k) { return ZONES.find(function (z) { return z.key === k; }) || null; }
  function packQty(items) {
    return items.reduce(function (s, i) { var b = cartBook(i); return s + (b && b.category === 'pack' ? i.qty : 0); }, 0);
  }
  function packsOk(items) { return OFFER.active && packQty(items) >= OFFER.packs; }
  function isFree(items, zone) { return !!zone && packsOk(items) && OFFER.zones.indexOf(zone.key) > -1; }
  function deliveryFee(items, zone) { return !zone ? null : (isFree(items, zone) ? 0 : zone.fee); }

  function customerFields(prefix) {
    var saved = store('dilam_client') || {};
    var zones = ZONES.map(function (z) {
      return '<label class="zone"><input type="radio" name="' + prefix + 'Zone" value="' + z.key + '"' + (saved.zone === z.key ? ' checked' : '') + '>' +
        '<span class="zone-txt"><span class="zone-name">' + esc(z.label) + '</span><span class="zone-sub">' + esc(z.sub) + '</span></span>' +
        '<span class="zone-fee" data-fee="' + z.fee + '">' + money(z.fee) + '</span></label>';
    }).join('');
    return '<div class="form">' +
      '<fieldset class="zones" id="' + prefix + 'Zones"><legend>Où te livrer ?</legend>' + zones + '</fieldset>' +
      '<div class="field"><label for="' + prefix + 'Name">Ton nom</label><input id="' + prefix + 'Name" autocomplete="name" value="' + esc(saved.name || '') + '"></div>' +
      '<div class="field"><label for="' + prefix + 'Place">Adresse de livraison</label><input id="' + prefix + 'Place" placeholder="Ville ou commune, quartier, repère" autocomplete="street-address" value="' + esc(saved.place || '') + '"></div>' +
      '<div class="field"><label for="' + prefix + 'Phone">Ton numéro</label><input id="' + prefix + 'Phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="07 00 00 00 00" aria-describedby="' + prefix + 'PhoneHelp" value="' + esc(saved.phone || '') + '"><p class="field-help" id="' + prefix + 'PhoneHelp">Le livreur t’appelle sur ce numéro.</p></div>' +
      '</div>';
  }
  // Numéro ivoirien : 10 chiffres commençant par 0 (01, 05, 07, 25, 27…), avec ou sans +225.
  function cleanPhone(v) {
    var d = String(v || '').replace(/[^0-9]/g, '');
    if (d.indexOf('00225') === 0) d = d.slice(5);
    else if (d.indexOf('225') === 0 && d.length === 13) d = d.slice(3);
    if (!/^0[0-9]{9}$/.test(d)) return '';
    return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  function selectedZone(prefix) {
    var r = document.querySelector('input[name="' + prefix + 'Zone"]:checked');
    return r ? zoneBy(r.value) : null;
  }
  function readCustomer(prefix) {
    var name = document.getElementById(prefix + 'Name'), place = document.getElementById(prefix + 'Place'), phone = document.getElementById(prefix + 'Phone');
    var zone = selectedZone(prefix), zbox = document.getElementById(prefix + 'Zones');
    var ok = true;
    var zerr = zbox.querySelector('.err');
    if (!zone) {
      if (!zerr) zbox.insertAdjacentHTML('beforeend', '<p class="err">Choisis ta zone de livraison.</p>');
      zbox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      ok = false;
    } else if (zerr) zerr.remove();
    var tel = cleanPhone(phone.value);
    var checks = [
      [name, !name.value.trim(), 'Indique ton nom.'],
      [place, !place.value.trim(), 'Indique où te livrer.'],
      [phone, !tel, phone.value.trim() ? 'Ce numéro semble incomplet. Il faut 10 chiffres, par exemple 07 00 00 00 00.' : 'Indique ton numéro pour que le livreur puisse t\'appeler.']
    ];
    checks.forEach(function (c) {
      var el = c[0], bad = c[1];
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var next = el.nextElementSibling;
      if (next && next.classList.contains('err')) next.remove();
      if (bad) el.insertAdjacentHTML('afterend', '<p class="err">' + c[2] + '</p>');
      if (bad && ok) { el.focus(); ok = false; }
    });
    if (!ok) return null;
    var c = { name: name.value.trim(), place: place.value.trim(), phone: tel, zone: zone.key };
    store('dilam_client', c);
    c.zoneObj = zone;
    return c;
  }
  // Récapitulatif chiffré (livres + livraison) qui se met à jour quand on change de zone.
  function summaryHTML(prefix, items, booksTotal) {
    var zone = selectedZone(prefix) || zoneBy((store('dilam_client') || {}).zone);
    var fee = deliveryFee(items, zone);
    var free = isFree(items, zone);
    var feeTxt = free ? 'Offerte' : (zone ? money(fee) : 'Selon ta zone');
    var total = zone ? booksTotal + fee : null;
    return '<div class="sum">' +
      '<div class="sum-row"><span>Livres</span><span>' + money(booksTotal) + '</span></div>' +
      '<div class="sum-row"><span>Livraison' + (zone && !free ? ' (' + esc(zone.label) + ')' : '') + '</span><span' + (free ? ' class="free"' : '') + '>' + feeTxt + '</span></div>' +
      '<div class="sum-row sum-total"><span>Total à payer à la livraison</span><strong>' + (total != null ? money(total) : '—') + '</strong></div>' +
      '<p class="sum-pay"><span>À la livraison :</span><span class="pay-chip">Espèces</span><span class="pay-chip"><img src="/assets/pay/wave.png" alt="" width="16" height="16">Wave</span></p>' +
      '</div>';
  }
  function wireSummary(prefix, items, booksTotal) {
    var box = document.getElementById(prefix + 'Sum');
    document.querySelectorAll('input[name="' + prefix + 'Zone"]').forEach(function (r) {
      r.addEventListener('change', function () {
        box.innerHTML = summaryHTML(prefix, items, booksTotal);
        var err = document.querySelector('#' + prefix + 'Zones .err'); if (err) err.remove();
      });
    });
    if (packsOk(items)) {
      OFFER.zones.forEach(function (k) {
        var f = document.querySelector('#' + prefix + 'Zones input[value="' + k + '"]');
        f = f && f.closest('.zone').querySelector('.zone-fee');
        if (f) f.innerHTML = '<s>' + f.textContent + '</s> Offerte';
      });
    }
  }

  function renderCart() {
    var body = document.getElementById('cartBody');
    if (!cart.length) {
      body.innerHTML = '<div class="empty-cart"><p>Ton panier est vide.</p><a class="btn btn-primary" href="/?vue=livres" data-nav="livres" id="emptyGo">Voir les livres</a></div>';
      document.getElementById('emptyGo').addEventListener('click', function () { closeSheet('cartSheet'); });
      return;
    }
    var lines = cart.map(function (i) {
      var b = cartBook(i);
      if (!b) return '';
      return '<div class="line">' + cover(b, { eager: true }) +
        '<div><p class="line-title">' + esc(b.title) + '</p><p class="line-price">' + money(b.price) + '</p></div>' +
        '<div class="qty"><button type="button" data-dec="' + esc(b.fid) + '" aria-label="Retirer un exemplaire">−</button><span>' + i.qty + '</span><button type="button" data-inc="' + esc(b.fid) + '" aria-label="Ajouter un exemplaire">+</button></div>' +
        '</div>';
    }).join('');
    var packs = packQty(cart), offer = '';
    var where = offerZonesLabel() ? ' à ' + offerZonesLabel() : '';
    if (OFFER.active && OFFER.zones.length) {
      if (packs >= OFFER.packs) {
        offer = '<div class="offer done"><strong>Livraison offerte' + where + '</strong><p>Ta commande compte ' + packs + ' packs.</p></div>';
      } else {
        var missing = OFFER.packs - packs;
        var ids = cart.map(function (i) { return i.fid; });
        var sug = ranked(BOOKS.filter(function (b) { return ids.indexOf(b.fid) === -1 && !b.oos && b.category === 'pack'; })).slice(0, 6);
        offer = '<div class="offer"><strong>' + (packs ? 'Encore ' + missing + ' pack' + (missing > 1 ? 's' : '') + ' et la livraison' + where + ' est offerte' : 'Livraison offerte' + where + ' dès ' + OFFER.packs + ' packs') + '</strong>' +
          '<p>Chaque pack réunit deux livres à prix réduit.</p>' +
          '<div class="rail">' + sug.map(function (b) {
            return '<button class="mini" type="button" data-add="' + esc(b.fid) + '">' + cover(b, { eager: true }) + '<span class="card-title">' + esc(b.title) + '</span><span class="add">Ajouter, ' + money(b.price) + '</span></button>';
          }).join('') + '</div></div>';
      }
    }
    var booksTotal = cartTotal();
    body.innerHTML = lines + offer +
      customerFields('c') +
      '<div id="cSum">' + summaryHTML('c', cart, booksTotal) + '</div>' +
      '<div class="form"><button class="btn btn-primary btn-block" type="button" id="sendCart">' + ICON.wa + 'Envoyer ma commande sur WhatsApp</button>' +
      '<p class="form-note">WhatsApp s\'ouvre avec ta commande déjà écrite. Il te reste à appuyer sur Envoyer.</p></div>';
    wireSummary('c', cart, booksTotal);
    document.getElementById('sendCart').addEventListener('click', sendCart);
  }
  document.getElementById('cartBody').addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    var fid = t.getAttribute('data-inc') || t.getAttribute('data-dec') || t.getAttribute('data-add');
    if (!fid) return;
    var b = BOOKS.find(function (x) { return x.fid === fid; });
    if (t.hasAttribute('data-add') && b) { addToCart(b, true); renderCart(); return; }
    var it = cart.find(function (i) { return i.fid === fid; });
    if (!it) return;
    it.qty += t.hasAttribute('data-inc') ? 1 : -1;
    if (it.qty > 20) it.qty = 20;
    if (it.qty <= 0) cart = cart.filter(function (i) { return i !== it; });
    saveCart(); updateBadge(); renderCart();
  });
  document.getElementById('cartBtn').addEventListener('click', function () { renderCart(); openSheet('cartSheet'); });

  function deliveryLine(items, zone) {
    return isFree(items, zone) ? '🎁 Livraison offerte (' + OFFER.packs + ' packs) — ' + zone.label
      : '🚚 Livraison ' + zone.label + ' : ' + zone.fee.toLocaleString('fr-FR') + ' FCFA';
  }
  function sendCart() {
    var c = readCustomer('c');
    if (!c || !cart.length) return;
    var qty = cartQty(), booksTotal = cartTotal();
    var fee = deliveryFee(cart, c.zoneObj), total = booksTotal + fee;
    var articles = cart.map(function (i) { var b = cartBook(i); return '• ' + b.title + ' × ' + i.qty + ' — ' + (b.price * i.qty).toLocaleString('fr-FR') + ' FCFA'; }).join('\n');
    articles += '\n' + deliveryLine(cart, c.zoneObj);
    var tpl = CONFIG.waMessage || "🛒 *Nouvelle commande*\n\n*Nom :* {nom}\n*Ville :* {ville}\n*Téléphone :* {telephone}\n\n{articles}\n\n*Total : {total} FCFA*\n\n---\nBonjour, je souhaite confirmer ma commande. Merci !";
    var msg = tpl.replace('{nom}', c.name).replace('{ville}', c.place + ' (' + c.zoneObj.label + ')').replace('{telephone}', c.phone).replace('{articles}', articles).replace('{total}', total.toLocaleString('fr-FR'));
    window.open(waLink(msg), '_blank', 'noopener');
    var ids = cart.map(function (i) { return i.fid; });
    cart.forEach(function (i) { var b = cartBook(i); if (b) stat(b, 'orders'); });
    track('InitiateCheckout', { content_ids: ids, value: booksTotal, currency: 'XOF', num_items: qty });
    track('Lead', { content_ids: ids, value: booksTotal, currency: 'XOF', num_items: qty });
    cart = []; saveCart(); updateBadge();
    document.getElementById('cartBody').innerHTML = doneBox();
  }
  function doneBox() {
    return '<div class="done-box"><h3>Ta commande est prête dans WhatsApp</h3><p>Appuie sur Envoyer dans WhatsApp. On te répond pour confirmer la livraison.</p>' +
      '<p>WhatsApp ne s\'est pas ouvert ? <a href="' + esc(waLink('Bonjour Dilam B\', je souhaite passer une commande.')) + '" target="_blank" rel="noopener">Ouvre-le ici</a>.</p>' +
      '<button class="btn btn-secondary" type="button" data-close>Continuer mes achats</button></div>';
  }

  function openOrder(b) {
    var body = document.getElementById('orderBody');
    var items = [{ fid: b.fid, qty: 1 }];
    body.innerHTML = '<div class="order-book">' + cover(b, { eager: true }) + '<div><p class="line-title">' + esc(b.title) + '</p><p class="line-price">' + money(b.price) + '</p></div></div>' +
      customerFields('o') +
      '<div id="oSum">' + summaryHTML('o', items, b.price) + '</div>' +
      '<div class="form"><button class="btn btn-primary btn-block" type="button" id="sendOrder">' + ICON.wa + 'Envoyer ma commande sur WhatsApp</button>' +
      '<p class="form-note">WhatsApp s\'ouvre avec ta commande déjà écrite. Il te reste à appuyer sur Envoyer.</p></div>';
    wireSummary('o', items, b.price);
    document.getElementById('sendOrder').addEventListener('click', function () {
      var c = readCustomer('o');
      if (!c) return;
      var fee = deliveryFee(items, c.zoneObj);
      var NL = '\n', SEP = '━━━━━━━━━━━━━━';
      var msg = "🛒 *Commande directe – Dilam B'*" + NL + NL + SEP + NL +
        NL + '📖 *Livre :* ' + b.title +
        (b.category === 'pack' ? '' : NL + '✍ *Auteur :* ' + b.author) +
        NL + '💰 *Prix :* ' + b.price.toLocaleString('fr-FR') + ' FCFA' +
        NL + '🚚 *Livraison (' + c.zoneObj.label + ') :* ' + fee.toLocaleString('fr-FR') + ' FCFA' +
        NL + '💵 *Total à payer :* ' + (b.price + fee).toLocaleString('fr-FR') + ' FCFA' +
        NL + NL + SEP + NL +
        NL + '👋 Bonjour, je souhaite commander ce livre.' +
        NL + NL + '📍 *Nom :* ' + c.name +
        NL + '🏠 *Adresse :* ' + c.place +
        NL + '📞 *Téléphone :* ' + c.phone +
        NL + NL + '🔗 ' + location.origin + bookUrl(b);
      window.open(waLink(msg), '_blank', 'noopener');
      stat(b, 'orders');
      track('InitiateCheckout', { content_ids: [b.fid], content_name: b.title, value: b.price, currency: 'XOF', num_items: 1 });
      track('Lead', { content_ids: [b.fid], value: b.price, currency: 'XOF', num_items: 1 });
      body.innerHTML = doneBox();
    });
    openSheet('orderSheet');
  }

  // ───────────── Accès admin caché : appui long sur le nom de la boutique ─────────────
  (function () {
    var brand = document.querySelector('.brand'), timer = null, fired = false;
    function start() { fired = false; timer = setTimeout(function () { fired = true; location.href = '/admin'; }, 800); }
    function stop() { clearTimeout(timer); }
    brand.addEventListener('touchstart', start, { passive: true });
    brand.addEventListener('touchend', stop);
    brand.addEventListener('touchmove', stop, { passive: true });
    brand.addEventListener('mousedown', start);
    brand.addEventListener('mouseup', stop);
    brand.addEventListener('mouseleave', stop);
    brand.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    brand.addEventListener('click', function (e) { if (fired) { e.preventDefault(); e.stopPropagation(); } }, true);
    document.addEventListener('keydown', function (e) { if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) { e.preventDefault(); location.href = '/admin'; } });
  })();

  // ───────────── Démarrage ─────────────
  document.getElementById('year').textContent = new Date().getFullYear();
  load().then(function () {
    var contact = waLink("Bonjour Dilam B', je viens du site.");
    document.getElementById('waTop').href = contact;
    document.getElementById('waFoot').href = contact;
    var fe = document.getElementById('footEbooks');
    if (fe) fe.innerHTML = '<li><a href="/?vue=ebooks" data-nav="ebooks">Tous les guides</a></li>' +
      EBOOKS.map(function (e) { return '<li><a href="/ebook/' + encodeURIComponent(e.slug || e._id) + '">' + esc(e.title) + '</a></li>'; }).join('');
    restoreCart();
    updateBadge();
    initPixel();
    track('PageView', {});
    route(false);
  }).catch(function () {
    view.innerHTML = '<div class="loading">Les livres n\'ont pas pu se charger. Vérifie ta connexion puis <a href="/">recharge la page</a>.</div>';
  });
})();
