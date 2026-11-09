// Tessitura · Ear training drills.
'use strict';
/* ================= EAR TRAINING ================= */
const INTERVALS=[
 [1,'Minor 2nd','a half step: “Jaws” theme'],[2,'Major 2nd','a whole step: “Happy Birthday” (Hap-py)'],[3,'Minor 3rd','“Greensleeves” (A-las)'],
 [4,'Major 3rd','“When the Saints Go Marching In” (Oh when)'],[5,'Perfect 4th','“Here Comes the Bride” (Here comes)'],[6,'Tritone','“Maria” from West Side Story'],
 [7,'Perfect 5th','“Twinkle Twinkle” (twin-kle → twin-kle)'],[8,'Minor 6th','“The Entertainer” (opening leap)'],[9,'Major 6th','“My Bonnie Lies Over the Ocean” (My Bon-)'],
 [10,'Minor 7th','“Somewhere” from West Side Story (There’s a)'],[11,'Major 7th','“Take On Me” (chorus leap)'],[12,'Octave','“Somewhere Over the Rainbow” (Some-where)']];
const ivName=n=>(INTERVALS.find(x=>x[0]===Math.abs(n))||[0,n+' semitones'])[1];
const ivHint=n=>(INTERVALS.find(x=>x[0]===Math.abs(n))||[0,'',''])[2];
const DRILLS={
  match:{title:'Match the note',desc:'Hear a note, then sing it back. No visual help, just your ear.'},
  sing:{title:'Sing the interval',desc:'Hear a starting note, then sing the interval above (or below) it.'},
  name:{title:'Name the interval',desc:'Hear two notes and pick the distance between them.'}};
const D={on:false};
function earPool(){const z=comfortZone();return z?[z[0],z[1]]:[52,67]}
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function earIntervals(){return S.earLevel==='hard'?[1,2,3,4,5,6,7,8,9,10,11,12]:[2,4,5,7,12]}
function renderEarCard(){
  const c=$('#earCard');if(!c)return;const h=store.get('ear',[]);
  const last=t=>{const x=[...h].reverse().find(e=>e.type===t);return x?`<span class="pill ${x.correct/x.total>=.75?'g':x.correct/x.total>=.45?'w':'b'}">${x.correct}/${x.total}</span>`:'<span class="muted" style="font-size:12px">not tried yet</span>'};
  c.innerHTML=`<div class="card-title"><span>Ear training</span><span class="seg" id="earLvl"><button data-v="easy" class="${S.earLevel!=='hard'?'on':''}">Easy</button><button data-v="hard" class="${S.earLevel==='hard'?'on':''}">Harder</button></span></div>
    <p class="muted" style="line-height:1.5;margin-bottom:6px">Train the inner sense of pitch that lets you sing in tune without looking at a screen.</p>
    ${Object.entries(DRILLS).map(([k,d])=>`<div class="row" style="padding:12px 4px"><span class="t" style="white-space:normal"><b>${d.title}</b><br><span class="muted" style="font-weight:500;font-size:12.5px">${d.desc}</span></span>${last(k)}<button class="btn ghost sm" data-drill="${k}">Start</button></div>`).join('')}`;
  $$('#earLvl button').forEach(b=>b.onclick=()=>{S.earLevel=b.dataset.v;saveS();renderEarCard()});
  $$('#earCard [data-drill]').forEach(b=>b.onclick=()=>startDrill(b.dataset.drill));
}
async function startDrill(type,rounds=10){
  if(type!=='name'&&!micOn){const ok=await enableMic();if(!ok)return}
  await ensureCtx();
  Object.assign(D,{on:true,type,total:rounds,round:0,results:[],phase:'idle'});
  $('#trainBody').hidden=true;$('#drillPanel').hidden=false;
  $('#drillPanel').innerHTML=`<div class="prog-head"><div><div class="eyebrow">Ear training · ${S.earLevel==='hard'?'Harder':'Easy'}</div><h1 style="font-family:var(--serif);font-weight:400;font-size:40px">${DRILLS[type].title}</h1></div><button class="btn ghost sm" id="dQuit">✕ End</button></div>
    <div class="card" style="text-align:center;padding:40px 24px">
      <div class="steps-dots" id="dDots" style="justify-content:center;margin-bottom:22px"></div>
      <div class="eyebrow" id="dRound"></div>
      <div id="dBig" style="font-family:var(--serif);font-size:54px;line-height:1.1;margin:14px 0 8px;min-height:60px"></div>
      <div id="dSub" class="muted" style="font-size:15px;min-height:22px;line-height:1.5"></div>
      <div class="stab" style="max-width:360px;margin:22px auto 4px" id="dHoldWrap"><i id="dHold"></i></div>
      <div id="dBtns" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px"></div>
    </div>`;
  $('#dQuit').onclick=endDrill;nextRound();
}
function dDots(){$('#dDots').innerHTML=Array.from({length:D.total},(_,i)=>{const r=D.results[i];return `<i style="width:${Math.max(10,Math.min(26,300/D.total))}px;background:${r==null?(i===D.round?'var(--muted)':''):r.ok?'var(--good)':'var(--bad)'}"></i>`}).join('')}
function nextRound(){
  if(!D.on)return;
  if(D.round>=D.total){drillSummary();return}
  dDots();$('#dRound').textContent=`Round ${D.round+1} of ${D.total}`;$('#dHold').style.width='0%';
  const [lo,hi]=earPool();
  if(D.type==='match'){D.target=rint(lo,hi);D.root=null;playDrill()}
  else{
    const ivs=earIntervals();let iv=ivs[rint(0,ivs.length-1)];
    if(D.type==='sing'&&S.earLevel==='hard'&&Math.random()<.35)iv=-iv;
    const span=Math.abs(iv),rlo=iv>0?lo:lo+span,rhi=iv>0?hi-span:hi;
    D.root=rlo<=rhi?rint(rlo,rhi):Math.round((lo+hi)/2-iv/2);D.iv=iv;D.target=D.root+iv;playDrill();
  }
}
function playDrill(){
  const t=actx.currentTime+.1;D.phase='play';
  $('#dHoldWrap').style.visibility=D.type==='name'?'hidden':'visible';
  if(D.type==='match'){tone(D.target,t,1.1,.2);$('#dBig').textContent='Listen…';$('#dSub').textContent=''}
  else if(D.type==='sing'){tone(D.root,t,1.1,.2);$('#dBig').textContent=`Sing a ${ivName(D.iv)} ${D.iv>0?'up':'down'}`;$('#dSub').textContent='Listen to the starting note…'}
  else{tone(D.root,t,.8,.2);tone(D.target,t+.95,.8,.2);$('#dBig').textContent='Listen…';$('#dSub').textContent='Two notes, low then high'}
  $('#dBtns').innerHTML='';
  clearTimeout(D.tm);D.tm=setTimeout(()=>{if(!D.on)return;D.type==='name'?askName():startListening()},D.type==='name'?1900:1300);
}
function startListening(){
  D.phase='listen';D.hold=null;D.deadline=performance.now()+6000;D.lastSung=[];
  $('#dSub').textContent=D.type==='match'?'Now sing it back and hold it':'Now sing it and hold it';
  if(D.type==='match')$('#dBig').textContent='Your turn';
  $('#dBtns').innerHTML=`<button class="btn ghost sm" id="dAgain">↺ Hear it again</button>${D.type==='sing'?'<button class="btn ghost sm" id="dHint">💡 Hint</button>':''}<button class="btn ghost sm" id="dSkip">Skip</button>`;
  $('#dAgain').onclick=()=>{const t=actx.currentTime+.05;tone(D.type==='match'?D.target:D.root,t,1,.2);D.deadline=performance.now()+6000};
  const h=$('#dHint');if(h)h.onclick=()=>{$('#dSub').textContent=`Think of ${ivHint(D.iv)}`;tone(D.target,actx.currentTime+.05,.9,.14);D.hinted=true;D.deadline=performance.now()+6000};
  $('#dSkip').onclick=()=>drillResult(false,null);
}
function tickDrill(){
  if(!D.on||D.phase!=='listen')return;
  const now=performance.now(),tol=Math.max(TOL[S.tol],30);
  if(pitch){
    const ce=vibCentre(),um=S.anyOct?fold(ce,D.target):ce,d=(um-D.target)*100;D.lastSung.push(pitch.midi);if(D.lastSung.length>40)D.lastSung.shift();
    if(Math.abs(d)<=tol){if(!D.hold)D.hold={since:now,vals:[]};D.hold.vals.push(d)}else D.hold=null;
  }else D.hold=null;
  const held=D.hold?(now-D.hold.since)/1000:0;$('#dHold').style.width=Math.min(1,held/.8)*100+'%';
  if(held>=.8){const v=D.hold.vals.sort((a,b)=>a-b),c=v[v.length>>1];drillResult(true,c);return}
  if(now>D.deadline)drillResult(false,null);
};
function drillResult(ok,cents){
  D.phase='feedback';clearTimeout(D.tm);
  const r={ok,cents,target:D.target,iv:D.iv};D.results[D.round]=r;
  if(typeof recordStat==='function'){if(D.type==='match')recordStat('note',D.target,ok?1:0,cents);else recordStat('int',D.iv,ok?1:0)}
  if(ok){$('#dBig').innerHTML=`<span style="color:var(--good)">✓ ${mname(D.target)}</span>`;$('#dSub').textContent=Math.abs(cents)<8?'Dead on!':`${Math.abs(Math.round(cents))} cents ${cents<0?'flat':'sharp'}, close enough to count`}
  else{
    let msg='I didn’t hear a steady note.';
    if(D.lastSung&&D.lastSung.length>5){const s=[...D.lastSung].sort((a,b)=>a-b),m=s[s.length>>1],um=S.anyOct?fold(m,D.target):m,df=um-D.target;
      msg=Math.abs(df)<.5?'You were close but didn’t hold it steady':`You sang ${mname(m)}, ${Math.abs(df).toFixed(1).replace('.0','')} semitone${Math.abs(df)>=1.5?'s':''} too ${df<0?'low':'high'}`}
    $('#dBig').innerHTML=`<span style="color:var(--bad)">✗</span> It was ${mname(D.target)}`;$('#dSub').textContent=msg;
    tone(D.target,actx.currentTime+.1,.9,.16);
  }
  $('#dBtns').innerHTML='';D.round++;dDots();D.tm=setTimeout(nextRound,ok?1500:2600);
}
function askName(){
  D.phase='choose';const ivs=earIntervals();
  $('#dBig').textContent='What was the distance?';$('#dSub').textContent='';
  $('#dBtns').innerHTML=ivs.map(i=>`<button class="btn ghost" data-iv="${i}">${ivName(i)}</button>`).join('')+'<button class="btn ghost sm" id="dAgain">↺ Again</button>';
  $('#dAgain').onclick=()=>{const t=actx.currentTime+.05;tone(D.root,t,.8,.2);tone(D.target,t+.95,.8,.2)};
  $$('#dBtns [data-iv]').forEach(b=>b.onclick=()=>{
    const pick=+b.dataset.iv,ok=pick===D.iv;D.results[D.round]={ok,iv:D.iv};
    if(typeof recordStat==='function')recordStat('ear',D.iv,ok?1:0);
    $('#dBig').innerHTML=ok?`<span style="color:var(--good)">✓ ${ivName(D.iv)}</span>`:`<span style="color:var(--bad)">✗</span> It was a ${ivName(D.iv)}`;
    $('#dSub').textContent=`Remember it as ${ivHint(D.iv)}`;$('#dBtns').innerHTML='';
    const t=actx.currentTime+.15;tone(D.root,t,.6,.18);tone(D.target,t+.7,.8,.18);
    D.round++;dDots();D.tm=setTimeout(nextRound,ok?2200:3200);
  });
}
function drillSummary(){
  D.phase='done';const ok=D.results.filter(r=>r&&r.ok).length,cs=D.results.filter(r=>r&&r.ok&&r.cents!=null).map(r=>Math.abs(r.cents));
  const avg=cs.length?Math.round(cs.reduce((a,b)=>a+b,0)/cs.length):null;
  const h=store.get('ear',[]);h.push({type:D.type,date:Date.now(),correct:ok,total:D.total,cents:avg,level:S.earLevel||'easy'});store.set('ear',h.slice(-300));
  if(typeof onRoutineProgress==='function')onRoutineProgress();
  const pct=ok/D.total;
  $('#dRound').textContent='Finished';$('#dBig').textContent=`${ok} / ${D.total}`;$('#dHoldWrap').style.visibility='hidden';
  $('#dSub').textContent=(pct>=.9?'Excellent ear! ':pct>=.6?'Nice work. ':'Good practice. A few rounds a day builds this fast. ')+(avg!=null?`Average accuracy on correct notes: ${avg} cents.`:'')+(pct>=.9&&S.earLevel!=='hard'?' Try the Harder level next.':'');
  $('#dBtns').innerHTML=`<button class="btn ghost" id="dBack">Back to Train</button><button class="btn primary" id="dRe">Go again</button>`;
  $('#dBack').onclick=endDrill;$('#dRe').onclick=()=>startDrill(D.type,D.total);
}
function endDrill(){D.on=false;clearTimeout(D.tm);$('#drillPanel').hidden=true;$('#trainBody').hidden=false;renderTrain()}
