// Tessitura · The Progress tab: stats, accuracy chart, recent sessions and personal bests.
'use strict';
/* ================= PROGRESS ================= */
function renderProgress(){
  const h=store.get('history',[]);const body=$('#progBody');
  if(!h.length){body.innerHTML=`<div class="prog-head"><h1>Your progress</h1></div><div class="card empty"><div class="serif">No sessions yet</div>Sing through any song or warm-up and your scores will show up here.<div style="margin-top:18px"><button class="btn primary" id="goPractice">Start practising</button></div></div>`;$('#goPractice').onclick=()=>showView('practice');return}
  const last10=h.slice(-10),avg=Math.round(last10.reduce((a,x)=>a+x.score,0)/last10.length);
  const best=h.reduce((a,x)=>x.score>a.score?x:a,h[0]);
  const mins=Math.round(h.reduce((a,x)=>a+(x.dur||0),0)/60);
  const prev10=h.slice(-20,-10);const pAvg=prev10.length?Math.round(prev10.reduce((a,x)=>a+x.score,0)/prev10.length):null;
  const trend=pAvg==null?'last 10 sessions':(avg-pAvg>=0?'▲ ':'▼ ')+Math.abs(avg-pAvg)+' vs previous 10';
  const bests={};for(const x of h){if(!bests[x.id]||x.score>bests[x.id].score)bests[x.id]=x}
  const cls=s=>s>=75?'g':s>=45?'w':'b';
  const fmt=d=>{const dt=new Date(d);return dt.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+dt.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
  body.innerHTML=`
    <div class="prog-head"><h1>Your progress</h1><button class="btn ghost sm" id="clearHist">Clear history</button></div>
    <div class="stat-row">
      <div class="card stat"><div class="k">Sessions</div><div class="v">${h.length}</div><div class="s">songs sung through</div></div>
      <div class="card stat"><div class="k">Recent average</div><div class="v">${avg}%</div><div class="s">${trend}</div></div>
      <div class="card stat"><div class="k">Best score</div><div class="v">${best.score}%</div><div class="s">${esc(best.title)}</div></div>
      <div class="card stat"><div class="k">Time singing</div><div class="v">${mins<1?'<1':mins}<span style="font-size:22px;color:var(--muted)"> min</span></div><div class="s">of scored practice</div></div>
    </div>
    <div class="card" id="weakCard"></div>
    <div class="card chart-card"><div class="card-title"><span>Accuracy over time</span><span class="muted">last ${Math.min(h.length,40)} sessions</span></div><canvas id="progCv"></canvas></div>
    <div class="two-col">
      <div class="card"><div class="card-title"><span>Recent sessions</span></div>${h.slice(-8).reverse().map(x=>`<div class="row"><span class="t">${esc(x.title)}</span><span class="d">${fmt(x.date)}</span><span class="pill ${cls(x.score)}">${x.score}%</span></div>`).join('')}</div>
      <div class="card"><div class="card-title"><span>Personal bests</span></div>${Object.values(bests).sort((a,b)=>b.score-a.score).map(x=>`<div class="row"><span class="t">${esc(x.title)}</span><span class="pill ${cls(x.score)}">${x.score}%</span></div>`).join('')}</div>
    </div>`;
  $('#clearHist').onclick=()=>{if(confirm('Clear all practice history and weak-spot stats?')){store.set('history',[]);store.set('stats',{note:{},int:{},ear:{}});renderProgress();renderLib()}};
  renderWeak();
  requestAnimationFrame(drawProgChart);
}
function drawProgChart(){
  const c=$('#progCv');if(!c||!c.clientWidth)return;const [g,W,H]=fitCanvas(c);
  const h=store.get('history',[]).slice(-40);const L=36,R=10,Tp=10,B=22;
  const X=i=>L+(h.length<2?.5:i/(h.length-1))*(W-L-R),Y=v=>Tp+(1-v/100)*(H-Tp-B);
  g.font='500 10px JetBrains Mono';g.textAlign='right';g.textBaseline='middle';
  for(const v of [0,25,50,75,100]){g.fillStyle='rgba(255,255,255,.05)';g.fillRect(L,Math.round(Y(v)),W-L-R,1);g.fillStyle='#6b6579';g.fillText(v+'%',L-8,Y(v))}
  if(!h.length)return;
  const ar=g.createLinearGradient(0,Tp,0,H-B);ar.addColorStop(0,'rgba(255,138,92,.28)');ar.addColorStop(1,'rgba(255,138,92,0)');
  g.beginPath();h.forEach((x,i)=>i?g.lineTo(X(i),Y(x.score)):g.moveTo(X(i),Y(x.score)));g.lineTo(X(h.length-1),Y(0));g.lineTo(X(0),Y(0));g.closePath();g.fillStyle=ar;g.fill();
  const ln=g.createLinearGradient(L,0,W,0);ln.addColorStop(0,'#ff8a5c');ln.addColorStop(1,'#ffc46b');
  g.beginPath();h.forEach((x,i)=>i?g.lineTo(X(i),Y(x.score)):g.moveTo(X(i),Y(x.score)));g.strokeStyle=ln;g.lineWidth=2.5;g.lineJoin='round';g.stroke();
  h.forEach((x,i)=>{g.beginPath();g.arc(X(i),Y(x.score),4,0,7);g.fillStyle=x.score>=75?COL.hit:x.score>=45?COL.near:COL.off;g.fill();g.strokeStyle='#14121b';g.lineWidth=2;g.stroke()});
}
