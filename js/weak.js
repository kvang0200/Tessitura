// Tessitura · Weak-spots report and the personal drill.
'use strict';
/* ================= WEAK SPOTS ================= */
// running stats, gently weighted toward recent practice
function recordStat(kind,key,score,cents){
  const st=store.get('stats',{note:{},int:{},ear:{}});st[kind]=st[kind]||{};
  const e=st[kind][key]||{n:0,s:0,c:0,cn:0};const k=.97;
  e.n=e.n*k+1;e.s=e.s*k+score;if(cents!=null&&isFinite(cents)){e.c=e.c*k+cents;e.cn=e.cn*k+1}
  st[kind][key]=e;store.set('stats',st);
}
function recordSessionStats(r){
  const per=r.per;if(!per||!per.length)return;
  const st=store.get('stats',{note:{},int:{},ear:{}}),k=.97;
  const add=(kind,key,score,cents)=>{st[kind]=st[kind]||{};const e=st[kind][key]||{n:0,s:0,c:0,cn:0};e.n=e.n*k+1;e.s=e.s*k+score;if(cents!=null&&isFinite(cents)){e.c=e.c*k+cents;e.cn=e.cn*k+1}st[kind][key]=e};
  per.forEach((p,i)=>{add('note',p.midi,p.score,p.avg);if(i){const iv=p.midi-per[i-1].midi;if(iv&&Math.abs(iv)<=12)add('int',iv,p.score)}});
  store.set('stats',st);
}
const tok=m=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][pc(m)]+oc(m);
const ivWords=iv=>`${iv>0?'Up':'Down'} a ${ivName(iv).replace('Octave','octave')}`;
function weakData(){
  const st=store.get('stats',{note:{},int:{},ear:{}});
  const list=(o,min)=>Object.entries(o||{}).map(([k,e])=>({k:+k,acc:e.s/e.n,n:e.n,cents:e.cn>.5?e.c/e.cn:null})).filter(x=>x.n>=min);
  return {notes:list(st.note,.9),ints:list(st.int,1.8),ear:list(st.ear,1.8)};
}
function renderWeak(){
  const w=weakData(),el=$('#weakCard');if(!el)return;
  if(w.notes.length<4){el.innerHTML=`<div class="card-title"><span>Weak spots</span></div><div class="empty" style="padding:24px">Sing a few songs or warm-ups and this will show which notes and leaps give you trouble, plus a drill made just for them.</div>`;return}
  const by=w.notes.reduce((o,x)=>(o[x.k]=x,o),{}),ks=w.notes.map(x=>x.k),lo=Math.min(...ks),hi=Math.max(...ks);
  let strip='';for(let m=lo;m<=hi;m++){const x=by[m];const col=!x?'var(--panel3)':x.acc>=.75?COL.hit:x.acc>=.45?COL.near:COL.off;
    strip+=`<div data-tip="${mname(m)}${x?` · ${Math.round(x.acc*100)}% on pitch${x.cents!=null?`, usually ${Math.abs(Math.round(x.cents))}¢ ${x.cents<0?'flat':'sharp'}`:''}`:' · no data yet'}" style="flex:1;min-width:14px;height:44px;border-radius:6px;background:${col};opacity:${x?.35+.65*Math.min(1,x.n/6):1};display:flex;align-items:flex-end;justify-content:center;font:600 9px var(--mono);color:#0c0b11;padding-bottom:3px">${pc(m)===0||m===lo||m===hi?mname(m):''}</div>`}
  const worstN=w.notes.filter(x=>x.acc<.8&&x.n>=1.8).sort((a,b)=>a.acc-b.acc).slice(0,4);
  const worstI=w.ints.filter(x=>x.acc<.8).sort((a,b)=>a.acc-b.acc).slice(0,4);
  const ears=w.ear.filter(x=>x.acc<.7).sort((a,b)=>a.acc-b.acc).slice(0,3);
  const reg=[[lo,lo+(hi-lo)/3,'Low notes'],[lo+(hi-lo)/3,lo+2*(hi-lo)/3,'Middle'],[lo+2*(hi-lo)/3,hi+1,'High notes']].map(([a,b,n])=>{const xs=w.notes.filter(x=>x.k>=a&&x.k<b&&x.cents!=null);if(!xs.length)return null;const c=xs.reduce((s,x)=>s+x.cents,0)/xs.length;return `<div><span>${n}</span><b style="color:${Math.abs(c)<10?'var(--good)':'var(--warn)'}">${Math.abs(c)<10?'centred':Math.abs(Math.round(c))+'¢ '+(c<0?'flat':'sharp')}</b></div>`}).filter(Boolean).join('');
  const pctPill=a=>`<span class="pill ${a>=.75?'g':a>=.45?'w':'b'}">${Math.round(a*100)}%</span>`;
  el.innerHTML=`<div class="card-title"><span>Weak spots</span><span class="muted">from your recent singing</span></div>
    <div style="display:flex;gap:3px">${strip}</div><p class="muted" style="font-size:12px;margin-top:6px">Each block is a note: teal = solid, amber = shaky, red = often missed, grey = not sung yet. ${touchUI()?'Tap':'Hover over'} a block for details.</p>
    ${reg?`<div class="kv" style="margin-top:14px">${reg}</div>`:''}
    <div class="two-col" style="margin-top:14px;gap:22px">
      <div><div class="card-title" style="margin-bottom:4px"><span>Notes to work on</span></div>${worstN.length?worstN.map(x=>`<div class="row"><span class="t">${mname(x.k)}${x.cents!=null&&Math.abs(x.cents)>=10?` <span class="muted" style="font-weight:500">· usually ${Math.abs(Math.round(x.cents))}¢ ${x.cents<0?'flat':'sharp'}</span>`:''}</span>${pctPill(x.acc)}</div>`).join(''):'<div class="muted" style="padding:8px 0">No weak notes. Nice!</div>'}</div>
      <div><div class="card-title" style="margin-bottom:4px"><span>Leaps to work on</span></div>${worstI.length?worstI.map(x=>`<div class="row"><span class="t">${ivWords(x.k)}</span>${pctPill(x.acc)}</div>`).join(''):'<div class="muted" style="padding:8px 0">No troublesome leaps yet.</div>'}
        ${ears.length?`<div class="muted" style="font-size:12.5px;margin-top:8px">Intervals you mix up by ear: ${ears.map(x=>ivName(x.k)).join(', ')}</div>`:''}</div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;align-items:center"><button class="btn primary" id="weakGo" ${worstN.length||worstI.length?'':'disabled'}>Practise my weak spots</button><span class="muted" style="font-size:12.5px">Builds a short drill from the notes and leaps above</span></div>`;
  const b=$('#weakGo');if(b)b.onclick=()=>{const d=makeWeakDrill();if(d){showView('practice');loadSong(d.id);toast('Your weak-spot drill is ready. Press Space to sing it.')}};
}
function makeWeakDrill(){
  const w=weakData();const z=comfortZone()||[52,67],mid=Math.round((z[0]+z[1])/2);
  const worstN=w.notes.filter(x=>x.acc<.8&&x.n>=1.8).sort((a,b)=>a.acc-b.acc).slice(0,3);
  const worstI=w.ints.filter(x=>x.acc<.8).sort((a,b)=>a.acc-b.acc).slice(0,3);
  if(!worstN.length&&!worstI.length){toast('No weak spots yet. Sing a few more songs first.');return null}
  const into=m=>{while(m<z[0])m+=12;while(m>z[1])m-=12;return m<z[0]?m+12:m};
  const t=[];
  for(const x of worstN){const m=x.k>=z[0]-2&&x.k<=z[1]+2?x.k:into(x.k);t.push(tok(m-2),tok(m),tok(m+2),tok(m)+'/2','R/2',tok(m+2),tok(m)+'/3','R')} // approach from below and above, then hold it
  for(const x of worstI){const iv=x.k;let r=clamp(mid-Math.round(iv/2),z[0],z[1]-Math.max(0,iv));if(iv<0)r=clamp(mid-Math.round(iv/2),z[0]-iv,z[1]);
    t.push(tok(r),tok(r+iv)+'/2',tok(r),tok(r+iv)+'/2',tok(r)+'/2',tok(r+iv)+'/2','R/2')}
  const song={id:'drill-weak',kind:'midi',group:'Your drills',title:'Weak-spot drill',bpm:80,bpb:4,level:0,noAuto:true,
    desc:`Built from your trickiest ${[worstN.length?worstN.map(x=>mname(x.k)).join(', '):'',worstI.length?worstI.map(x=>ivWords(x.k).toLowerCase()).join(', '):''].filter(Boolean).join(' and ')}. Sing it a few times, then check Progress again.`,seq:t.join(' '),created:Date.now()};
  store.set('drill',song);return song;
}
