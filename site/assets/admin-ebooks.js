/* Admin : dépôt des PDF des ebooks et suivi des commandes payées en ligne. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {});
    opt.credentials = 'same-origin';
    return fetch('/api' + path, opt);
  }
  function ko(r) { return r.json().catch(function () { return {}; }); }
  function size(n) { return n ? (n / 1024 / 1024).toFixed(2).replace('.', ',') + ' Mo' : ''; }
  function date(t) { return t ? new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  var STATUS = { pending: 'En attente', paid: 'Payée', mismatch: 'À vérifier' };

  api('/auth/me').then(ko).then(function (me) {
    if (!me.admin) {
      app.innerHTML = '<h1>Ebooks</h1><p style="margin-top:12px">Connecte-toi d’abord à <a href="/admin">l’administration</a>, puis reviens sur cette page.</p>';
      return;
    }
    Promise.all([api('/db/ebooks').then(ko), api('/admin/orders').then(ko)]).then(function (res) {
      var ebooks = res[0] || [], orders = res[1] || [];
      app.innerHTML = '<p><a href="/admin">Retour à l’administration</a></p><h1 style="margin-top:10px">Ebooks</h1>' +
        '<p class="muted" style="margin-top:6px">Dépose ici les PDF livrés aux acheteurs. Ils ne sont jamais publics : seul un acheteur avec son lien personnel peut les télécharger.</p>' +
        ebooks.map(function (e) {
          var slug = e.slug || e._id;
          return '<h2>' + esc(e.title) + '</h2><div class="card" data-slug="' + esc(slug) + '">' +
            ((e.files && e.files.items) || []).map(function (f, i) {
              return '<div class="row" data-i="' + i + '"><div><strong>' + esc(f.name) + '</strong><small class="st">Vérification…</small></div>' +
                '<label class="up">Choisir le PDF<input type="file" accept="application/pdf" data-slug="' + esc(slug) + '" data-i="' + i + '"></label></div>';
            }).join('') + '</div>';
        }).join('') +
        '<h2>Commandes en ligne</h2><div class="card scroll">' +
        (orders.length ? '<table><thead><tr><th>Date</th><th>Acheteur</th><th>Montant</th><th>Statut</th><th>E-mail</th></tr></thead><tbody>' +
          orders.map(function (o) {
            return '<tr><td>' + esc(date(o.paid_at || o.created_at)) + '</td><td>' + esc(o.email) + '<br><span class="muted">' + esc(o.reference) + '</span></td><td>' + esc(o.amount) + ' F</td><td>' + esc(STATUS[o.status] || o.status) + '</td><td>' + (o.status === 'paid' ? (o.mailed ? '<span class="ok">Envoyé</span>' : '<span class="ko">Non envoyé</span>') : '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p class="muted">Aucune commande pour le moment.</p>') + '</div>';
      ebooks.forEach(function (e) { refresh(e.slug || e._id); });
    });
  });

  function refresh(slug) {
    api('/admin/pdf?slug=' + encodeURIComponent(slug)).then(ko).then(function (list) {
      var by = {};
      (list || []).forEach(function (k) { var m = k.key.match(/\/(\d+)\.pdf$/); if (m) by[m[1]] = k; });
      document.querySelectorAll('[data-slug="' + slug + '"] .row').forEach(function (row) {
        var k = by[row.getAttribute('data-i')];
        row.querySelector('.st').innerHTML = k ? '<span class="ok">Déposé</span> ' + esc(k.name || '') + ' ' + esc(size(k.size)) : '<span class="ko">Pas encore déposé</span>';
      });
    });
  }

  document.addEventListener('change', function (ev) {
    var inp = ev.target;
    if (!inp.matches('input[type=file][data-slug]') || !inp.files[0]) return;
    var file = inp.files[0], slug = inp.getAttribute('data-slug'), i = inp.getAttribute('data-i');
    var st = inp.closest('.row').querySelector('.st');
    if (file.type && file.type !== 'application/pdf') { st.innerHTML = '<span class="ko">Ce fichier n’est pas un PDF.</span>'; return; }
    st.textContent = 'Envoi en cours…';
    api('/admin/pdf?slug=' + encodeURIComponent(slug) + '&i=' + i + '&name=' + encodeURIComponent(file.name), {
      method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file
    }).then(function (r) {
      if (r.ok) refresh(slug);
      else ko(r).then(function (d) { st.innerHTML = '<span class="ko">Échec de l’envoi (' + esc(d.error || r.status) + ').</span>'; });
    }).catch(function () { st.innerHTML = '<span class="ko">Échec de l’envoi. Vérifie ta connexion.</span>'; });
    inp.value = '';
  });
})();
