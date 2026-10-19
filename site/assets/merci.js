/* Page « merci » : attend la confirmation du paiement Paystack, puis propose le téléchargement. */
(function () {
  'use strict';
  var box = document.getElementById('merci');
  var q = new URLSearchParams(location.search);
  var ref = q.get('reference') || q.get('trxref') || '';
  var WA = '2250546494484';
  var tries = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return (parseInt(n, 10) || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA'; }
  function wa(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }

  function purchasePixel(d) {
    // Même identifiant que l'événement envoyé par le serveur : Meta ne compte l'achat qu'une fois.
    try {
      var key = 'purchase_' + ref;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) {}
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', '1671688320192246');
    window.fbq('track', 'Purchase', { value: d.amount, currency: 'XOF', content_ids: [d.slug], content_type: 'product', content_name: d.title }, { eventID: ref });
  }

  function paid(d) {
    box.innerHTML =
      '<h1>Merci, ton paiement est confirmé.</h1>' +
      '<p>' + esc(d.title) + ', ' + money(d.amount) + '.</p>' +
      (d.mailed
        ? '<p>Ton lien de téléchargement vient d’être envoyé à <strong>' + esc(d.email) + '</strong>. Regarde aussi dans les courriers indésirables.</p>'
        : '<p>Ton lien de téléchargement est juste en dessous. Garde cette page ouverte le temps d’enregistrer tes fichiers.</p>') +
      '<a class="btn btn-primary" href="' + esc(d.download) + '">Télécharger mes fichiers</a>' +
      '<p class="dl-tip">Le lien est valable 24 heures et chaque fichier se télécharge une seule fois.</p>';
    purchasePixel(d);
  }
  function waiting() {
    box.innerHTML =
      '<h1>Paiement en cours de confirmation</h1>' +
      '<p>Ton opérateur n’a pas encore confirmé le paiement. Si tu as bien validé sur ton téléphone, tu recevras ton lien par e-mail dès que c’est fait.</p>' +
      '<a class="btn btn-primary" href="' + esc(wa('Bonjour, j’ai payé mais je n’ai pas encore reçu mes fichiers. Référence : ' + ref)) + '">Écrire sur WhatsApp</a>';
  }
  function failed(msg) {
    box.innerHTML = '<h1>' + esc(msg) + '</h1>' +
      '<p>Si tu as été débité, écris-moi sur WhatsApp avec cette référence : <strong>' + esc(ref || 'inconnue') + '</strong>.</p>' +
      '<a class="btn btn-primary" href="' + esc(wa('Bonjour, j’ai un souci avec mon paiement. Référence : ' + ref)) + '">Écrire sur WhatsApp</a>';
  }

  function check() {
    tries++;
    fetch('/api/order?ref=' + encodeURIComponent(ref), { headers: { 'X-Dilam': '1' }, credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.status === 'paid') return paid(res.d);
        if (res.ok && res.d.status === 'mismatch') return failed('Ce paiement doit être vérifié.');
        if (!res.ok && res.d && res.d.error === 'not_found') return failed('Commande introuvable.');
        if (tries < 12) setTimeout(check, tries < 4 ? 2000 : 4000);
        else waiting();
      })
      .catch(function () { if (tries < 12) setTimeout(check, 4000); else waiting(); });
  }

  if (!/^LDL-[A-Z0-9-]{6,40}$/.test(ref)) failed('Ce lien de confirmation n’est pas valide.');
  else check();
})();
