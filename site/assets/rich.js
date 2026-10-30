/* Descriptions mises en forme (éditeur de l'administration) : nettoyage avant affichage.
   Seules les balises de mise en forme sont gardées ; tout le reste (scripts, styles collés, largeurs fixes) est retiré.
   Couleurs, polices, tailles et alignements choisis dans l'éditeur sont conservés. */
(function () {
  'use strict';
  var TAGS = { P: 1, BR: 1, H1: 1, H2: 1, H3: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, BLOCKQUOTE: 1, OL: 1, UL: 1, LI: 1, A: 1, IMG: 1, IFRAME: 1, VIDEO: 1, SPAN: 1, SUB: 1, SUP: 1 };
  var DROP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, LINK: 1, META: 1, SVG: 1, MATH: 1, NOSCRIPT: 1, TITLE: 1, AUDIO: 1, CANVAS: 1, SOURCE: 1, TRACK: 1 };
  var CLS = /^ql-(align-(center|right|justify)|font-(literata|onest|playfair|montserrat|lora)|size-(small|large|huge)|indent-[1-8]|video)$/;
  var COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;
  var YT = /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{11}(\?[A-Za-z0-9_=&;-]*)?$/;
  var FONTS = {
    playfair: 'Playfair+Display:ital,wght@0,400;0,700;1,400',
    montserrat: 'Montserrat:ital,wght@0,400;0,700;1,400',
    lora: 'Lora:ital,wght@0,400;0,700;1,400'
  };

  function cleanAttrs(el) {
    var tag = el.tagName;
    [].slice.call(el.attributes).forEach(function (a) {
      var n = a.name.toLowerCase(), v = a.value;
      if (n === 'class') {
        var keep = v.split(/\s+/).filter(function (c) { return CLS.test(c); });
        if (keep.length) el.setAttribute('class', keep.join(' ')); else el.removeAttribute('class');
        return;
      }
      if (n === 'style') {
        var out = [];
        v.split(';').forEach(function (d) {
          var i = d.indexOf(':'); if (i < 0) return;
          var p = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim();
          if ((p === 'color' || p === 'background-color') && COLOR.test(val)) out.push(p + ':' + val);
        });
        if (out.length) el.setAttribute('style', out.join(';')); else el.removeAttribute('style');
        return;
      }
      if (tag === 'A' && n === 'href' && /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(v.trim())) return;
      if (tag === 'IMG' && n === 'src' && /^(\/(media|public)\/|https:\/\/)/i.test(v.trim())) return;
      if (tag === 'IMG' && n === 'alt') return;
      if (tag === 'IFRAME' && n === 'src') return;
      if (tag === 'VIDEO' && n === 'src') return;
      if (tag === 'LI' && n === 'data-list' && /^(bullet|ordered)$/.test(v)) return;
      el.removeAttribute(a.name);
    });
    if (tag === 'A' && el.getAttribute('href')) {
      if (/^https?:/i.test(el.getAttribute('href'))) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    }
    if (tag === 'IMG') { el.setAttribute('loading', 'lazy'); el.setAttribute('decoding', 'async'); if (!el.hasAttribute('alt')) el.setAttribute('alt', ''); }
    if (tag === 'VIDEO') {
      el.setAttribute('class', 'ql-mp4');
      el.setAttribute('controls', '');
      el.setAttribute('playsinline', '');
      el.setAttribute('preload', 'metadata');
    }
    if (tag === 'IFRAME') {
      el.setAttribute('class', 'ql-video');
      el.setAttribute('allowfullscreen', '');
      el.setAttribute('loading', 'lazy');
      el.setAttribute('title', 'Vidéo');
    }
  }
  function walk(parent) {
    [].slice.call(parent.childNodes).forEach(function (n) {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1) { n.remove(); return; }
      var tag = n.tagName.toUpperCase();
      if (DROP[tag]) { n.remove(); return; }
      if (tag === 'IFRAME' && !YT.test(n.getAttribute('src') || '')) { n.remove(); return; }
      if (tag === 'IMG' && !/^(\/(media|public)\/|https:\/\/)/i.test((n.getAttribute('src') || '').trim())) { n.remove(); return; }
      // Vidéos : seulement celles envoyées sur le site.
      if (tag === 'VIDEO' && !/^\/media\/vid\/[A-Za-z0-9._-]+$/.test((n.getAttribute('src') || '').trim())) { n.remove(); return; }
      walk(n);
      if (!TAGS[tag]) {
        // Balise inconnue (div, font, table…) : on garde son contenu, sans elle.
        while (n.firstChild) parent.insertBefore(n.firstChild, n);
        n.remove();
        return;
      }
      cleanAttrs(n);
    });
  }
  function sanitize(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '');
    walk(t.content);
    return t.innerHTML;
  }
  var loaded = {};
  function loadFonts(html) {
    var need = Object.keys(FONTS).filter(function (k) { return !loaded[k] && html.indexOf('ql-font-' + k) > -1; });
    if (!need.length) return;
    need.forEach(function (k) { loaded[k] = 1; });
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + need.map(function (k) { return 'family=' + FONTS[k]; }).join('&') + '&display=swap';
    document.head.appendChild(l);
  }
  function render(html) {
    var s = sanitize(html);
    loadFonts(s);
    return s;
  }
  // Vrai si la description contient autre chose que des lignes vides.
  function hasContent(html) {
    if (!html) return false;
    var t = document.createElement('template');
    t.innerHTML = String(html);
    return !!(t.content.textContent.trim() || t.content.querySelector('img, iframe, video'));
  }
  window.DilamRich = { sanitize: sanitize, render: render, hasContent: hasContent };
})();
