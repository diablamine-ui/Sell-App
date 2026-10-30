/* Admin : rubrique « PDF » du site (livres d'autres auteurs vendus en PDF, et packs de PDF).
   Chaque PDF est un document de la collection « ebooks » avec kind:'pdf' : paiement, livraison et filigrane
   sont ceux des ebooks. Un pack ne stocke aucun fichier : ses fichiers pointent vers ceux des livres seuls. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var PDFS = [], BOOKS = [], ORDERS = [];
  var DEFAULT_PRICE = 700;
  var CATS = [['finance', 'Finances'], ['devperso', 'Développement personnel'], ['productivite', 'Productivité'], ['cheikh', 'Cheikh Anta Diop'], ['autre', 'Autres']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opt) { opt = opt || {}; opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {}); opt.credentials = 'same-origin'; return fetch('/api' + path, opt); }
  function jsonOf(r) { return r.json().catch(function () { return {}; }); }
  function size(n) { return n ? (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo' : ''; }
  function fcfa(n) { return (parseInt(n, 10) || 0).toLocaleString('fr-FR') + ' F'; }
  function slugify(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  function put(slug, doc) {
    return api('/db/ebooks/' + encodeURIComponent(slug), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function hasFile(p) { return !!(p.files && (p.files.items || []).length); }
  function bySlug(s) { return PDFS.find(function (p) { return p.slug === s; }); }

  api('/auth/me').then(jsonOf).then(function (me) {
    if (!me.admin) { app.innerHTML = '<h1>PDF</h1><p style="margin-top:12px">Connecte-toi d’abord à <a href="/admin">l’administration</a>, puis reviens sur cette page.</p>'; return; }
    load();
  });

  function load() {
    Promise.all([api('/db/ebooks').then(jsonOf), api('/db/books').then(jsonOf), api('/admin/orders').then(jsonOf)]).then(function (res) {
      PDFS = (res[0] || []).filter(function (e) { return e && e.kind === 'pdf'; }).map(function (e) { e.slug = e.slug || e._id; return e; });
      BOOKS = (res[1] || []).filter(function (b) { return b && b.category !== 'pack'; });
      ORDERS = res[2] || [];
      draw();
    });
  }

  function draw() {
    var singles = PDFS.filter(function (p) { return !p.pack; }).sort(function (a, b) { return a.title.localeCompare(b.title, 'fr'); });
    var packs = PDFS.filter(function (p) { return p.pack; });
    var taken = {};
    singles.forEach(function (p) { if (p.book) taken[p.book] = 1; });
    var free = BOOKS.filter(function (b) { return !taken[b._id]; }).sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'fr'); });
    var online = PDFS.filter(function (p) { return p.active !== false && hasFile(p); }).length;

    app.innerHTML = '<p><a href="/admin">Retour à l’administration</a></p><h1 style="margin-top:10px">PDF</h1>' +
      '<p class="muted" style="margin-top:6px">Les livres de la rubrique « PDF » du site (dilamboutique.com/?vue=pdf). Un PDF n’apparaît sur le site qu’une fois son fichier envoyé et la case « En ligne » cochée. Chaque fichier téléchargé porte l’e-mail de l’acheteur.</p>' +
      statsCard() +
      '<div class="card"><h2 style="margin-top:0">Ajouter un livre en PDF</h2>' +
        '<p class="muted small">Choisis un livre de ta boutique : titre, auteur, image et description sont repris automatiquement. Tu enverras ensuite son fichier.</p>' +
        '<select class="in" id="addSel" style="margin-top:8px"><option value="">Choisir un livre…</option>' +
          free.map(function (b) { return '<option value="' + esc(b._id) + '">' + esc(b.title) + (b.author ? ' (' + esc(b.author) + ')' : '') + '</option>'; }).join('') + '</select>' +
        '<div class="actions"><button class="big-b" type="button" id="addBtn">Ajouter ce livre</button><small class="msg" id="addMsg"></small></div></div>' +
      '<h2>Les livres en PDF (' + singles.length + ')</h2>' +
      '<p class="muted small">' + online + ' titre' + (online > 1 ? 's' : '') + ' en ligne sur le site, packs compris.</p>' +
      (singles.length ? '' : '<p class="muted">Aucun pour le moment.</p>') +
      '<div id="singles"></div>' +
      '<h2>Les packs (' + packs.length + ')</h2>' +
      '<p class="muted small">Un pack regroupe plusieurs livres en PDF à prix réduit. Il utilise les fichiers des livres seuls : rien à envoyer en plus.</p>' +
      '<div id="packs"></div>' +
      '<button class="big-b" type="button" id="newPack">+ Créer un pack</button>';

    document.getElementById('addBtn').onclick = addBook;
    document.getElementById('newPack').onclick = function () { this.hidden = true; packItem(null, true); };
    singles.forEach(function (p) { singleItem(p); });
    packs.forEach(function (p) { packItem(p, false); });
  }

  function statsCard() {
    var set = {};
    PDFS.forEach(function (p) { set[p.slug] = p; });
    var paid = ORDERS.filter(function (o) { return o.status === 'paid' && set[o.slug]; });
    var d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000;
    var month = paid.filter(function (o) { return (o.paid_at || 0) >= start; });
    var sum = function (l) { return l.reduce(function (s, o) { return s + (o.amount || 0); }, 0); };
    var top = {};
    month.forEach(function (o) { top[o.slug] = (top[o.slug] || 0) + 1; });
    var best = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 3)
      .map(function (s) { return esc(set[s].title) + ' (' + top[s] + ')'; }).join(', ');
    return '<div class="card"><div class="stat">' +
      '<div><span class="muted small">Ventes ce mois-ci</span><b>' + month.length + '</b></div>' +
      '<div><span class="muted small">Encaissé ce mois-ci</span><b>' + fcfa(sum(month)) + '</b></div>' +
      '<div><span class="muted small">Ventes depuis le début</span><b>' + paid.length + '</b></div></div>' +
      (best ? '<p class="muted small" style="margin-top:8px">Les plus vendus ce mois-ci : ' + best + '.</p>' : '') + '</div>';
  }

  function addBook() {
    var id = document.getElementById('addSel').value, msg = document.getElementById('addMsg');
    var b = BOOKS.find(function (x) { return x._id === id; });
    if (!b) { msg.textContent = 'Choisis un livre.'; return; }
    var slug = 'pdf-' + (slugify(b.slug || b.title) || id).slice(0, 70);
    if (bySlug(slug)) slug += '-' + id.slice(0, 4);
    msg.textContent = 'Ajout…';
    put(slug, {
      kind: 'pdf', slug: slug, book: b._id, title: b.title || '', author: b.author || '',
      category: b.category || 'autre', cover: b.image || '', description: b.description || '',
      price: DEFAULT_PRICE, active: true, hidden: false, pitch: '', learn: [], audience: '', files: { items: [] }
    }).then(function () { msg.textContent = 'Ajouté. Envoie maintenant son fichier PDF.'; load(); })
      .catch(function (e) { msg.textContent = 'Échec (' + e.message + ').'; });
  }

  function head(p, isPack) {
    var ok = hasFile(p), on = p.active !== false;
    var img = p.cover ? '<img src="' + esc(p.cover) + '" alt="">' : '<span class="ph"></span>';
    return '<summary>' + img + '<span><strong>' + esc(p.title || 'Nouveau pack') + '</strong>' +
      (isPack ? '<span class="pill">' + ((p.items || []).length) + ' livres</span>' : '') +
      '<span class="pill ' + (ok ? 'ok' : 'ko') + '">' + (ok ? (isPack ? 'Fichiers prêts' : 'Fichier envoyé') : (isPack ? 'Aucun livre' : 'Pas de fichier')) + '</span>' +
      '<span class="pill ' + (on && ok ? 'ok' : '') + '">' + (on && ok ? 'En ligne' : 'Pas en ligne') + '</span></span>' +
      '<span class="muted">' + fcfa(p.price) + '</span></summary>';
  }
  // Message de vente : un seul champ mis en forme, comme sur Chariow.
  function textFields() {
    return '<label class="lab">Description de vente</label>' +
      '<p class="muted small">Elle s’affiche telle quelle sur la page. Tu peux y coller une description depuis Chariow, avec sa mise en forme.</p>' +
      '<div data-ed></div>';
  }
  // Anciennes cases (avant l'éditeur) ou description du livre papier, reprises dans l'éditeur à la première ouverture.
  function legacyHtml(p) {
    var F = window.DilamEditor ? DilamEditor.fromText : function (t) { return '<p>' + esc(t) + '</p>'; };
    var h = p.pitch ? F(p.pitch) : (p.description ? F(p.description) : '');
    if ((p.learn || []).length) h += '<h2>Ce que tu vas y trouver</h2><ul>' + p.learn.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
    if (p.audience) h += '<h2>Pour qui</h2>' + F(p.audience);
    return h;
  }
  function editorFor(box, p) {
    if (box._ed) return box._ed;
    if (!window.DilamEditor) { box.querySelector('[data-ed]').innerHTML = '<p class="ko">L’éditeur n’a pas pu se charger. Recharge la page.</p>'; return null; }
    box._ed = DilamEditor.create(box.querySelector('[data-ed]'), p.body || legacyHtml(p));
    return box._ed;
  }

  function singleItem(p) {
    var box = document.createElement('details');
    box.className = 'pdf-item';
    var f0 = (p.files && p.files.items && p.files.items[0]) || {};
    box.innerHTML = head(p, false) + '<div class="pdf-body">' +
      '<label class="lab">Titre</label><input class="in" data-f="title" maxlength="140" value="' + esc(p.title) + '">' +
      '<div class="grid2"><div><label class="lab">Auteur</label><input class="in" data-f="author" maxlength="120" value="' + esc(p.author) + '"></div>' +
      '<div><label class="lab">Rayon</label><select class="in" data-f="category">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === p.category ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="grid2"><div><label class="lab">Prix (FCFA)</label><input class="in num" data-f="price" type="number" min="100" step="50" value="' + esc(p.price) + '"></div>' +
      '<div><label class="lab">Nombre de pages</label><input class="in num" data-f="pages" type="number" min="0" value="' + esc(f0.pages || '') + '"></div></div>' +
      '<label class="lab">Image (adresse)</label><input class="in" data-f="cover" value="' + esc(p.cover) + '">' +
      textFields() +
      '<label class="lab">Fichier PDF (25 Mo au plus)</label>' +
      '<div class="page-row"><label class="up">Envoyer le fichier<input type="file" accept="application/pdf" data-up></label><small class="fst muted">Vérification…</small></div>' +
      '<label class="chk"><input type="checkbox" data-f="active"' + (p.active !== false ? ' checked' : '') + '> En ligne (visible dans la rubrique PDF dès que le fichier est envoyé)</label>' +
      '<div class="actions"><button class="big-b" type="button" data-save>Enregistrer</button><a href="/?pdf=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Voir la page</a>' +
      '<button class="mini-b ko-b" type="button" data-del style="margin-top:16px">Supprimer</button><small class="msg"></small></div></div>';
    document.getElementById('singles').appendChild(box);
    var msg = box.querySelector('.msg'), fst = box.querySelector('.fst');
    var q = function (k) { return box.querySelector('[data-f="' + k + '"]'); };

    function fileState() {
      api('/admin/pdf?slug=' + encodeURIComponent(p.slug)).then(jsonOf).then(function (list) {
        var f = (list || []).find(function (x) { return /\/0\.pdf$/.test(x.key); });
        fst.innerHTML = f ? '<span class="ok">' + esc(f.name || 'Fichier envoyé') + ', ' + esc(size(f.size)) + (f.watermark ? '' : ' (filigrane impossible sur ce fichier)') + '</span>' : '<span class="ko">Aucun fichier pour le moment.</span>';
      });
    }
    box.addEventListener('toggle', function () {
      if (!box.open) return;
      editorFor(box, p);
      if (fst.textContent === 'Vérification…') fileState();
    });

    box.querySelector('[data-up]').onchange = function () {
      var file = this.files[0]; this.value = '';
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) { fst.innerHTML = '<span class="ko">Ce fichier fait ' + esc(size(file.size)) + ' : 25 Mo au plus. Compresse-le d’abord (par exemple sur ilovepdf.com, « Compresser PDF »).</span>'; return; }
      fst.textContent = 'Envoi en cours (' + size(file.size) + ')…';
      api('/admin/pdf?slug=' + encodeURIComponent(p.slug) + '&i=0&name=' + encodeURIComponent((q('title').value.trim() || p.title) + '.pdf'), { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file })
        .then(function (r) {
          if (!r.ok) return jsonOf(r).then(function (d) { throw new Error(d.error || r.status); });
          return put(p.slug, { files: { items: [{ name: q('title').value.trim() || p.title, pages: parseInt(q('pages').value, 10) || '' }] } });
        })
        .then(function () { p.files = { items: [{ name: p.title }] }; fileState(); box.querySelector('summary').outerHTML = head(p, false); })
        .catch(function (e) { fst.innerHTML = '<span class="ko">Échec de l’envoi (' + esc(e.message) + ').</span>'; });
    };

    box.querySelector('[data-save]').onclick = function () {
      var price = parseInt(q('price').value, 10);
      if (!q('title').value.trim()) { msg.textContent = 'Indique un titre.'; return; }
      if (!(price >= 100)) { msg.textContent = 'Indique un prix en FCFA.'; return; }
      var doc = Object.assign({
        title: q('title').value.trim(), author: q('author').value.trim(), category: q('category').value,
        price: price, cover: q('cover').value.trim(), active: q('active').checked
      });
      var ed = editorFor(box, p);
      if (ed) doc.body = ed.html();
      if (hasFile(p)) doc.files = { items: [Object.assign({}, p.files.items[0], { name: doc.title, pages: parseInt(q('pages').value, 10) || '' })] };
      msg.textContent = 'Enregistrement…';
      put(p.slug, doc).then(function () { msg.textContent = 'Enregistré.'; setTimeout(load, 500); })
        .catch(function (e) { msg.textContent = 'Échec (' + e.message + ').'; });
    };
    box.querySelector('[data-del]').onclick = function () {
      var inPack = PDFS.filter(function (x) { return x.pack && (x.items || []).indexOf(p.slug) > -1; });
      if (inPack.length) { msg.textContent = 'Ce livre fait partie d’un pack (' + inPack.map(function (x) { return x.title; }).join(', ') + ') : retire-le du pack d’abord.'; return; }
      if (!confirm('Supprimer « ' + p.title + ' » de la rubrique PDF ?')) return;
      api('/db/ebooks/' + encodeURIComponent(p.slug), { method: 'DELETE' }).then(function () { load(); });
    };
  }

  function packItem(p, isNew) {
    p = p || { kind: 'pdf', pack: true, title: '', price: '', items: [], active: true };
    var box = document.createElement('details');
    box.className = 'pdf-item';
    if (isNew) box.open = true;
    var singles = PDFS.filter(function (x) { return !x.pack; }).sort(function (a, b) { return a.title.localeCompare(b.title, 'fr'); });
    var chosen = p.items || [];
    box.innerHTML = head(p, true) + '<div class="pdf-body">' +
      '<label class="lab">Nom du pack</label><input class="in" data-f="title" maxlength="140" placeholder="Par exemple : Les lois de Robert Greene" value="' + esc(p.title) + '">' +
      '<label class="lab">Livres du pack</label><div class="members">' +
        (singles.length ? singles.map(function (s) {
          return '<label><input type="checkbox" value="' + esc(s.slug) + '"' + (chosen.indexOf(s.slug) > -1 ? ' checked' : '') + '> ' + esc(s.title) + ' <span class="muted">' + fcfa(s.price) + (hasFile(s) ? '' : ', pas encore de fichier') + '</span></label>';
        }).join('') : '<span class="muted">Ajoute d’abord des livres en PDF.</span>') + '</div>' +
      '<p class="muted small" data-val style="margin-top:6px"></p>' +
      '<div class="grid2"><div><label class="lab">Prix du pack (FCFA)</label><input class="in num" data-f="price" type="number" min="100" step="50" value="' + esc(p.price) + '"></div>' +
      '<div><label class="lab">Rayon</label><select class="in" data-f="category">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === p.category ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="lab">Image (facultatif : sinon les couvertures des livres s’affichent en éventail)</label><input class="in" data-f="cover" value="' + esc(p.cover || '') + '">' +
      textFields() +
      '<label class="chk"><input type="checkbox" data-f="active"' + (p.active !== false ? ' checked' : '') + '> En ligne</label>' +
      '<div class="actions"><button class="big-b" type="button" data-save>Enregistrer le pack</button>' +
      (isNew ? '' : '<a href="/?pdf=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Voir la page</a><button class="mini-b ko-b" type="button" data-del style="margin-top:16px">Supprimer</button>') +
      '<small class="msg"></small></div></div>';
    document.getElementById('packs').appendChild(box);
    var msg = box.querySelector('.msg');
    var q = function (k) { return box.querySelector('[data-f="' + k + '"]'); };
    function picked() { return [].map.call(box.querySelectorAll('.members input:checked'), function (i) { return i.value; }); }
    function val() {
      var v = picked().reduce(function (s, k) { var m = bySlug(k); return s + (m ? parseInt(m.price, 10) || 0 : 0); }, 0);
      box.querySelector('[data-val]').textContent = picked().length ? picked().length + ' livres, ' + fcfa(v) + ' achetés un par un.' : '';
    }
    box.querySelector('.members').addEventListener('change', val);
    val();
    if (isNew) editorFor(box, p);
    box.addEventListener('toggle', function () { if (box.open) editorFor(box, p); });

    box.querySelector('[data-save]').onclick = function () {
      var title = q('title').value.trim(), price = parseInt(q('price').value, 10), items = picked();
      if (!title) { msg.textContent = 'Indique le nom du pack.'; return; }
      if (items.length < 2) { msg.textContent = 'Choisis au moins deux livres.'; return; }
      if (!(price >= 100)) { msg.textContent = 'Indique un prix en FCFA.'; return; }
      var missing = items.map(bySlug).filter(function (m) { return !hasFile(m); });
      if (missing.length) { msg.textContent = 'Envoie d’abord le fichier de : ' + missing.map(function (m) { return m.title; }).join(', ') + '.'; return; }
      // Les fichiers du pack pointent vers ceux des livres seuls.
      var files = [];
      items.map(bySlug).forEach(function (m) {
        (m.files.items || []).forEach(function (f, j) { files.push({ name: m.title, pages: f.pages || '', src: { slug: m.slug, i: j } }); });
      });
      var slug = p.slug || ('pack-pdf-' + slugify(title)).slice(0, 80);
      if (isNew && bySlug(slug)) { msg.textContent = 'Un pack porte déjà ce nom.'; return; }
      var doc = Object.assign({
        kind: 'pdf', pack: true, slug: slug, title: title, author: '', items: items, price: price,
        category: q('category').value, cover: q('cover').value.trim(), active: q('active').checked, hidden: false,
        files: { items: files }
      });
      var ed = editorFor(box, p);
      if (ed) doc.body = ed.html();
      msg.textContent = 'Enregistrement…';
      put(slug, doc).then(function () { msg.textContent = 'Enregistré.'; setTimeout(load, 500); })
        .catch(function (e) { msg.textContent = 'Échec (' + e.message + ').'; });
    };
    var del = box.querySelector('[data-del]');
    if (del) del.onclick = function () {
      if (!confirm('Supprimer le pack « ' + p.title + ' » ? Les livres seuls restent en vente.')) return;
      api('/db/ebooks/' + encodeURIComponent(p.slug), { method: 'DELETE' }).then(function () { load(); });
    };
  }
})();
