import base64,re,sys,os
D=os.path.dirname(os.path.abspath(__file__))
r=lambda p: open(os.path.join(D,p),encoding='utf-8').read()
b=lambda p: base64.b64encode(open(os.path.join(D,p),'rb').read()).decode()
assets='window.__ASSETS={glb:"%s",p1:"data:image/webp;base64,%s",p2:"data:image/webp;base64,%s",whey:"data:image/webp;base64,%s",pot:"data:image/webp;base64,%s",roar1:"%s",roar2:"%s",c_huan:"%s",c_bie:"%s",c_zhan:"%s",c_ah:"%s",c_ruqing:"%s",bgm_chase:"%s",chase_loop:"%s",tv1:"data:image/webp;base64,%s",tv2:"data:image/webp;base64,%s",tv3:"data:image/webp;base64,%s",tv4:"data:image/webp;base64,%s",remote:"data:image/webp;base64,%s",hou:"data:image/webp;base64,%s",bags2:"data:image/webp;base64,%s",bag1:"data:image/webp;base64,%s",card:"data:image/webp;base64,%s",terrazzo:"data:image/jpeg;base64,%s",dead:"data:image/webp;base64,%s",pan:"data:image/webp;base64,%s",cig:"data:image/webp;base64,%s",breath:"%s"};'%(b('src/assets/dorm.glb'),b('src/assets/p1.webp'),b('src/assets/p2.webp'),b('src/assets/whey.webp'),b('src/assets/pot.webp'),b('src/assets/roar1.mp3'),b('src/assets/roar2.mp3'),b('src/assets/c_huan.mp3'),b('src/assets/c_bie.mp3'),b('src/assets/c_zhan.mp3'),b('src/assets/c_ah.mp3'),b('src/assets/c_ruqing.mp3'),b('src/assets/bgm_chase.mp3'),b('src/assets/chase_loop.mp3'),b('src/assets/tv1.webp'),b('src/assets/tv2.webp'),b('src/assets/tv3.webp'),b('src/assets/tv4.webp'),b('src/assets/remote.webp'),b('src/assets/hou.webp'),b('src/assets/bags2.webp'),b('src/assets/bag1.webp'),b('src/assets/card.webp'),b('src/assets/terrazzo.jpg'),b('src/assets/dead.webp'),b('src/assets/pan.webp'),b('src/assets/cig.webp'),b('src/assets/breath.mp3'))
logic=re.sub(r'^export ','',r('src/logic.js')+'\n'+r('src/dorm.js'),flags=re.M)
for mode in ('cdn','local'):
    three='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>' if mode=='cdn' else '<script src="../vendor/three.min.js"></script>'
    html=r('src/shell.html')+'\n'+three+'\n<script>'+assets+'</script>\n<script>\n'+logic+'\n'+r('src/props.js')+'\n'+r('src/main.js')+'\n</script>\n'
    if mode=='local': html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
    os.makedirs(os.path.join(D,'dist'),exist_ok=True)
    open(os.path.join(D,'dist','dorm-whey.html' if mode=='cdn' else 'local.html'),'w',encoding='utf-8').write(html)
import shutil; shutil.copy(os.path.join(D,'dist','dorm-whey.html'), os.path.join(D,'index.html'))  # GitHub Pages 網址用的就是這個 index.html
print('ok', os.path.getsize(os.path.join(D,'dist','dorm-whey.html')))
