# Génère src/glyphs.js : contours vectoriels des caractères du filigrane (police Inter Medium).
# Le filigrane est dessiné en tracés, sans police à intégrer au PDF.
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
import json
f = TTFont('/usr/share/fonts/opentype/inter/Inter-Medium.otf')
gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
chars = "abcdefghijklmnopqrstuvwxyz0123456789.-_+@%'E :"
out = {}
for ch in chars:
    gn = cmap[ord(ch)]; g = gs[gn]; pen = RecordingPen(); g.draw(pen)
    ops = []
    for op, pts in pen.value:
        if op == 'moveTo': ops.append('M%d %d' % pts[0])
        elif op == 'lineTo': ops.append('L%d %d' % pts[0])
        elif op == 'curveTo': ops.append('C' + ' '.join('%d %d' % p for p in pts))
        elif op == 'qCurveTo':
            raise SystemExit('quadratic not expected')
        elif op in ('closePath', 'endPath'): ops.append('Z')
    out[ch] = [round(g.width), ''.join(ops)]
open('src/glyphs.js', 'w').write('// Généré par tools/glyphs.py (Inter Medium, %d unités par em).\nexport const UPM = %d;\nexport const GLYPHS = %s;\n' % (upm, upm, json.dumps(out, separators=(',', ':'))))
print(len(out), 'glyphes', len(open('src/glyphs.js').read()), 'octets')
