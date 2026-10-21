# Marque « EXTRAIT » en rouge, en diagonale, sur les pages d'aperçu des ebooks (comme Chariow).
# Le texte du livre reste lisible dessous : rouge transparent, un seul mot par page.
#
# Les originaux sans marque sont gardés hors du site, dans tools/apercus-originaux/ (jamais publiés),
# pour pouvoir relancer le script sans empiler deux marques.
#
#   python3 tools/stamp_extract.py site/public/ebooks/esprit-aligne/apercus/page_13.jpg ...
import math
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
RED = (214, 40, 40)
ALPHA = 92          # sur 255 : environ 36 % d'opacité
WORD = 'EXTRAIT'


def stamp(path):
    rel = os.path.normpath(path).split('site/public/ebooks/', 1)
    if len(rel) != 2:
        raise SystemExit('Chemin attendu sous site/public/ebooks/ : ' + path)
    original = os.path.join(os.path.dirname(__file__), 'apercus-originaux', rel[1])
    os.makedirs(os.path.dirname(original), exist_ok=True)
    if not os.path.exists(original):
        shutil.copy2(path, original)

    page = Image.open(original).convert('RGB')
    w, h = page.size
    # Taille de départ généreuse, ajustée ensuite pour tenir dans la page.
    diag = (w * w + h * h) ** 0.5
    size = 40
    font = ImageFont.truetype(FONT, size)
    while True:
        box = font.getbbox(WORD)
        tw = box[2] - box[0] + size * 0.12 * (len(WORD) - 1)
        if tw > diag * 0.8:
            break
        size += 4
        font = ImageFont.truetype(FONT, size)

    spacing = size * 0.12
    widths = [font.getlength(c) for c in WORD]
    total = sum(widths) + spacing * (len(WORD) - 1)
    asc, desc = font.getmetrics()
    layer = Image.new('RGBA', (int(total) + 20, asc + desc + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = 10
    for c, cw in zip(WORD, widths):
        d.text((x, 10), c, font=font, fill=RED + (ALPHA,))
        x += cw + spacing
    # Le mot suit la diagonale de la page, du bas à gauche vers le haut à droite.
    angle = max(25, min(55, math.degrees(math.atan2(h, w))))
    layer = layer.rotate(angle, expand=True, resample=Image.BICUBIC)
    # Il doit tenir entièrement dans la page, avec une marge.
    k = min(1, 0.86 * w / layer.width, 0.86 * h / layer.height)
    if k < 1:
        layer = layer.resize((int(layer.width * k), int(layer.height * k)), Image.LANCZOS)

    canvas = page.convert('RGBA')
    canvas.alpha_composite(layer, ((w - layer.width) // 2, (h - layer.height) // 2))
    canvas.convert('RGB').save(path, 'JPEG', quality=84, optimize=True, progressive=True)
    print('marqué', path)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        stamp(p)
