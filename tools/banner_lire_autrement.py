# Bannière « Lire Autrement » : téléphone montrant la couverture, deux pages du livre en éventail derrière.
import sys
from PIL import Image, ImageDraw, ImageFilter
S=2  # suréchantillonnage
W,H=1200*S,900*S
EB='/home/claude/sell-app/site/public/ebooks/lire-autrement/'
out=sys.argv[1]

# Fond : vert très sombre, léger halo clair au centre
bg=Image.new('RGB',(W,H),(12,22,18))
glow=Image.new('L',(W,H),0); g=ImageDraw.Draw(glow)
g.ellipse([W*0.18,H*0.02,W*0.86,H*1.02],fill=255)
glow=glow.filter(ImageFilter.GaussianBlur(220*S))
light=Image.new('RGB',(W,H),(38,60,51))
bg=Image.composite(light,bg,glow)

def shadow(size,radius,blur,alpha):
    m=Image.new('L',size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,size[0]-1,size[1]-1],radius=radius,fill=alpha)
    pad=blur*3; big=Image.new('L',(size[0]+pad*2,size[1]+pad*2),0); big.paste(m,(pad,pad))
    return big.filter(ImageFilter.GaussianBlur(blur)),pad

def sheet(path,w,angle,cx,cy):
    p=Image.open(path).convert('RGB'); h=round(p.height*w/p.width); p=p.resize((w,h),Image.LANCZOS)
    card=Image.new('RGBA',(w,h)); card.paste(p,(0,0))
    sh,pad=shadow((w,h),4*S,26*S,150)
    shr=sh.rotate(angle,resample=Image.BICUBIC,expand=True)
    cr=card.rotate(angle,resample=Image.BICUBIC,expand=True)
    bg.paste((0,0,0),(int(cx-shr.width/2+10*S),int(cy-shr.height/2+24*S)),shr)
    bg.paste(cr,(int(cx-cr.width/2),int(cy-cr.height/2)),cr)

# Pages intérieures en éventail
sheet(EB+'apercus/page_33.jpg',330*S,9,W*0.70,H*0.50)
sheet(EB+'apercus/page_7.jpg',330*S,-9,W*0.31,H*0.50)

# Téléphone
pw,ph=360*S,740*S; px,py=int(W/2-pw/2),int(H/2-ph/2)+10*S
sh,pad=shadow((pw,ph),56*S,40*S,190)
bg.paste((0,0,0),(px-pad+6*S,py-pad+34*S),sh)
body=Image.new('RGBA',(pw,ph),(0,0,0,0)); d=ImageDraw.Draw(body)
d.rounded_rectangle([0,0,pw-1,ph-1],radius=56*S,fill=(24,26,25,255))
d.rounded_rectangle([3*S,3*S,pw-4*S,ph-4*S],radius=53*S,outline=(70,76,72,255),width=2*S)
sx,sy=14*S,14*S; sw,sh_=pw-28*S,ph-28*S
cov=Image.open(EB+'couverture.jpg').convert('RGB')
# la couverture entière, en largeur, sur le noir de l'écran (le fond de la couverture est noir)
r=sw/cov.width; c2=cov.resize((sw,round(cov.height*r)),Image.LANCZOS)
top=(sh_-c2.height)//2
cv=Image.new('RGB',(sw,sh_))
# bandes du haut et du bas : prolongement flou du bord de la couverture, pour que le raccord ne se voie pas
t=c2.crop((0,0,sw,6)).resize((1,1),Image.BOX).getpixel((0,0)); b_=c2.crop((0,c2.height-6,sw,c2.height)).resize((1,1),Image.BOX).getpixel((0,0))
cv.paste(t,(0,0,sw,top+2)); cv.paste(b_,(0,top+c2.height-2,sw,sh_))
cv.paste(c2,(0,top))
m2=Image.new('L',(sw,sh_),0); dm=ImageDraw.Draw(m2); dm.rectangle([0,top-30*S,sw,top+30*S],fill=255); dm.rectangle([0,top+c2.height-30*S,sw,top+c2.height+30*S],fill=255)
cv=Image.composite(cv.filter(ImageFilter.GaussianBlur(14*S)),cv,m2.filter(ImageFilter.GaussianBlur(10*S)))
mask=Image.new('L',(sw,sh_),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,sw-1,sh_-1],radius=44*S,fill=255)
body.paste(cv,(sx,sy),mask)
d.rounded_rectangle([pw/2-48*S,26*S,pw/2+48*S,48*S],radius=11*S,fill=(10,10,10,255))  # caméra
bg.paste(body,(px,py),body)

bg=bg.resize((1200,900),Image.LANCZOS)
bg.save(out,quality=86,optimize=True,progressive=True)
print('ok',out)
