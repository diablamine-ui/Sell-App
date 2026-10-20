"""Crée les versions légères (WebP) des images du catalogue.

Pour chaque image de site/public/images, deux fichiers dans site/public/images/opt/ :
  <nom>-400.webp  (400 px de large, pour les vignettes)
  <nom>-800.webp  (800 px au plus, pour la fiche du livre)
Les originaux restent en place : ils servent d'image de partage (Facebook, WhatsApp).
Relancer après l'ajout d'images dans le dossier : seuls les fichiers manquants sont créés.
"""
import os, sys
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'site', 'public', 'images')
OUT = os.path.join(SRC, 'opt')
os.makedirs(OUT, exist_ok=True)
done = 0
for name in sorted(os.listdir(SRC)):
    stem, ext = os.path.splitext(name)
    if ext.lower() not in ('.jpg', '.jpeg', '.png'):
        continue
    im = None
    for w in (400, 800):
        dst = os.path.join(OUT, f'{stem}-{w}.webp')
        if os.path.exists(dst) and '--force' not in sys.argv:
            continue
        if im is None:
            im = Image.open(os.path.join(SRC, name))
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            if im.mode == 'RGBA':
                bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3]); im = bg
        r = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(dst, 'WEBP', quality=80, method=6)
        done += 1
print(done, 'fichiers créés')
