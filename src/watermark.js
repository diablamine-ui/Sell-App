// Filigrane des PDF livrés : « Exemplaire personnel de <e-mail>. Merci de ne pas le diffuser. » en bas de chaque page.
// Méthode : mise à jour incrémentale (on ajoute quelques objets à la fin du fichier, sans le réécrire).
// Le texte est dessiné en tracés vectoriels : aucune police à ajouter au PDF.
// L'index (pages, xref) est calculé une seule fois au dépôt du fichier, le filigrane coûte ensuite quelques millisecondes.
import { UPM, GLYPHS } from './glyphs.js';

function latin1(bytes, a, b) {
  let s = '';
  for (let i = a; i < b; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(b, i + 8192)));
  return s;
}
function toBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
}
function indexOfBytes(bytes, pat, from) {
  const p = toBytes(pat);
  outer: for (let i = from; i <= bytes.length - p.length; i++) {
    for (let j = 0; j < p.length; j++) if (bytes[i + j] !== p[j]) continue outer;
    return i;
  }
  return -1;
}

export function indexPdf(bytes) {
  const len = bytes.length;
  const tail = latin1(bytes, Math.max(0, len - 1024), len);
  const sx = tail.lastIndexOf('startxref');
  if (sx < 0) throw new Error('startxref');
  const startxref = parseInt(tail.slice(sx + 9).trim(), 10);
  const offsets = {};
  let trailer = null;
  let at = startxref;
  const seen = new Set();
  while (at && !seen.has(at)) {
    seen.add(at);
    const tEnd = indexOfBytes(bytes, 'trailer', at);
    if (tEnd < 0 || latin1(bytes, at, at + 4) !== 'xref') throw new Error('xref'); // flux xref compressé : non géré
    const lines = latin1(bytes, at + 4, tEnd).split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
    let cur = 0, left = 0;
    for (const l of lines) {
      const m = l.match(/^(\d+)\s+(\d+)$/);
      if (m && left === 0) { cur = +m[1]; left = +m[2]; continue; }
      const e = l.match(/^(\d{10})\s+(\d{5})\s+([nf])/);
      if (e) { if (e[3] === 'n' && !(cur in offsets)) offsets[cur] = [+e[1], +e[2]]; cur++; left--; }
    }
    const trEnd = indexOfBytes(bytes, 'startxref', tEnd);
    const tr = latin1(bytes, tEnd, trEnd < 0 ? Math.min(len, tEnd + 2000) : trEnd);
    if (!trailer) trailer = tr;
    const prev = tr.match(/\/Prev\s+(\d+)/);
    at = prev ? +prev[1] : 0;
  }
  const getObj = (n) => {
    const o = offsets[n];
    if (!o) throw new Error('obj ' + n);
    const end = indexOfBytes(bytes, 'endobj', o[0]);
    const txt = latin1(bytes, o[0], end);
    const a = txt.indexOf('<<'), b = txt.lastIndexOf('>>');
    return { gen: o[1], dict: txt.slice(a + 2, b) };
  };
  const ref = (s, key) => { const m = s.match(new RegExp('/' + key + '\\s+(\\d+)\\s+(\\d+)\\s+R')); return m ? +m[1] : null; };
  const box = (d) => { const m = d.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/); return m ? [+m[1], +m[2], +m[3], +m[4]] : null; };
  const root = ref(trailer, 'Root');
  const info = ref(trailer, 'Info');
  const size = +(trailer.match(/\/Size\s+(\d+)/) || [])[1];
  const id = (trailer.match(/\/ID\s*\[\s*<([0-9a-fA-F]+)>/) || [])[1] || '';
  const pages = [];
  const walk = (n, inherited, depth) => {
    if (depth > 30) throw new Error('arbre');
    const o = getObj(n);
    const mb = box(o.dict) || inherited;
    if (/\/Type\s*\/Pages\b/.test(o.dict)) {
      const kids = (o.dict.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
      for (const k of kids.matchAll(/(\d+)\s+(\d+)\s+R/g)) walk(+k[1], mb, depth + 1);
    } else {
      pages.push({ n, g: o.gen, dict: o.dict, box: mb || [0, 0, 595.28, 841.89] });
    }
  };
  walk(ref(getObj(root).dict, 'Pages'), null, 0);
  if (!pages.length || !size) throw new Error('pages');
  return { v: 1, len, size, startxref, root, info, id, pages };
}

function textPath(text, pt, x0, y0, gray = 0.6) {
  const s = pt / UPM;
  let ops = `q ${gray} g ${s.toFixed(6)} 0 0 ${s.toFixed(6)} ${x0.toFixed(2)} ${y0.toFixed(2)} cm\n`;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    if (g[1]) {
      ops += g[1].replace(/([MLCZ])([^MLCZ]*)/g, (_, op, args) =>
        (args.trim() ? args.trim() + ' ' : '') + ({ M: 'm', L: 'l', C: 'c', Z: 'h' }[op]) + '\n') + 'f\n';
    }
    ops += `1 0 0 1 ${g[0]} 0 cm\n`;
  }
  return ops + 'Q\n';
}
function textWidth(text, pt) {
  let w = 0;
  for (const ch of text) if (GLYPHS[ch]) w += GLYPHS[ch][0];
  return (w * pt) / UPM;
}

// Renvoie les octets à ajouter à la fin du PDF d'origine.
export function stampTail(idx, label, opts = {}) {
  const skip = opts.skipFirst ? 1 : 0;
  const fontSize = opts.size || 6.5;
  const gray = opts.gray == null ? 0.6 : opts.gray;
  const text = [...label].filter((c) => GLYPHS[c]).join('');
  let next = idx.size;
  const objs = [];
  const add = (n, g, body) => objs.push({ n, g, body });
  const stream = (data) => `<< /Length ${data.length} >>\nstream\n${data}\nendstream`;
  const qObj = next++, QObj = next++;
  add(qObj, 0, stream('q'));
  add(QObj, 0, stream('Q'));
  const stamps = {};
  idx.pages.forEach((p, i) => {
    if (i < skip) return;
    const [x1, y1, x2] = p.box;
    const key = `${x1},${y1},${x2}`;
    if (!stamps[key]) {
      stamps[key] = next++;
      // Taille demandée, réduite si la ligne (adresse longue) dépasse la largeur de la page.
      const pt = Math.min(fontSize, (x2 - x1 - 60) / textWidth(text, 1));
      const w = textWidth(text, pt);
      add(stamps[key], 0, stream(textPath(text, pt, x1 + (x2 - x1 - w) / 2, y1 + 14, gray)));
    }
    let d = p.dict;
    const m = d.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/);
    const orig = m ? m[1].replace(/^\[|\]$/g, '').trim() : '';
    const contents = `/Contents [ ${qObj} 0 R ${orig} ${QObj} 0 R ${stamps[key]} 0 R ]`;
    d = m ? d.replace(m[0], contents) : d + '\n' + contents;
    add(p.n, p.g, `<<${d}>>`);
  });
  let body = '\n';
  const base = idx.len;
  const xref = [];
  for (const o of objs) {
    xref.push([o.n, o.g, base + body.length]);
    body += `${o.n} ${o.g} obj\n${o.body}\nendobj\n`;
  }
  const xrefAt = base + body.length;
  body += 'xref\n';
  for (const [n, g, off] of xref.sort((a, b) => a[0] - b[0])) {
    body += `${n} 1\n${String(off).padStart(10, '0')} ${String(g).padStart(5, '0')} n\r\n`;
  }
  const size = Math.max(idx.size, next);
  const id = idx.id || '00000000000000000000000000000000';
  body += `trailer\n<< /Size ${size} /Root ${idx.root} 0 R${idx.info ? ` /Info ${idx.info} 0 R` : ''} /ID [<${id}> <${id}>] /Prev ${idx.startxref} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return toBytes(body);
}
