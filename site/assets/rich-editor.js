/* Éditeur de description (administration), sur le modèle de celui de Chariow : Quill 2, servi par le site.
   DilamEditor.create(élément, html) renvoie { html(), text(), empty(), set(html) }.
   Images envoyées sur le site, vidéos YouTube, couleurs du site en premier, polices du site puis trois autres. */
(function () {
  'use strict';
  if (!window.Quill) return;
  var SITE_COLORS = ['#13201A', '#16130F', '#127A4B', '#0D3B2E', '#D9771F', '#B3261E', '#5B655F'];
  var MORE = ['#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff', '#bbbbbb', '#f06666', '#ffc266', '#ffff66', '#66b966', '#66a3e0', '#c285ff', '#888888', '#a10000', '#b26b00', '#b2b200', '#006100', '#0047b2', '#6b24b2', '#444444', '#5c0000', '#663d00', '#666600', '#003700', '#002966', '#3d1466'];
  var BG_SITE = ['#F2ECE1', '#F4F5F1', '#E6E9E3', '#E3F1E8', '#FCE9D6', '#F9DEDC', '#16130F'];
  var FONTS = ['literata', 'onest', 'playfair', 'montserrat', 'lora'];

  // Vidéo envoyée depuis le téléphone (MP4 ou WebM, 20 Mo au plus), lue directement dans la page.
  var BlockEmbed = Quill.import('blots/block/embed');
  class Mp4 extends BlockEmbed {
    static create(value) {
      var n = super.create();
      n.setAttribute('src', value);
      n.setAttribute('controls', '');
      n.setAttribute('playsinline', '');
      n.setAttribute('preload', 'metadata');
      return n;
    }
    static value(n) { return n.getAttribute('src'); }
  }
  Mp4.blotName = 'mp4';
  Mp4.tagName = 'video';
  Mp4.className = 'ql-mp4';
  Quill.register(Mp4, true);
  Quill.import('ui/icons').mp4 = '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="2" y="4" width="10" height="10" rx="1.5"></rect><polygon class="ql-fill" points="12 8 16 5.5 16 12.5 12 10"></polygon><polyline class="ql-stroke" points="7 11.5 7 6.5"></polyline><polyline class="ql-stroke" points="5 8.5 7 6.5 9 8.5"></polyline></svg>';
  var MAX_VID = 20 * 1024 * 1024;

  var Font = Quill.import('attributors/class/font');
  Font.whitelist = FONTS;
  Quill.register(Font, true);

  // Libellés en français et aperçu des polices dans la liste.
  var css = [
    '.dil-ed{margin-top:6px;border-radius:10px;overflow:hidden;background:#fff}',
    '.dil-ed .ql-toolbar.ql-snow{border:0;border-bottom:1px solid #DCDFD8;background:#fff;font-family:Onest,system-ui,sans-serif}',
    '.dil-ed .ql-container.ql-snow{border:0;background:#fff;color:#13201A;font-family:Onest,system-ui,sans-serif;font-size:16px}',
    '.dil-ed .ql-editor{min-height:220px;max-height:70vh;overflow:auto;line-height:1.6}',
    '.dil-ed .ql-editor.ql-blank::before{color:#8A938D;font-style:normal}',
    '.dil-ed .ql-editor img{max-width:100%;height:auto}',
    // Les pages d'administration colorent leurs titres en blanc : dans l'éditeur, le texte reste foncé sur fond blanc.
    '.dil-ed .ql-editor h1,.dil-ed .ql-editor h2,.dil-ed .ql-editor h3{color:#13201A;margin:.4em 0 .2em;font-family:Literata,Georgia,serif;font-weight:500}',
    '.dil-ed .ql-editor a{color:#127A4B}',
    '.dil-ed .ql-editor .ql-video{width:100%;aspect-ratio:16/9;height:auto}',
    '.dil-ed .ql-editor video.ql-mp4{display:block;width:100%;max-height:60vh;border-radius:8px;background:#000}',
    '.dil-ed .dil-st{padding:6px 12px;font-size:13.5px;color:#13201A;background:#F4F5F1;border-top:1px solid #DCDFD8}',
    '.ql-snow .ql-picker.ql-header .ql-picker-label::before,.ql-snow .ql-picker.ql-header .ql-picker-item::before{content:"Texte"}',
    '.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="1"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before{content:"Titre 1"}',
    '.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="2"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before{content:"Titre 2"}',
    '.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="3"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before{content:"Titre 3"}',
    '.ql-snow .ql-picker.ql-size .ql-picker-label::before,.ql-snow .ql-picker.ql-size .ql-picker-item::before{content:"Taille"}',
    '.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=small]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=small]::before{content:"Petit"}',
    '.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=large]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=large]::before{content:"Grand"}',
    '.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=huge]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=huge]::before{content:"Très grand"}',
    '.ql-snow .ql-picker.ql-font{width:128px}',
    '.ql-snow .ql-picker.ql-font .ql-picker-label::before,.ql-snow .ql-picker.ql-font .ql-picker-item::before{content:"Police du site"}',
    '.ql-snow .ql-picker.ql-font [data-value=literata]::before{content:"Literata";font-family:Literata,Georgia,serif}',
    '.ql-snow .ql-picker.ql-font [data-value=onest]::before{content:"Onest";font-family:Onest,sans-serif}',
    '.ql-snow .ql-picker.ql-font [data-value=playfair]::before{content:"Playfair";font-family:"Playfair Display",Georgia,serif}',
    '.ql-snow .ql-picker.ql-font [data-value=montserrat]::before{content:"Montserrat";font-family:Montserrat,sans-serif}',
    '.ql-snow .ql-picker.ql-font [data-value=lora]::before{content:"Lora";font-family:Lora,Georgia,serif}',
    // Couleurs du site : la première ligne, entourée.
    '.ql-snow .ql-color-picker .ql-picker-item:nth-child(-n+7){outline:2px solid #127A4B;outline-offset:1px;margin-bottom:6px}',
    '.ql-snow .ql-tooltip::before{content:"Ouvrir :"}',
    '.ql-snow .ql-tooltip a.ql-action::after{content:"Modifier"}',
    '.ql-snow .ql-tooltip a.ql-remove::before{content:"Retirer"}',
    '.ql-snow .ql-tooltip.ql-editing a.ql-action::after{content:"Enregistrer"}',
    '.ql-snow .ql-tooltip[data-mode=link]::before{content:"Adresse du lien :"}',
    '.ql-editor .ql-font-literata{font-family:Literata,Georgia,serif}.ql-editor .ql-font-onest{font-family:Onest,sans-serif}',
    '.ql-editor .ql-font-playfair{font-family:"Playfair Display",Georgia,serif}.ql-editor .ql-font-montserrat{font-family:Montserrat,sans-serif}.ql-editor .ql-font-lora{font-family:Lora,Georgia,serif}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var gf = document.createElement('link'); gf.rel = 'stylesheet';
  gf.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&display=swap';
  document.head.appendChild(gf);

  function api(path, opt) { opt = opt || {}; opt.headers = Object.assign({ 'X-Dilam': '1' }, opt.headers || {}); opt.credentials = 'same-origin'; return fetch('/api' + path, opt); }
  // Image allégée avant l'envoi : 1 400 pixels de large au plus.
  function compress(file) {
    return new Promise(function (ok, ko) {
      if (file.type === 'image/gif') { ok(file); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, max = 1400;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) { b ? ok(b.size < file.size ? b : file) : ko(new Error('image')); }, 'image/jpeg', 0.84);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { ko(new Error('image')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function ytId(u) {
    var m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  // Texte simple (ancien champ) vers HTML : paragraphes, retours à la ligne et **gras**.
  function fromText(t) {
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    return String(t || '').split(/\n\s*\n+/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
      return '<p>' + esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function create(el, html, opts) {
    opts = opts || {};
    el.classList.add('dil-ed');
    var holder = document.createElement('div');
    el.appendChild(holder);
    var q = new Quill(holder, {
      theme: 'snow',
      placeholder: opts.placeholder || 'Écris ou colle ta description ici…',
      modules: {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }], [{ font: [false].concat(FONTS) }], [{ size: ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'], ['blockquote'],
            [{ color: SITE_COLORS.concat(MORE) }, { background: BG_SITE.concat(MORE) }],
            [{ align: [] }], [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image', 'mp4', 'video'], ['clean']
          ],
          handlers: {
            image: function () {
              var inp = document.createElement('input');
              inp.type = 'file'; inp.accept = 'image/*';
              inp.onchange = function () {
                var f = inp.files[0]; if (!f) return;
                var range = q.getSelection(true) || { index: q.getLength() };
                q.insertText(range.index, 'Envoi de l’image…', { italic: true }, 'user');
                compress(f).then(function (b) {
                  return api('/admin/upload', { method: 'POST', headers: { 'Content-Type': b.type || 'image/jpeg' }, body: b }).then(function (r) { return r.json(); });
                }).then(function (d) {
                  q.deleteText(range.index, 'Envoi de l’image…'.length, 'user');
                  if (!d.url) throw new Error('upload');
                  q.insertEmbed(range.index, 'image', d.url, 'user');
                  q.setSelection(range.index + 1, 0, 'silent');
                }).catch(function () {
                  q.deleteText(range.index, 'Envoi de l’image…'.length, 'user');
                  alert('L’image n’a pas pu être envoyée. Réessaie avec une autre image (10 Mo au plus).');
                });
              };
              inp.click();
            },
            mp4: function () {
              var inp = document.createElement('input');
              inp.type = 'file'; inp.accept = 'video/mp4,video/webm';
              inp.onchange = function () {
                var f = inp.files[0]; if (!f) return;
                if (!/^video\/(mp4|webm)$/.test(f.type)) { alert('Choisis une vidéo MP4 (le format habituel des téléphones).'); return; }
                if (f.size > MAX_VID) { alert('Cette vidéo fait ' + (f.size / 1048576).toFixed(1).replace('.', ',') + ' Mo : 20 Mo au plus. Raccourcis-la ou exporte-la en 720p dans CapCut, ou mets-la sur YouTube et utilise le bouton YouTube.'); return; }
                var range = q.getSelection(true) || { index: q.getLength() };
                var x = new XMLHttpRequest();
                x.open('POST', '/api/admin/video');
                x.withCredentials = true;
                x.setRequestHeader('X-Dilam', '1');
                x.setRequestHeader('Content-Type', f.type);
                x.upload.onprogress = function (ev) { if (ev.lengthComputable) status('Envoi de la vidéo : ' + Math.round(ev.loaded / ev.total * 100) + ' %'); };
                x.onload = function () {
                  var d = {}; try { d = JSON.parse(x.responseText); } catch (e) {}
                  if (x.status >= 200 && x.status < 300 && d.url) {
                    q.insertEmbed(range.index, 'mp4', d.url, 'user');
                    q.setSelection(range.index + 1, 0, 'silent');
                    status('Vidéo ajoutée. Pense à enregistrer.');
                  } else status('La vidéo n’a pas pu être envoyée (' + (d.error || x.status) + ').');
                };
                x.onerror = function () { status('Envoi impossible : vérifie ta connexion et réessaie.'); };
                status('Envoi de la vidéo : 0 %');
                x.send(f);
              };
              inp.click();
            },
            video: function () {
              var u = prompt('Colle le lien de la vidéo YouTube');
              if (!u) return;
              var id = ytId(u);
              if (!id) { alert('Ce lien n’est pas une vidéo YouTube. Exemple : https://youtu.be/abc123XYZ00'); return; }
              var range = q.getSelection(true) || { index: q.getLength() };
              q.insertEmbed(range.index, 'video', 'https://www.youtube-nocookie.com/embed/' + id, 'user');
              q.setSelection(range.index + 1, 0, 'silent');
            }
          }
        }
      }
    });
    var st = null;
    function status(t) {
      if (!st) { st = document.createElement('div'); st.className = 'dil-st'; el.appendChild(st); }
      st.textContent = t;
    }
    // Infobulles en français sur les boutons.
    var tb = el.querySelector('.ql-toolbar');
    [['.ql-image', 'Image'], ['.ql-mp4', 'Vidéo depuis ton téléphone (20 Mo au plus)'], ['.ql-video', 'Vidéo YouTube'], ['.ql-link', 'Lien'], ['.ql-clean', 'Retirer la mise en forme'], ['.ql-blockquote', 'Citation']].forEach(function (b) {
      var n = tb && tb.querySelector(b[0]); if (n) { n.title = b[1]; n.setAttribute('aria-label', b[1]); }
    });
    function set(h) {
      q.setContents([], 'silent');
      if (h) q.clipboard.dangerouslyPasteHTML(0, h, 'silent');
      q.history.clear();
    }
    set(html);
    return {
      quill: q,
      set: set,
      // Sans les marqueurs internes de Quill (puces de liste) : le site dessine lui-même les puces.
      html: function () { return this.empty() ? '' : q.root.innerHTML.replace(/<span class="ql-ui"[^>]*><\/span>/g, ''); },
      text: function () { return q.getText().replace(/\n{3,}/g, '\n\n').trim(); },
      empty: function () { return !q.getText().trim() && !q.root.querySelector('img, iframe, video'); }
    };
  }
  window.DilamEditor = { create: create, fromText: fromText };
})();
