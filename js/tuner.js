// Tessitura · The Tuner tab: gauge, target keyboard, hold-steady drill and pitch trail.
'use strict';
/* ================= TUNER ================= */
const T={span:store.get('trailSpan',12),target:null,base:store.get('kbdBase',48),holdStart:null,best:0,needle:0,celebrated:false};
(function buildGauge(){
  const cx=150,cy=160,svg=$('#gauge');let h='';
  const pt=(a,r)=>[cx+r*Math.sin(a*Math.PI/180),cy-r*Math.cos(a*Math.PI/180)];
  const arc=(a0,a1,r)=>{const [x0,y0]=pt(a0,r),[x1,y1]=pt(a1,r);return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`};
  h+=`<path d="${arc(-62,62,134)}" stroke="#24202f" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  h+=`<path id="gzone" d="${arc(-12,12,134)}" stroke="#5eead4" stroke-width="8" fill="none" stroke-linecap="round" opacity=".8"/>`;
  for(let c=-50;c<=50;c+=5){const a=c*1.2,maj=c%25===0,mid=c%10===0;const [x0,y0]=pt(a,maj?108:mid?114:118),[x1,y1]=pt(a,124);h+=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${maj?'#9a93aa':'#4a4458'}" stroke-width="${maj?2:1.3}" stroke-linecap="round"/>`}
  for(const c of [-50,-25,0,25,50]){const [x,y]=pt(c*1.2,94);h+=`<text x="${x}" y="${y+4}" fill="#6b6579" font-family="JetBrains Mono" font-size="10" text-anchor="middle">${c>0?'+'+c:c===0?'0':'−'+(-c)}</text>`}
  h+=`<text x="${cx-118}" y="${cy+8}" fill="#6b6579" font-size="10" font-family="Manrope" font-weight="700" letter-spacing="1.5">FLAT</text><text x="${cx+118}" y="${cy+8}" fill="#6b6579" font-size="10" font-family="Manrope" font-weight="700" letter-spacing="1.5" text-anchor="end">SHARP</text>`;
  h+=`<g id="needle"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-128}" stroke="#f3f0f8" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="10" fill="#f3f0f8"/><circle cx="${cx}" cy="${cy}" r="4" fill="#0c0b11"/></g>`;
  svg.innerHTML=h;
})();
function buildKbd(){
  const k=$('#kbd');k.innerHTML='';const whites=document.createElement('div');whites.className='whites';k.appendChild(whites);
  const ms=[];for(let m=T.base;m<=T.base+24;m++)ms.push(m);
  const wm=ms.filter(m=>!isBlack(m)),ww=100/wm.length;
  wm.forEach(m=>{const d=document.createElement('div');d.className='wk';d.dataset.m=m;d.textContent=pc(m)===0?mname(m):'';whites.appendChild(d)});
  ms.filter(isBlack).forEach(m=>{const idx=wm.indexOf(m-1)+1;const d=document.createElement('div');d.className='bk';d.dataset.m=m;d.style.left=`calc(${idx*ww}% - ${ww*.32}%)`;d.style.width=ww*.62+'%';k.appendChild(d)});
  $$('#kbd [data-m]').forEach(el=>el.onclick=()=>setTarget(+el.dataset.m));
  $('#kbdRange').textContent=`${mname(T.base)} – ${mname(T.base+24)}`;
  markKeys();
}
let lastSung=null;
function markKeys(sung){
  $$('#kbd [data-m]').forEach(el=>{const m=+el.dataset.m;el.classList.toggle('target',m===T.target);el.classList.toggle('sung',sung!=null&&m===sung)});
}
function setTarget(m){T.target=m;T.best=0;T.holdStart=null;T.celebrated=false;playNote(m);markKeys(lastSung);$('#tunerTargetLbl').textContent='Target · '+mname(m);$('#holdHint').textContent=`Match ${mname(m)} and hold it inside the zone.`}
function tickTuner(){
  const now=performance.now()/1000;let c=null,status='Sing or hum a steady note',cls='';
  const tol=TOL[S.tol];
  if(pitch){
    const m=pitch.midi;
    const mc=vibCentre();
    if(T.target!=null){const mm=S.anyOct?fold(mc,T.target):mc;c=(mm-T.target)*100;
      if(Math.abs(c)<=tol){status='Locked in — hold it!';cls='good'}
      else if(Math.abs(c)>=100){const st=Math.round(Math.abs(c)/100);status=(c<0?'Go higher ↑':'Go lower ↓')+` (${st} semitone${st>1?'s':''})`;cls='bad'}
      else{status=c<0?'A little flat — lift slightly ↑':'A little sharp — ease down ↓';cls='warn'}
    }else{c=(mc-Math.round(mc))*100;
      if(Math.abs(c)<=10){status='In tune';cls='good'}else{status=c<0?'Slightly flat':'Slightly sharp';cls='warn'}}
    const r=Math.round(m),n=NAMES[pc(r)];
    $('#tnNote').innerHTML=`<span class="tn-name">${n[0]}</span>${n[1]?`<span class="tn-acc">${n[1]}</span>`:''}<span class="tn-oct">${oc(r)}</span>`;
    $('#tnHz').textContent=pitch.freq.toFixed(1);
    $('#tnCents').textContent=(c>0?'+':c<0?'−':'')+Math.abs(Math.round(c));
    if(r!==lastSung){lastSung=r;markKeys(r)}
  }else{
    if(lastSung!==null){lastSung=null;markKeys(null);$('#tnNote').innerHTML='<span class="tn-name" style="color:var(--dim)">—</span>';$('#tnHz').textContent='—';$('#tnCents').textContent='—'}
    if(!micOn)status='Turn on the mic to start';
  }
  const st=$('#tnStatus');if(st.textContent!==status)st.textContent=status;st.className='tn-status '+cls;
  $('#gaugeCard').classList.toggle('tuned',cls==='good');
  const tgtA=c==null?0:clamp(c,-52,52)*1.2;T.needle+=(tgtA-T.needle)*.22;
  $('#needle').setAttribute('transform',`rotate(${T.needle.toFixed(2)} 150 160)`);
  $('#needle').style.opacity=c==null?.3:1;
  const za=(T.target!=null?tol:10)*1.2;
  const pt=(a,r)=>[150+r*Math.sin(a*Math.PI/180),160-r*Math.cos(a*Math.PI/180)];
  const [x0,y0]=pt(-za,134),[x1,y1]=pt(za,134);$('#gzone').setAttribute('d',`M${x0} ${y0} A134 134 0 0 1 ${x1} ${y1}`);
  // hold
  let held=0;
  if(T.target!=null&&c!=null&&Math.abs(c)<=tol){if(!T.holdStart)T.holdStart=now;held=now-T.holdStart;T.best=Math.max(T.best,held)}else T.holdStart=null;
  $('#holdFill').style.width=Math.min(held/5,1)*100+'%';
  $('#holdNow').textContent=held.toFixed(1)+'s';$('#holdBest').textContent=T.best.toFixed(1)+'s';
  if(held>=5&&!T.celebrated){T.celebrated=true;toast(`🎉 Five steady seconds on ${mname(T.target)}!`)}
  drawHist(now);
}
function drawHist(now){
  const c=$('#histCv');if(!c.clientWidth)return;const [g,W,H]=fitCanvas(c);g.clearRect(0,0,W,H);
  const pts=live.filter(p=>p.t>now-8);
  let center=T.target!=null?T.target:pts.length?[...pts.map(p=>p.m)].sort((a,b)=>a-b)[pts.length>>1]:57;
  center=Math.round(center);const lo=center-T.span/2,hi=center+T.span/2,gut=46;const lh=H/(hi-lo);
  const Y=m=>(hi-m)*lh, X=t=>gut+(1-(now-t)/8)*(W-gut);
  g.textAlign='right';g.textBaseline='middle';
  for(let m=lo;m<=hi;m++){const y=Y(m);if(isBlack(m)){g.fillStyle='rgba(0,0,0,.2)';g.fillRect(gut,y-lh/2,W-gut,lh)}
    if(m===T.target){g.fillStyle='rgba(255,138,92,.16)';g.fillRect(gut,y-lh/2,W-gut,lh);g.fillStyle='rgba(255,138,92,.8)';g.fillRect(gut,y-.5,W-gut,1)}
    g.fillStyle=m===T.target?'#ffc46b':isBlack(m)?'#4f495c':'#77708a';g.font='500 10px JetBrains Mono';if(!isBlack(m)||m===T.target)g.fillText(mname(m),gut-8,y)}
  g.lineWidth=3;g.lineCap='round';
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(b.t-a.t>.12||Math.abs(b.m-a.m)>1.5)continue;
    const ref=T.target!=null?T.target:Math.round(b.m);const mm=T.target!=null?fold(b.m,ref):b.m;const d=Math.abs(mm-ref)*100;
    g.strokeStyle=d<=(T.target!=null?TOL[S.tol]:12)?COL.hit:d<=60?COL.near:COL.off;
    const ma=T.target!=null?fold(a.m,ref):a.m;
    g.beginPath();g.moveTo(X(a.t),Y(ma));g.lineTo(X(b.t),Y(mm));g.stroke()}
}
$('#octDown').onclick=()=>{T.base=clamp(T.base-12,24,72);store.set('kbdBase',T.base);buildKbd()};
$('#octUp').onclick=()=>{T.base=clamp(T.base+12,24,72);store.set('kbdBase',T.base);buildKbd()};
$('#clearTarget').onclick=()=>{T.target=null;T.holdStart=null;markKeys(lastSung);$('#tunerTargetLbl').textContent='';$('#holdHint').textContent='Choose a target note, listen, then match it and hold it as steadily as you can.'};
$('#replayTarget').onclick=()=>{if(T.target!=null)playNote(T.target);else toast('Pick a note on the keyboard first')};
