/* Administration : choix des pages d'extrait d'un PDF déposé.
   Le PDF est relu dans le navigateur (pdf.js), les pages choisies sont dessinées avec la mention EXTRAIT
   en rouge, en diagonale, puis envoyées comme images. Seules ces images deviennent publiques.
   DilamExtract.open({ slug, i, title, pages, onSave(urls, pages) }) */
(function () {
  'use strict';
  var lib = null;
  var MAX = 6, WIDTH = 1000;
  function load() {
    if (lib) return Promise.resolve(lib);
    return import('/assets/vendor/pdfjs/pdf.min.mjs').then(function (m) {
      m.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
      lib = m;
      return m;
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Même marque que les aperçus d'Esprit Aligné : « EXTRAIT » rouge, transparent, en diagonale.
  function stamp(cv) {
    var x = cv.getContext('2d'), w = cv.width, h = cv.height, word = 'EXTRAIT';
    var angle = Math.max(25, Math.min(55, Math.atan2(h, w) * 180 / Math.PI)) * Math.PI / 180;
    var size = 40, sp;
    function width(sz) { x.font = '700 ' + sz + 'px Onest, Arial, sans-serif'; sp = sz * 0.12; return x.measureText(word).width + sp * (word.length - 1); }
    var diag = Math.sqrt(w * w + h * h);
    while (width(size + 4) < diag * 0.8) size += 4;
    var tw = width(size);
    // Le mot entier doit tenir dans la page, avec une marge.
    var bw = Math.abs(tw * Math.cos(angle)) + Math.abs(size * Math.sin(angle));
    var bh = Math.abs(tw * Math.sin(angle)) + Math.abs(size * Math.cos(angle));
    var k = Math.min(1, 0.86 * w / bw, 0.86 * h / bh);
    if (k < 1) { size = Math.floor(size * k); tw = width(size); }
    x.save();
    x.translate(w / 2, h / 2);
    x.rotate(-angle);
    x.fillStyle = 'rgba(214, 40, 40, 0.36)';
    x.textBaseline = 'middle';
    var cx = -tw / 2;
    for (var j = 0; j < word.length; j++) {
      x.fillText(word[j], cx, 0);
      cx += x.measureText(word[j]).width + sp;
    }
    x.restore();
  }
  function render(doc, n) {
    return doc.getPage(n).then(function (page) {
      var v1 = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: WIDTH / v1.width });
      var cv = document.createElement('canvas');
      cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () { stamp(cv); return cv; });
    });
  }
  function upload(cv) {
    return new Promise(function (ok, ko) {
      cv.toBlob(function (b) {
        if (!b) { ko(new Error('image')); return; }
        fetch('/api/admin/upload', { method: 'POST', credentials: 'same-origin', headers: { 'X-Dilam': '1', 'Content-Type': 'image/jpeg' }, body: b })
          .then(function (r) { return r.json(); }).then(function (d) { d.url ? ok(d.url) : ko(new Error(d.error || 'upload')); }, ko);
      }, 'image/jpeg', 0.84);
    });
  }

  var css = '.dx{position:fixed;inset:0;z-index:9999;background:rgba(5,10,8,.82);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}' +
    '.dx-box{width:100%;max-width:720px;background:#1E2622;color:#E9EEEA;border-radius:14px;padding:16px;margin:auto 0;font-family:Onest,system-ui,sans-serif}' +
    '.dx-box h3{color:#fff;font-size:18px;margin:0 30px 6px 0;line-height:1.3}' +
    '.dx-x{position:absolute;right:22px;top:22px;width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#13201A;font-size:22px;cursor:pointer}' +
    '.dx-row{display:flex;gap:8px;margin-top:12px}.dx-row input{flex:1;min-height:46px;padding:0 12px;border-radius:10px;border:1px solid #34403A;background:#111714;color:#fff;font-size:16px}' +
    '.dx-b{min-height:46px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#13201A;font-weight:700;font-size:15px;cursor:pointer}.dx-b[disabled]{opacity:.5}' +
    '.dx-b.alt{background:transparent;color:#9FD8B9;border:1px solid #9FD8B9}.dx-b.ko{background:transparent;color:#F0B27A;border:1px solid #F0B27A}' +
    '.dx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:14px}' +
    '.dx-grid figure{margin:0;background:#fff;border-radius:6px;overflow:hidden}.dx-grid canvas,.dx-grid img{display:block;width:100%;height:auto}' +
    '.dx-grid figcaption{background:#111714;color:#C9D3CD;font-size:13px;padding:4px 8px}' +
    '.dx-msg{display:block;margin-top:10px;color:#C9D3CD;font-size:14px}.dx-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}' +
    '.dx-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:12px;max-height:56vh;overflow:auto;padding:2px}' +
    '.dx-t{position:relative;padding:0;border:3px solid transparent;border-radius:6px;background:#fff;cursor:pointer;aspect-ratio:1/1.414;overflow:hidden}' +
    '.dx-t canvas{display:block;width:100%;height:auto}.dx-t .n{position:absolute;left:0;right:0;bottom:0;background:rgba(17,23,20,.85);color:#fff;font-size:12px;padding:2px 0;text-align:center}' +
    '.dx-t.on{border-color:#9FD8B9}.dx-t .k{display:none;position:absolute;right:4px;top:4px;width:24px;height:24px;border-radius:50%;background:#127A4B;color:#fff;font-size:13px;font-weight:700;line-height:24px;text-align:center}.dx-t.on .k{display:block}' +
    '.dx-sticky{position:sticky;bottom:-16px;background:#1E2622;padding:10px 0 4px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function open(o) {
    var wrap = document.createElement('div');
    wrap.className = 'dx';
    wrap.innerHTML = '<div class="dx-box" role="dialog" aria-modal="true" aria-label="Pages d’extrait"><button class="dx-x" type="button" aria-label="Fermer">×</button>' +
      '<h3>Pages d’extrait : ' + esc(o.title || 'PDF') + '</h3>' +
      '<small class="dx-msg" data-m>Chargement du PDF…</small>' +
      '<div class="dx-thumbs" data-t></div>' +
      '<div class="dx-sticky"><button class="dx-b" type="button" data-show disabled>Voir l’aperçu</button></div>' +
      '<div class="dx-grid" data-g>' + (o.existing || []).map(function (u, k) { return '<figure><img src="' + esc(u) + '" alt=""><figcaption>Extrait actuel ' + (k + 1) + '</figcaption></figure>'; }).join('') + '</div>' +
      '<div class="dx-act"><button class="dx-b" type="button" data-save disabled>Enregistrer ces pages</button>' +
      ((o.existing || []).length ? '<button class="dx-b ko" type="button" data-clear>Retirer les extraits</button>' : '') +
      '<button class="dx-b alt" type="button" data-close>Fermer</button></div></div>';
    document.body.appendChild(wrap);
    document.documentElement.style.overflow = 'hidden';
    var q = function (s) { return wrap.querySelector(s); };
    var msg = q('[data-m]'), doc = null, canvases = [], chosen = [];
    function close() { wrap.remove(); document.documentElement.style.overflow = ''; }
    q('.dx-x').onclick = close; q('[data-close]').onclick = close;

    Promise.all([load(), fetch('/api/admin/pdf/file?slug=' + encodeURIComponent(o.slug) + '&i=' + (o.i || 0), { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? 'Le PDF n’est pas encore déposé.' : 'PDF illisible (' + r.status + ').');
      return r.arrayBuffer();
    }), document.fonts ? document.fonts.load('700 100px Onest') : null]).then(function (res) {
      return res[0].getDocument({ data: new Uint8Array(res[1]), isEvalSupported: false }).promise;
    }).then(function (d) {
      doc = d;
      msg.textContent = 'Ce PDF a ' + d.numPages + ' pages. Touche les pages à montrer, jusqu’à ' + MAX + ' (le sommaire compte comme une page).';
      thumbs();
    }).catch(function (e) { msg.textContent = e.message || 'Le PDF n’a pas pu être ouvert.'; });

    // Toutes les pages en miniature : on coche celles qui nous intéressent.
    var picked = (o.pages || []).slice(0, MAX);
    function refresh() {
      wrap.querySelectorAll('.dx-t').forEach(function (b) {
        var n = +b.getAttribute('data-n'), k = picked.indexOf(n);
        b.classList.toggle('on', k > -1);
        b.setAttribute('aria-pressed', k > -1 ? 'true' : 'false');
      });
      var sorted = picked.slice().sort(function (a, b) { return a - b; });
      wrap.querySelectorAll('.dx-t.on .k').forEach(function (el) { el.textContent = sorted.indexOf(+el.parentNode.getAttribute('data-n')) + 1; });
      q('[data-show]').disabled = !picked.length;
      q('[data-show]').textContent = picked.length ? 'Voir l’aperçu (' + picked.length + ' page' + (picked.length > 1 ? 's' : '') + ')' : 'Voir l’aperçu';
    }
    function thumbs() {
      var t = q('[data-t]'), html = '';
      for (var n = 1; n <= doc.numPages; n++) html += '<button type="button" class="dx-t" data-n="' + n + '" aria-label="Page ' + n + '"><canvas></canvas><span class="k"></span><span class="n">' + n + '</span></button>';
      t.innerHTML = html;
      var queue = [], busy = false;
      function next() {
        if (busy || !queue.length) return;
        busy = true;
        var b = queue.shift(), n = +b.getAttribute('data-n');
        doc.getPage(n).then(function (page) {
          var v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 200 / v1.width });
          var cv = b.querySelector('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        }).catch(function () {}).then(function () { busy = false; next(); });
      }
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); } });
        next();
      }, { root: t, rootMargin: '200px' });
      t.querySelectorAll('.dx-t').forEach(function (b) { io.observe(b); });
      t.addEventListener('click', function (e) {
        var b = e.target.closest('.dx-t'); if (!b) return;
        var n = +b.getAttribute('data-n'), k = picked.indexOf(n);
        if (k > -1) picked.splice(k, 1);
        else if (picked.length >= MAX) { msg.textContent = MAX + ' pages au plus : retire d’abord une page cochée.'; return; }
        else picked.push(n);
        refresh();
      });
      refresh();
      var first = picked.length ? t.querySelector('[data-n="' + Math.min.apply(null, picked) + '"]') : null;
      if (first) first.scrollIntoView({ block: 'center' });
    }

    q('[data-show]').onclick = function () {
      chosen = picked.slice().sort(function (a, b) { return a - b; });
      if (!chosen.length) return;
      msg.textContent = 'Préparation des pages…';
      q('[data-save]').disabled = true;
      var g = q('[data-g]'); g.innerHTML = '';
      canvases = [];
      chosen.reduce(function (pr, n) {
        return pr.then(function () {
          return render(doc, n).then(function (cv) {
            canvases.push(cv);
            var f = document.createElement('figure');
            f.appendChild(cv);
            var c = document.createElement('figcaption'); c.textContent = 'Page ' + n; f.appendChild(c);
            g.appendChild(f);
          });
        });
      }, Promise.resolve()).then(function () {
        msg.textContent = 'Voici l’aperçu tel qu’il apparaîtra sur la page. Change ta sélection si besoin, ou enregistre.';
        q('[data-g]').scrollIntoView({ block: 'start', behavior: 'smooth' });
        q('[data-save]').disabled = false;
      }).catch(function () { msg.textContent = 'Une page n’a pas pu être affichée. Essaie d’autres numéros.'; });
    };
    q('[data-save]').onclick = function () {
      var b = this; b.disabled = true;
      var urls = [];
      msg.textContent = 'Envoi des pages…';
      canvases.reduce(function (pr, cv, k) {
        return pr.then(function () { msg.textContent = 'Envoi de la page ' + (k + 1) + ' sur ' + canvases.length + '…'; return upload(cv).then(function (u) { urls.push(u); }); });
      }, Promise.resolve()).then(function () {
        return o.onSave(urls, chosen);
      }).then(function () { close(); }).catch(function () { b.disabled = false; msg.textContent = 'L’envoi a échoué. Vérifie ta connexion et réessaie.'; });
    };
    var cl = q('[data-clear]');
    if (cl) cl.onclick = function () {
      if (!confirm('Retirer les pages d’extrait de ce fichier ?')) return;
      Promise.resolve(o.onSave([], [])).then(close);
    };
  }
  window.DilamExtract = { open: open };
})();
