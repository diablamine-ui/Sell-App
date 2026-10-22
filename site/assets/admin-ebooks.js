/* Admin : création et gestion des ebooks (fiche, couverture, PDF, page de vente HTML) et suivi des commandes. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var EBOOKS = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opt) { opt = opt || {}; opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {}); opt.credentials = 'same-origin'; return fetch('/api' + path, opt); }
  function jsonOf(r) { return r.json().catch(function () { return {}; }); }
  function size(n) { return n ? (n / 1024 / 1024).toFixed(2).replace('.', ',') + ' Mo' : ''; }
  function date(t) { return t ? new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  function slugify(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  var STATUS = { pending: 'En attente', paid: 'Payée', mismatch: 'À vérifier' };

  var GUIDE = [
    'Consignes pour la page de vente (à donner à l’outil qui crée la page) :',
    '1. Un seul fichier HTML complet, pensé d’abord pour le téléphone.',
    '2. Tout le style dans une balise <style> du fichier. Polices Google Fonts autorisées. Pas de Tailwind ni de bibliothèque chargée depuis un autre site.',
    '3. Pas de JavaScript : il est retiré à l’affichage. Pour une FAQ dépliable, utiliser <details><summary>Question</summary><p>Réponse</p></details>.',
    '4. Chaque bouton d’achat est un lien vers #acheter : <a href="#acheter">Je veux le pack</a>.',
    '5. Écrire {{prix}} partout où le prix doit s’afficher (il sera remplacé par le vrai prix, par exemple « 4 000 FCFA »).',
    '6. Images : liens https complets, ou l’adresse copiée depuis « Images et vidéos de la page ». La boutique ajoute elle-même le lien de retour, les liens légaux et la fenêtre de paiement.'
  ].join('\n');

  api('/auth/me').then(jsonOf).then(function (me) {
    if (!me.admin) {
      app.innerHTML = '<h1>Ebooks</h1><p style="margin-top:12px">Connecte-toi d’abord à <a href="/admin">l’administration</a>, puis reviens sur cette page.</p>';
      return;
    }
    load();
  });

  function load() {
    Promise.all([api('/db/ebooks').then(jsonOf), api('/admin/orders').then(jsonOf), api('/db/shop_config/sell_promo').then(function (r) { return r.ok ? r.json() : {}; }), api('/admin/leads').then(function (r) { return r.ok ? r.json() : []; })]).then(function (res) {
      EBOOKS = (res[0] || []).filter(function (e) { return e && e._id; });
      var orders = res[1] || [];
      var promo = (res[2] && res[2].value) || {};
      var leads = res[3] || [];
      app.innerHTML = '<p><a href="/admin">Retour à l’administration</a></p><h1 style="margin-top:10px">Ebooks</h1>' +
        '<p class="muted" style="margin-top:6px">Crée et gère tes ebooks. Les PDF ne sont jamais publics : seul un acheteur avec son lien personnel peut les télécharger, avec son e-mail en filigrane.</p>' +
        '<details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:600;color:#fff">Consignes pour créer une page de vente en HTML</summary>' +
        '<pre class="guide" id="guide">' + esc(GUIDE) + '</pre><button class="mini-b" type="button" id="copyGuide">Copier les consignes</button></details>' +
        '<div class="card" id="promo"></div>' +
        '<div id="list"></div>' +
        '<button class="big-b" type="button" id="newBook">+ Nouvel ebook</button>' +
        '<h2>Commandes en ligne</h2><div class="card scroll">' +
        (orders.length ? '<table><thead><tr><th>Date</th><th>Acheteur</th><th>Ebook</th><th>Montant</th><th>Statut</th></tr></thead><tbody>' +
          orders.map(function (o) {
            return '<tr><td>' + esc(date(o.paid_at || o.created_at)) + '</td><td>' + esc(o.email) + '<br><span class="muted">' + esc(o.reference) + '</span></td><td>' + esc(o.slug) + '</td><td>' + esc(o.amount) + ' F</td><td>' + esc(STATUS[o.status] || o.status) +
              (o.status === 'paid' ? '<br>' + (o.mailed ? '<span class="ok">E-mail envoyé</span>' : '<span class="ko">E-mail non envoyé</span>') : '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p class="muted">Aucune commande pour le moment.</p>') + '</div>' +
        leadsCard(leads);
      document.getElementById('copyGuide').onclick = function () {
        navigator.clipboard && navigator.clipboard.writeText(GUIDE).then(function () { document.getElementById('copyGuide').textContent = 'Copié'; });
      };
      var csv = document.getElementById('leadsCsv');
      if (csv) csv.onclick = function () { exportLeads(leads); };
      document.getElementById('newBook').onclick = function () { addCard(null); this.hidden = true; };
      promoCard(document.getElementById('promo'), promo);
      EBOOKS.forEach(function (e) { addCard(e); });
    });
  }

  // Test d'alignement : inscrits, profils, et qui a acheté le livre ensuite.
  var PROFIL = { mental: 'Mental', coeur: 'Cœur', corps: 'Corps', mixte: 'Mixte', aligne: 'Aligné' };
  var ETAPE = ['Résultat envoyé', 'E-mail 2 envoyé', 'Série terminée'];
  function leadsCard(leads) {
    var counts = {}, bought = 0;
    leads.forEach(function (l) { counts[l.profile] = (counts[l.profile] || 0) + 1; if (l.bought) bought++; });
    var resume = Object.keys(PROFIL).filter(function (k) { return counts[k]; }).map(function (k) { return PROFIL[k] + ' : ' + counts[k]; }).join(', ');
    return '<h2>Test d’alignement</h2><div class="card scroll">' +
      '<p class="muted">Lien à partager : <strong>dilamboutique.com/alignement</strong>. Ajoute « ?depuis=tiktok » ou « ?depuis=facebook » pour savoir d’où viennent les inscrits.</p>' +
      (leads.length
        ? '<p style="margin-top:10px"><strong>' + leads.length + ' inscrit' + (leads.length > 1 ? 's' : '') + '</strong>, dont ' + bought + ' acheteur' + (bought > 1 ? 's' : '') + ' du livre.' + (resume ? ' Profils : ' + esc(resume) + '.' : '') + '</p>' +
          '<button class="mini-b" type="button" id="leadsCsv" style="margin-top:10px">Télécharger la liste (CSV)</button>' +
          '<table style="margin-top:12px"><thead><tr><th>Date</th><th>Inscrit</th><th>Profil</th><th>Suivi</th></tr></thead><tbody>' +
          leads.map(function (l) {
            var wa = (l.whatsapp || '').replace(/[^\d]/g, '');
            if (wa && wa.length <= 10) wa = '225' + wa;
            return '<tr><td>' + esc(date(l.created_at)) + '</td><td>' + esc(l.prenom) + '<br><span class="muted">' + esc(l.email) + '</span>' +
              (wa ? '<br><a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp ' + esc(l.whatsapp) + '</a>' : '') +
              (l.source ? '<br><span class="muted">Venu de : ' + esc(l.source) + '</span>' : '') + '</td>' +
              '<td>' + esc(PROFIL[l.profile] || l.profile) + '</td>' +
              '<td>' + (l.bought ? '<span class="ok">A acheté le livre</span>' : esc(l.unsub ? 'Désinscrit' : ETAPE[l.stage] || '')) + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="muted" style="margin-top:10px">Aucun inscrit pour le moment.</p>') + '</div>';
  }
  function exportLeads(leads) {
    var rows = [['date', 'prenom', 'email', 'whatsapp', 'profil', 'venu_de', 'achete', 'desinscrit']].concat(leads.map(function (l) {
      return [date(l.created_at), l.prenom, l.email, l.whatsapp || '', PROFIL[l.profile] || l.profile, l.source || '', l.bought ? 'oui' : 'non', l.unsub ? 'oui' : 'non'];
    }));
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'inscrits-test-alignement.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Mise en avant : grand encart sur l'accueil, encart sur la fiche de chaque livre papier.
  function promoCard(box, promo) {
    var home = promo.home || {}, pdp = promo.pdp || {};
    function opts(sel) {
      return EBOOKS.map(function (e) {
        var s = e.slug || e._id;
        return '<option value="' + esc(s) + '"' + (s === sel ? ' selected' : '') + '>' + esc(e.title) + (e.hidden ? ' (cachée : non affiché)' : '') + '</option>';
      }).join('');
    }
    var defPdp = EBOOKS.some(function (e) { return (e.slug || e._id) === 'lire-autrement'; }) ? 'lire-autrement' : '';
    box.innerHTML = '<h2 style="margin-top:0">Mise en avant</h2>' +
      '<p class="muted small">Où tes ebooks apparaissent dans la boutique de livres papier.</p>' +
      '<label class="chk"><input type="checkbox" data-p="home-on"' + (home.active !== false ? ' checked' : '') + '> Mettre un ebook en valeur en haut de la rubrique Ebooks de l’accueil (les autres défilent en dessous)</label>' +
      '<select class="in" data-p="home-slug" style="margin-top:8px">' + opts(home.slug || (EBOOKS[0] && (EBOOKS[0].slug || EBOOKS[0]._id))) + '</select>' +
      '<label class="chk" style="margin-top:18px"><input type="checkbox" data-p="pdp-on"' + (pdp.active !== false ? ' checked' : '') + '> Encart sur la fiche de chaque livre</label>' +
      '<select class="in" data-p="pdp-slug" style="margin-top:8px">' + opts(pdp.slug || defPdp) + '</select>' +
      '<label class="lab">Titre de l’encart</label><input class="in" data-p="pdp-title" maxlength="90" placeholder="Tu vas lire ce livre ? Retiens-en l’essentiel." value="' + esc(pdp.title || '') + '">' +
      '<label class="lab">Phrase sous le titre</label><input class="in" data-p="pdp-text" maxlength="180" placeholder="Laisse vide pour utiliser l’accroche de l’ebook" value="' + esc(pdp.text || '') + '">' +
      '<div class="actions"><button class="big-b" type="button" data-p="save">Enregistrer la mise en avant</button><small class="msg"></small></div>';
    var q = function (k) { return box.querySelector('[data-p="' + k + '"]'); };
    q('save').onclick = function () {
      var v = {
        home: { active: q('home-on').checked, slug: q('home-slug').value },
        pdp: { active: q('pdp-on').checked, slug: q('pdp-slug').value, title: q('pdp-title').value.trim(), text: q('pdp-text').value.trim() }
      };
      var msg = box.querySelector('.msg'); msg.textContent = 'Enregistrement…';
      api('/db/shop_config/sell_promo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sell_promo', value: v }) })
        .then(function (r) { msg.innerHTML = r.ok ? '<span class="ok">Enregistré. Visible tout de suite sur la boutique.</span>' : '<span class="ko">Échec (' + r.status + ').</span>'; })
        .catch(function () { msg.innerHTML = '<span class="ko">Échec de l’enregistrement.</span>'; });
    };
  }

  function fileRow(f, i) {
    return '<div class="frow" data-i="' + i + '"><input class="in" data-k="name" placeholder="Nom du fichier (ex. Le Workbook)" value="' + esc(f.name || '') + '">' +
      '<input class="in num" data-k="pages" inputmode="numeric" placeholder="Pages" value="' + esc(f.pages || '') + '">' +
      '<div class="fst"><small class="st">' + (f._new ? 'Enregistre d’abord, puis dépose le PDF' : 'Vérification…') + '</small>' +
      (f._new ? '' : '<label class="up">Déposer le PDF<input type="file" accept="application/pdf" data-pdf="' + i + '"></label>') + '</div></div>';
  }

  function addCard(e) {
    var isNew = !e;
    e = e || { title: '', headline: '', price: '', active: true, hidden: false, cover: '', files: { items: [{ name: '', pages: '', _new: true }] } };
    var slug = e.slug || e._id || '';
    var items = (e.files && e.files.items) || [];
    var box = document.createElement('div');
    box.className = 'card ebook-card';
    box.innerHTML =
      '<h2 style="margin-top:0">' + (isNew ? 'Nouvel ebook' : esc(e.title)) + '</h2>' +
      (isNew ? '' : '<p class="muted">Adresse : <a href="/ebook/' + esc(slug) + '" target="_blank" rel="noopener">dilamboutique.com/ebook/' + esc(slug) + '</a>' + (e.hidden ? ' (cachée)' : '') + '</p>') +
      '<label class="lab">Titre</label><input class="in" name="title" value="' + esc(e.title) + '">' +
      (isNew ? '<label class="lab">Adresse de la page</label><div class="muted">dilamboutique.com/ebook/<input class="in inl" name="slug" value=""></div>' : '') +
      '<label class="lab">Accroche (une phrase, affichée sur l’accueil)</label><input class="in" name="headline" value="' + esc(e.headline || '') + '">' +
      '<label class="lab">Prix (FCFA)</label><input class="in num" name="price" inputmode="numeric" value="' + esc(e.price) + '">' +
      '<label class="chk"><input type="checkbox" name="active"' + (e.active !== false ? ' checked' : '') + '> En vente</label>' +
      '<label class="chk"><input type="checkbox" name="hidden"' + (e.hidden ? ' checked' : '') + '> Cachée (absente de l’accueil, lien direct seulement)</label>' +
      '<label class="lab">Couverture</label><div class="cover-row">' + (e.cover ? '<img class="cov" src="' + esc(e.cover) + '" alt="">' : '<span class="muted">Aucune</span>') +
      '<label class="up">Choisir une image<input type="file" accept="image/*" data-cover></label></div>' +
      (isNew ? '' : '<label class="lab">Bannière (tout en haut de la page de vente, format large : idéalement 1600 × 900)</label><div class="cover-row ban-row">' +
        (e.banner ? '<img class="ban" src="' + esc(e.banner) + '" alt="">' : '<span class="muted">Aucune : la couverture est affichée</span>') +
        '<label class="up">Choisir une image<input type="file" accept="image/*" data-banner></label>' +
        (e.banner ? '<button class="mini-b" type="button" data-noban style="margin-top:0">Retirer</button>' : '') + '</div><small class="bmsg"></small>') +
      '<label class="lab">Fichiers PDF livrés</label><div class="files">' + items.map(fileRow).join('') + '</div>' +
      '<button class="mini-b" type="button" data-addfile>+ Ajouter un fichier</button>' +
      (isNew ? '' : '<label class="lab">Page de vente</label><div class="page-row"><small class="hst">' + (e.mode === 'html' ? 'Page HTML déposée' : 'Modèle intégré') + '</small>' +
        '<label class="up">Déposer une page HTML<input type="file" accept=".html,text/html" data-html></label></div>') +
      (isNew ? '' : '<label class="lab">Images et vidéos de la page</label>' +
        '<p class="muted small">' + (e.mode === 'html'
          ? 'Ta page est en HTML : ajoute ici l’image ou la vidéo, puis copie son adresse dans ta page.'
          : 'Choisis pour chacune son emplacement dans la page. Les changements sont enregistrés aussitôt.') + '</p>' +
        '<div class="mlist"></div>' +
        '<div class="madd"><label class="up">Ajouter une image<input type="file" accept="image/*" data-mimg></label>' +
        '<label class="up">Ajouter une vidéo MP4<input type="file" accept="video/mp4,video/webm" data-mvid></label>' +
        '<button class="mini-b" type="button" data-myt>Ajouter une vidéo YouTube</button></div>' +
        '<div class="myt" hidden><input class="in" data-ytin inputmode="url" placeholder="Colle le lien YouTube"><button class="mini-b" type="button" data-ytgo>Ajouter</button></div>' +
        '<small class="mmsg"></small>') +
      '<div class="actions"><button class="big-b" type="button" data-save>' + (isNew ? 'Créer l’ebook' : 'Enregistrer') + '</button><small class="msg"></small></div>';
    document.getElementById('list').appendChild(box);

    var titleIn = box.querySelector('[name=title]'), slugIn = box.querySelector('[name=slug]');
    if (slugIn) titleIn.addEventListener('input', function () { if (!slugIn.dataset.touched) slugIn.value = slugify(titleIn.value); });
    if (slugIn) slugIn.addEventListener('input', function () { slugIn.dataset.touched = '1'; slugIn.value = slugify(slugIn.value); });
    var msg = box.querySelector('.msg');
    var cover = e.cover || '';

    box.querySelector('[data-addfile]').onclick = function () {
      var n = box.querySelectorAll('.frow').length;
      box.querySelector('.files').insertAdjacentHTML('beforeend', fileRow({ _new: true }, n));
    };
    box.querySelector('[data-cover]').onchange = function () {
      var f = this.files[0]; if (!f) return;
      msg.textContent = 'Envoi de l’image…';
      compressImage(f).then(function (r) { return upImage(r.blob); }).then(function (url) {
        cover = url;
        box.querySelector('.cover-row').firstChild.outerHTML = '<img class="cov" src="' + esc(cover) + '" alt="">';
        msg.textContent = 'Image prête. Pense à enregistrer.';
      }).catch(function () { msg.textContent = 'Échec de l’envoi de l’image.'; });
    };

    box.querySelector('[data-save]').onclick = function () {
      var title = titleIn.value.trim();
      var s2 = isNew ? slugify(slugIn.value || title) : slug;
      var price = parseInt(box.querySelector('[name=price]').value, 10);
      if (!title) { msg.textContent = 'Indique un titre.'; return; }
      if (!s2) { msg.textContent = 'Indique une adresse.'; return; }
      if (!(price > 0)) { msg.textContent = 'Indique un prix en FCFA.'; return; }
      if (isNew && EBOOKS.some(function (x) { return (x.slug || x._id) === s2; })) { msg.textContent = 'Cette adresse existe déjà.'; return; }
      var files = [].map.call(box.querySelectorAll('.frow'), function (r) {
        return { name: r.querySelector('[data-k=name]').value.trim(), pages: parseInt(r.querySelector('[data-k=pages]').value, 10) || '' };
      }).filter(function (f) { return f.name; });
      var old = (e.files && e.files.items) || [];
      files = files.map(function (f, i) { return Object.assign({}, old[i] || {}, f, { _new: undefined }); });
      var doc = {
        slug: s2, title: title, headline: box.querySelector('[name=headline]').value.trim(), price: price,
        active: box.querySelector('[name=active]').checked, hidden: box.querySelector('[name=hidden]').checked,
        cover: cover, files: Object.assign({}, e.files || {}, { items: files })
      };
      if (isNew) { doc.mode = 'html'; doc.author_name = 'Lamine Diabaté'; doc.whatsapp_buy = 'Bonjour, je veux acheter « ' + title + ' ».'; }
      msg.textContent = 'Enregistrement…';
      api('/db/ebooks/' + encodeURIComponent(s2), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); msg.textContent = 'Enregistré.'; setTimeout(load, 500); })
        .catch(function (x) { msg.textContent = 'Échec de l’enregistrement (' + x.message + ').'; });
    };

    // Bannière : enregistrée aussitôt, comme les images et vidéos.
    function setBanner(v, note) {
      var bm = box.querySelector('.bmsg'); bm.textContent = 'Enregistrement…';
      return api('/db/ebooks/' + encodeURIComponent(slug), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banner: v }) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          e.banner = v;
          var row = box.querySelector('.ban-row');
          row.querySelector('img.ban, span.muted').outerHTML = v ? '<img class="ban" src="' + esc(v) + '" alt="">' : '<span class="muted">Aucune : la couverture est affichée</span>';
          var rm = row.querySelector('[data-noban]');
          if (v && !rm) row.insertAdjacentHTML('beforeend', '<button class="mini-b" type="button" data-noban style="margin-top:0">Retirer</button>');
          if (!v && rm) rm.remove();
          bm.innerHTML = '<span class="ok">' + esc(note) + '</span>';
        })
        .catch(function (x) { bm.innerHTML = '<span class="ko">Échec (' + esc(x.message) + ').</span>'; });
    }
    var banIn = box.querySelector('[data-banner]');
    if (banIn) {
      banIn.onchange = function () {
        var f = this.files[0]; this.value = ''; if (!f) return;
        box.querySelector('.bmsg').textContent = 'Envoi de la bannière…';
        compressImage(f).then(function (r) { return upImage(r.blob); })
          .then(function (url) { return setBanner(url, 'Bannière en ligne.'); })
          .catch(function () { box.querySelector('.bmsg').innerHTML = '<span class="ko">Cette image n’a pas pu être envoyée.</span>'; });
      };
      box.querySelector('.ban-row').addEventListener('click', function (ev) {
        if (ev.target.closest('[data-noban]')) setBanner('', 'Bannière retirée : la couverture est de nouveau affichée.');
      });
    }

    var html = box.querySelector('[data-html]');
    if (html) html.onchange = function () {
      var f = this.files[0]; if (!f) return;
      var st = box.querySelector('.hst'); st.textContent = 'Envoi…';
      api('/admin/ebook-html?slug=' + encodeURIComponent(slug), { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: f })
        .then(function (r) { return jsonOf(r).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) { st.innerHTML = '<span class="ko">Échec (' + esc(res.d.error || '') + ')</span>'; return; }
          var w = res.d.warn || [];
          st.innerHTML = '<span class="ok">Page HTML déposée</span> <a href="/ebook/' + esc(slug) + '" target="_blank" rel="noopener">Voir la page</a>' +
            (w.indexOf('no_buy_link') > -1 ? '<br><span class="ko">Aucun lien vers #acheter trouvé : les visiteurs ne pourront pas acheter.</span>' : '') +
            (w.indexOf('scripts_removed') > -1 ? '<br><span class="ko">La page contenait du JavaScript : il sera retiré à l’affichage.</span>' : '');
        });
      this.value = '';
    };

    if (!isNew) {
      mediaManager(box, e, slug);
      refreshPdf(box, slug);
      if (e.mode === 'html') api('/admin/ebook-html?slug=' + encodeURIComponent(slug)).then(jsonOf).then(function (d) {
        box.querySelector('.hst').innerHTML = d.exists ? '<span class="ok">Page HTML déposée</span> ' + esc(size(d.size)) + ' <a href="/ebook/' + esc(slug) + '" target="_blank" rel="noopener">Voir la page</a>' : '<span class="ko">Page HTML pas encore déposée</span>';
      });
      box.addEventListener('change', function (ev) {
        var inp = ev.target;
        if (!inp.matches('input[data-pdf]') || !inp.files[0]) return;
        var file = inp.files[0], i = inp.getAttribute('data-pdf');
        var st = inp.closest('.frow').querySelector('.st');
        st.textContent = 'Envoi en cours…';
        api('/admin/pdf?slug=' + encodeURIComponent(e.pdf_slug || slug) + '&i=' + i + '&name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file })
          .then(function (r) { if (r.ok) refreshPdf(box, slug); else jsonOf(r).then(function (d) { st.innerHTML = '<span class="ko">Échec (' + esc(d.error || r.status) + ')</span>'; }); })
          .catch(function () { st.innerHTML = '<span class="ko">Échec de l’envoi.</span>'; });
        inp.value = '';
      });
    }
  }

  // ───────────── Images et vidéos de la page ─────────────
  var MAX_VID = 20 * 1024 * 1024;
  function short(t) { t = String(t || ''); return t.length > 42 ? t.slice(0, 40) + '…' : t; }
  function slotsOf(e) {
    var S = [
      ['hero', 'Après le haut de page, sous le bouton d’achat', true],
      ['problem', 'Après le Problème', e.problem], ['agitation', 'Après l’Agitation', e.agitation],
      ['solution', 'Après la Solution et la méthode', e.solution], ['skills', 'Après les compétences', e.skills],
      ['files', 'Dans « Ce que tu reçois », avant le bouton', e.files && (e.files.items || []).length],
      ['audience', 'Après « Pour qui »', e.audience], ['author', 'Après l’auteur', e.author],
      ['action', 'Dans l’Action, avant le bouton', true], ['final', 'Dans le dernier mot, avant le bouton', e.final]
    ];
    return S.filter(function (x) { return x[2]; }).map(function (x) {
      var ti = x[2] && x[2].title ? String(x[2].title).replace(/'/g, '’') : '';
      var t = ti && x[1].indexOf(ti) < 0 ? ' : ' + short(ti) : '';
      return [x[0], x[1] + t];
    });
  }
  function parseYt(u) {
    u = String(u || '').trim();
    var m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? { id: m[1], vertical: /\/shorts\//.test(u) } : null;
  }
  // Image allégée dans le navigateur avant l'envoi : 1 400 pixels de large au plus, JPEG.
  function compressImage(file) {
    return new Promise(function (ok, ko) {
      if (file.type === 'image/gif') { var g = new Image(); g.onload = function () { ok({ blob: file, w: g.naturalWidth, h: g.naturalHeight }); }; g.onerror = ko; g.src = URL.createObjectURL(file); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, max = 1400;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) {
          if (!b) { ko(new Error('canvas')); return; }
          ok({ blob: b.size < file.size || file.type === 'image/heic' ? b : file, w: w, h: h });
        }, 'image/jpeg', 0.82);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { ko(new Error('image')); };
      img.src = URL.createObjectURL(file);
    });
  }
  // Dimensions et image d'aperçu d'une vidéo. Si le navigateur ne sait pas la lire, les acheteurs non plus.
  function videoInfo(file) {
    return new Promise(function (ok, ko) {
      var v = document.createElement('video'), done = false;
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      var t = setTimeout(function () { if (!done) { done = true; ko(new Error('timeout')); } }, 20000);
      v.onloadeddata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = function () {
        if (done) return; done = true; clearTimeout(t);
        var w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) { ko(new Error('codec')); return; }
        var sc = Math.min(1, 1280 / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(v.src); ok({ w: w, h: h, poster: b, duration: v.duration }); }, 'image/jpeg', 0.8);
      };
      v.onerror = function () { if (!done) { done = true; clearTimeout(t); ko(new Error('codec')); } };
      v.src = URL.createObjectURL(file);
    });
  }
  function xhrUpload(path, body, type, onProg) {
    return new Promise(function (ok, ko) {
      var x = new XMLHttpRequest();
      x.open('POST', '/api' + path);
      x.setRequestHeader('X-Dilam', '1');
      x.setRequestHeader('Content-Type', type);
      x.upload.onprogress = function (ev) { if (ev.lengthComputable && onProg) onProg(ev.loaded / ev.total); };
      x.onload = function () { var d = {}; try { d = JSON.parse(x.responseText); } catch (e) {} if (x.status >= 200 && x.status < 300 && d.url) ok(d); else ko(new Error(d.error || x.status)); };
      x.onerror = function () { ko(new Error('réseau')); };
      x.send(body);
    });
  }
  function upImage(blob) {
    return api('/admin/upload', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob }).then(jsonOf).then(function (d) {
      if (!d.url) throw new Error(d.error || 'image'); return d.url;
    });
  }

  function mediaManager(box, e, slug) {
    var media = (e.media || []).slice();
    var list = box.querySelector('.mlist'), mmsg = box.querySelector('.mmsg');
    var slots = slotsOf(e), html = e.mode === 'html';
    var TYPE = { image: 'Image', video: 'Vidéo', youtube: 'Vidéo YouTube' };
    function thumb(m) { return m.type === 'youtube' ? 'https://i.ytimg.com/vi/' + m.yt + '/default.jpg' : (m.type === 'video' ? m.poster : m.src) || ''; }
    function draw() {
      list.innerHTML = media.length ? media.map(function (m, k) {
        return '<div class="mrow" data-k="' + k + '"><img class="mth" src="' + esc(thumb(m)) + '" alt="">' +
          '<div class="mmain"><strong>' + TYPE[m.type] + '</strong>' +
          (html ? '' : '<select class="in msl">' + slots.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === m.slot ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') + '</select>') +
          '<input class="in mcap" maxlength="200" placeholder="Légende (facultatif)" value="' + esc(m.caption || '') + '">' +
          '<div class="mbtns">' + (k > 0 ? '<button type="button" class="mini-b" data-up>Monter</button>' : '') +
          (k < media.length - 1 ? '<button type="button" class="mini-b" data-down>Descendre</button>' : '') +
          (html && m.type !== 'youtube' ? '<button type="button" class="mini-b" data-copy>Copier l’adresse</button>' : '') +
          '<button type="button" class="mini-b ko-b" data-del>Retirer</button></div></div></div>';
      }).join('') : '<p class="muted small">Aucune image ni vidéo pour le moment.</p>';
    }
    function save(note) {
      mmsg.textContent = 'Enregistrement…';
      return api('/db/ebooks/' + encodeURIComponent(slug), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media: media }) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          e.media = media.slice();
          mmsg.innerHTML = '<span class="ok">' + esc(note || 'Enregistré.') + '</span>';
        })
        .catch(function (x) { mmsg.innerHTML = '<span class="ko">Échec de l’enregistrement (' + esc(x.message) + '). Réessaie.</span>'; });
    }
    function add(m) { media.push(m); draw(); save(html ? 'Ajouté. Copie son adresse dans ta page.' : 'Ajouté. Choisis son emplacement si besoin.'); }
    draw();

    list.addEventListener('change', function (ev) {
      var row = ev.target.closest('.mrow'); if (!row) return;
      var m = media[+row.getAttribute('data-k')];
      if (ev.target.matches('.msl')) { m.slot = ev.target.value; save(); }
      if (ev.target.matches('.mcap')) { m.caption = ev.target.value.trim(); save(); }
    });
    list.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var k = +b.closest('.mrow').getAttribute('data-k'), m = media[k];
      if (b.hasAttribute('data-up') || b.hasAttribute('data-down')) {
        var j = b.hasAttribute('data-up') ? k - 1 : k + 1;
        media[k] = media[j]; media[j] = m; draw(); save();
      } else if (b.hasAttribute('data-copy')) {
        var u = location.origin + m.src;
        if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { b.textContent = 'Adresse copiée'; });
      } else if (b.hasAttribute('data-del')) {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirmer le retrait'; setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Retirer'; } }, 4000); return; }
        media.splice(k, 1); draw();
        save('Retiré de la page.').then(function () {
          if (m.type === 'video') api('/admin/video?url=' + encodeURIComponent(m.src), { method: 'DELETE' });
        });
      }
    });

    box.querySelector('[data-mimg]').onchange = function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      mmsg.textContent = 'Préparation de l’image…';
      compressImage(f).then(function (r) {
        mmsg.textContent = 'Envoi de l’image (' + size(r.blob.size) + ')…';
        return upImage(r.blob).then(function (url) { add({ type: 'image', src: url, w: r.w, h: r.h, slot: 'solution', caption: '' }); });
      }).catch(function (x) { mmsg.innerHTML = '<span class="ko">Cette image n’a pas pu être envoyée (' + esc(x.message) + '). Essaie une image JPEG ou PNG.</span>'; });
    };
    box.querySelector('[data-mvid]').onchange = function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      if (f.size > MAX_VID) { mmsg.innerHTML = '<span class="ko">Cette vidéo fait ' + esc(size(f.size)) + ', le maximum est 20 Mo. Pour une vidéo plus longue, publie-la sur YouTube en « non répertoriée » et colle son lien.</span>'; return; }
      if (!/^video\/(mp4|webm)$/.test(f.type)) { mmsg.innerHTML = '<span class="ko">Seuls les fichiers MP4 sont acceptés.</span>'; return; }
      mmsg.textContent = 'Vérification de la vidéo…';
      videoInfo(f).then(function (info) {
        mmsg.textContent = 'Envoi de l’image d’aperçu…';
        return upImage(info.poster).then(function (poster) {
          return xhrUpload('/admin/video', f, f.type, function (p) { mmsg.textContent = 'Envoi de la vidéo : ' + Math.round(p * 100) + ' %'; })
            .then(function (d) { add({ type: 'video', src: d.url, poster: poster, w: info.w, h: info.h, slot: 'hero', caption: '' }); });
        });
      }).catch(function (x) {
        mmsg.innerHTML = x.message === 'codec' || x.message === 'timeout'
          ? '<span class="ko">Cette vidéo ne se lit pas dans le navigateur, donc pas non plus chez tes acheteurs. Exporte-la en MP4 (H.264) depuis ton téléphone ou CapCut, puis réessaie.</span>'
          : '<span class="ko">Échec de l’envoi (' + esc(x.message) + '). Vérifie ta connexion et réessaie.</span>';
      });
    };
    var ytBox = box.querySelector('.myt'), ytIn = box.querySelector('[data-ytin]');
    box.querySelector('[data-myt]').onclick = function () { ytBox.hidden = false; ytIn.focus(); };
    box.querySelector('[data-ytgo]').onclick = function () {
      var y = parseYt(ytIn.value);
      if (!y) { mmsg.innerHTML = '<span class="ko">Ce lien n’est pas un lien de vidéo YouTube. Exemple : https://youtu.be/…</span>'; return; }
      ytIn.value = ''; ytBox.hidden = true;
      add({ type: 'youtube', yt: y.id, vertical: y.vertical, slot: 'hero', caption: '' });
    };
  }

  function refreshPdf(box, slug) {
    var e = EBOOKS.find(function (x) { return (x.slug || x._id) === slug; }) || {};
    var src = e.pdf_slug || slug;
    api('/admin/pdf?slug=' + encodeURIComponent(src)).then(jsonOf).then(function (list) {
      var by = {};
      (list || []).forEach(function (k) { var m = k.key.match(/\/(\d+)\.pdf$/); if (m) by[m[1]] = k; });
      box.querySelectorAll('.frow').forEach(function (row) {
        var k = by[row.getAttribute('data-i')], st = row.querySelector('.st');
        if (!st || /Enregistre/.test(st.textContent)) return;
        st.innerHTML = k ? '<span class="ok">Déposé</span> ' + esc(size(k.size)) : '<span class="ko">Pas encore déposé</span>';
      });
    });
  }
})();
