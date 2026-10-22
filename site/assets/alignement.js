/* Test d'alignement : 12 affirmations, coordonnées, puis résultat calculé par le serveur. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Q = [], SCALE = [], order = [], answers = {}, pos = 0;
  var params = new URLSearchParams(location.search);
  var source = (params.get('depuis') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  var PIXEL = '1671688320192246';
  $('year').textContent = new Date().getFullYear();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // **gras** dans les textes du livre
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

  // Pixel Meta : visite et inscription (le serveur envoie aussi l'inscription, avec le même identifiant).
  function pixel() {
    if (window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL);
    window.fbq('track', 'PageView');
  }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  try { pixel(); } catch (e) {}

  function show(id) {
    ['stIntro', 'stQuiz', 'stForm', 'stResult'].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  // Questions mélangées : on ne devine pas son profil en voyant les questions regroupées.
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  fetch('/api/quiz').then(function (r) { return r.json(); }).then(function (d) {
    Q = d.questions || []; SCALE = d.scale || [];
    order = shuffle(Q.map(function (q, i) { return i; }));
    $('goBtn').disabled = false;
  }).catch(function () {
    $('goBtn').textContent = 'Connexion impossible, recharge la page';
  });

  $('goBtn').addEventListener('click', function () { pos = 0; show('stQuiz'); ask(); });

  function ask() {
    var q = Q[order[pos]];
    $('qCount').textContent = 'Question ' + (pos + 1) + ' sur ' + Q.length;
    $('qBar').style.width = Math.round(pos / Q.length * 100) + '%';
    $('qText').textContent = q.t;
    $('qOpts').innerHTML = SCALE.map(function (s, v) {
      return '<button type="button" class="al-opt' + (answers[q.id] === v ? ' on' : '') + '" data-v="' + v + '">' + esc(s) + '</button>';
    }).join('');
    $('qBack').hidden = pos === 0;
    $('qText').focus({ preventScroll: true });
  }
  $('qOpts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b) return;
    var q = Q[order[pos]];
    answers[q.id] = parseInt(b.getAttribute('data-v'), 10);
    [].forEach.call($('qOpts').children, function (x) { x.classList.toggle('on', x === b); });
    // Un court instant pour voir sa réponse cochée, puis la question suivante.
    setTimeout(function () {
      if (pos < Q.length - 1) { pos++; ask(); }
      else { $('qBar').style.width = '100%'; show('stForm'); $('formTitle').focus({ preventScroll: true }); }
    }, 220);
  });
  $('qBack').addEventListener('click', function () { if (pos > 0) { pos--; ask(); } });

  $('leadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('formErr');
    var prenom = f.prenom.value.trim(), email = f.email.value.trim();
    err.hidden = true;
    if (!prenom) { err.textContent = 'Indique ton prénom.'; err.hidden = false; f.prenom.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { err.textContent = 'Cette adresse e-mail ne semble pas complète.'; err.hidden = false; f.email.focus(); return; }
    var btn = $('formBtn');
    btn.disabled = true; btn.textContent = 'Calcul de ton profil…';
    var eventId = 'lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dilam': '1' },
      body: JSON.stringify({ prenom: prenom, email: email, whatsapp: f.whatsapp.value.trim(), answers: answers, source: source, event_id: eventId, fbp: cookie('_fbp'), fbc: cookie('_fbc') })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); }).then(function (x) {
      if (!x.ok) {
        err.textContent = x.status === 429 ? 'Trop d’essais depuis ce téléphone. Réessaie dans une heure.' :
          x.d.error === 'email' ? 'Cette adresse e-mail ne semble pas valide.' : 'Une erreur est survenue. Réessaie dans un instant.';
        err.hidden = false; btn.disabled = false; btn.textContent = 'Voir mon résultat';
        return;
      }
      try { window.fbq && window.fbq('track', 'Lead', { content_name: 'Indice d\'Alignement' }, { eventID: eventId }); } catch (e2) {}
      render(prenom, x.d);
    }).catch(function () {
      err.textContent = 'Connexion impossible. Vérifie ta connexion et réessaie.';
      err.hidden = false; btn.disabled = false; btn.textContent = 'Voir mon résultat';
    });
  });

  var NAMES = { mental: 'Mental', coeur: 'Cœur', corps: 'Corps' };
  function level(v) { return v >= 9 ? 'Forte tension' : v >= 5 ? 'Tension' : 'Peu de tension'; }

  function render(prenom, d) {
    var v = d.view, s = d.scores;
    var top = Math.max(s.mental, s.coeur, s.corps);
    var bars = ['mental', 'coeur', 'corps'].map(function (k) {
      var pct = Math.max(4, Math.round(s[k] / 12 * 100));
      return '<div class="al-meter' + (s[k] === top && v.key !== 'aligne' ? ' is-top' : '') + '"><span class="al-meter-n">' + NAMES[k] + '</span>' +
        '<span class="al-meter-b" role="img" aria-label="' + NAMES[k] + ' : ' + level(s[k]) + '"><i style="width:' + pct + '%"></i></span>' +
        '<span class="al-meter-l">' + level(s[k]) + '</span></div>';
    }).join('');
    var ex = v.exercise;
    var blocks = ex.blocks.map(function (b) {
      if (b[0] === 'h') return '<h4>' + rich(b[1]) + '</h4>';
      if (b[0] === 'q') return '<blockquote>' + rich(b[1]) + '</blockquote>';
      if (b[0] === 'l') return '<p class="al-li">' + rich(b[1]) + '</p>';
      return '<p>' + rich(b[1]) + '</p>';
    }).join('');
    var share = 'https://wa.me/?text=' + encodeURIComponent('J’ai fait le test d’alignement de Lamine Diabaté : 12 questions, 2 minutes. Fais-le, tu verras où tu en es : ' + location.origin + '/alignement?depuis=partage');
    $('result').innerHTML =
      '<p class="al-sur">Ton Indice d’Alignement</p>' +
      '<h1>' + esc(prenom) + ', ' + esc(v.title.charAt(0).toLowerCase() + v.title.slice(1)) + '.</h1>' +
      '<div class="al-meters">' + bars + '</div>' +
      v.text.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
      (v.note ? '<p class="al-note">' + esc(v.note) + '</p>' : '') +
      '<article class="al-ex"><p class="al-ex-sur">Ton exercice offert, tiré du livre (' + esc(ex.chapter) + ')</p><h2>' + esc(ex.title) + '</h2>' + blocks +
        '<p class="al-ex-end">Fais-le aujourd’hui, pas «&nbsp;quand tu auras le temps&nbsp;». Tu le retrouves aussi dans ta boîte e-mail.</p></article>' +
      '<div class="al-book"><img src="/public/ebooks/esprit-aligne/couverture.jpg" alt="Couverture : Le Pouvoir d’un Esprit Aligné" width="120" height="170" loading="lazy">' +
        '<div><p class="al-book-t">Le Pouvoir d’un Esprit Aligné</p><p>' + esc(v.further) + '</p>' +
        '<p class="al-book-m">9 chapitres, 9 exercices, 106 pages. 5&nbsp;000&nbsp;F en PDF, à télécharger juste après le paiement.</p>' +
        '<a class="btn btn-primary" href="/ebook/esprit-aligne?depuis=test-resultat">Découvrir le livre</a></div></div>' +
      '<div class="al-after"><a class="btn btn-secondary" href="' + esc(share) + '" target="_blank" rel="noopener">Envoyer le test à un proche</a>' +
        '<button class="al-back" type="button" id="again">Refaire le test</button></div>';
    show('stResult');
    $('again').addEventListener('click', function () { answers = {}; pos = 0; order = shuffle(order); show('stIntro'); });
  }
})();
