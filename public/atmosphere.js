const TAU = Math.PI * 2;
const wrap = n => ((n % 1) + 1) % 1;
export function sampleGhost(scene, index, seconds) {
  const seed = index * 2.39996, duration = 22 + (index % 5) * 4;
  const p = wrap(seconds / duration + index * .137), fade = Math.min(1,p/.12,(1-p)/.12);
  if(scene===2) return { x:-.3+p*1.6, y:.14+(index%4)*.2+.13*Math.sin(TAU*p+seed), scale:.35+.65*Math.sin(Math.PI*p), angle:Math.sin(TAU*p+seed)*.18, alpha:fade*(.38+(index%3)*.18), flip:index%2===0 };
  if(scene===3) {const r=.07+p*.8,a=seed+seconds*.11;return {x:.5+Math.cos(a)*r,y:.5+Math.sin(a)*r*.85,scale:.25+p*.95,angle:Math.sin(a)*.22,alpha:fade*.65,flip:Math.cos(a)<0};}
  return {x:index%2===0?-.3+p*1.6:1.3-p*1.6,y:.18+(index%4)*.2+.1*Math.sin(TAU*p*2+seed),scale:.4+(index%4)*.18,angle:Math.sin(TAU*p+seed)*.14,alpha:fade*(.3+(index%4)*.16),flip:index%2===1};
}
export function mountAtmosphere(canvas, scene = 1) {
  const ctx = canvas.getContext?.('2d');
  if(!ctx) return { update(){}, destroy(){} };
  const atlas = new Image(); atlas.src='/assets/ghosts-trio.webp';
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let width=innerWidth,height=innerHeight,frame,previous=0,time=0,heat=0,targetHeat=0,phase='lobby';
  function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function draw(stamp){
    const dt=previous?Math.min((stamp-previous)/1000,.08):0;previous=stamp;
    heat += (targetHeat-heat)*Math.min(1,dt*1.2);time += dt*(reduced ? .18 : 1)*(1+heat*1.3);
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,Math.max(width,height)*.6);
    glow.addColorStop(0,`rgba(${Math.round(27+heat*49)},${Math.round(29-heat*8)},${Math.round(46-heat*10)},${.24+heat*.16})`);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    if(atlas.complete && atlas.naturalWidth){
      const baseCount = reduced ? 4 : scene===2 ? 10 : 8;
      const count = reduced ? baseCount : baseCount + 4;
      for(let i=0;i<count;i++){
        const g=sampleGhost(scene,i,time),size=Math.min(width,height)*.38*g.scale*(1+heat*.12);
        ctx.save();ctx.globalAlpha=g.alpha*(i<baseCount?1:heat)*(phase==='results' ? .65 : 1);ctx.translate(g.x*width,g.y*height);ctx.rotate(g.angle);ctx.scale(g.flip?-1:1,1);
        if(heat>.03){ctx.shadowColor=`rgba(155,78,72,${heat*.65})`;ctx.shadowBlur=18*heat;}
        const sw=atlas.naturalWidth/3;ctx.drawImage(atlas,(i%3)*sw,0,sw,atlas.naturalHeight,-size/2,-size/2,size,size);ctx.restore();
      }
    }
    frame=requestAnimationFrame(draw);
  }
  resize();window.addEventListener('resize',resize);frame=requestAnimationFrame(draw);
  return { update(state){phase=state.phase;targetHeat=phase==='pvp'?1:0;canvas.dataset.phase=phase;},destroy(){cancelAnimationFrame(frame);window.removeEventListener('resize',resize);} };
}
