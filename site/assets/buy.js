/* Paiement sur les pages de vente déposées en HTML.
   Tout lien vers « #acheter » (ou tout élément avec l'attribut data-acheter) ouvre la fenêtre d'achat. */
(function () {
  'use strict';
  var E = null;
  try { E = JSON.parse(document.getElementById('ebdata').textContent); } catch (e) { return; }
  var WA = '2250546494484', PIXEL = '1671688320192246';
  var sheet = document.getElementById('dlbSheet'), body = document.getElementById('dlbBody');
  var lastFocus = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return (parseInt(n, 10) || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA'; }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function api(path, opt) { opt = opt || {}; opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {}); opt.credentials = 'same-origin'; return fetch('/api' + path, opt); }
  function wa(t) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t); }

  // Mesure Meta (même fonctionnement que le reste du site)
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL);
  function track(name, data) {
    var id = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { window.fbq('track', name, data || {}, { eventID: id }); } catch (e) {}
    api('/capi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: name, event_id: id, event_source_url: location.href, custom_data: data || {}, fbp: cookie('_fbp'), fbc: cookie('_fbc') }) }).catch(function () {});
  }
  var product = { content_ids: [E.slug], content_type: 'product', content_name: E.title, value: E.price, currency: 'XOF' };
  track('PageView', {});
  track('ViewContent', product);

  function open() {
    lastFocus = document.activeElement;
    var saved = '';
    try { saved = localStorage.getItem('eb_email') || ''; } catch (e) {}
    body.innerHTML =
      '<p class="dlb-sum"><strong>' + esc(E.title) + '</strong><br>' + money(E.price) + '</p>' +
      '<form id="dlbForm" novalidate><label class="dlb-label" for="dlbEmail">Ton adresse e-mail</label>' +
      '<input class="dlb-input" id="dlbEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="' + esc(saved) + '">' +
      '<p class="dlb-help" id="dlbHelp">Ton lien de téléchargement sera envoyé à cette adresse. Vérifie-la bien.</p>' +
      '<button class="dlb-btn" type="submit" id="dlbGo">Payer ' + money(E.price) + '</button>' +
      '<p class="dlb-note">Wave, Orange Money, MTN ou carte bancaire. Paiement sécurisé par Paystack.</p></form><div id="dlbMsg"></div>';
    sheet.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { var i = document.getElementById('dlbEmail'); if (i) i.focus(); }, 60);
    document.getElementById('dlbForm').addEventListener('submit', submit);
    track('InitiateCheckout', product);
  }
  function close() {
    sheet.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function submit(ev) {
    ev.preventDefault();
    var input = document.getElementById('dlbEmail'), help = document.getElementById('dlbHelp'), btn = document.getElementById('dlbGo');
    var email = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      input.setAttribute('aria-invalid', 'true');
      help.textContent = 'Cette adresse ne semble pas complète. Exemple : prenom@gmail.com';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    try { localStorage.setItem('eb_email', email); } catch (e) {}
    btn.disabled = true; btn.textContent = 'Un instant…';
    function fail(msg) { btn.disabled = false; btn.textContent = 'Payer ' + money(E.price); help.textContent = msg; }
    api('/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: E.slug, email: email, fbp: cookie('_fbp'), fbc: cookie('_fbc') }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.url) { location.href = res.d.url; return; }
        if (res.status === 429) return fail('Trop de tentatives. Réessaie dans quelques minutes.');
        if (res.status === 400) return fail('Vérifie ton adresse e-mail puis réessaie.');
        fail('Le paiement n’a pas pu démarrer. Réessaie dans un instant, ou commande sur WhatsApp.');
        document.getElementById('dlbMsg').innerHTML = '<a class="dlb-btn alt" href="' + esc(wa('Bonjour, je veux acheter « ' + E.title + ' ». Mon adresse e-mail : ' + email)) + '" target="_blank" rel="noopener">Commander sur WhatsApp</a>';
      })
      .catch(function () { fail('Connexion impossible. Vérifie ton réseau puis réessaie.'); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('a[href$="#acheter"], [data-acheter]');
    if (t) { e.preventDefault(); open(); return; }
    if (e.target.closest('[data-dlb-close]')) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
  if (location.hash === '#acheter') open();
})();
