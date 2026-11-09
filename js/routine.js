// Tessitura · Daily routine and practice streak.
'use strict';
/* ================= DAILY ROUTINE ================= */
let routineMode=false;
const dayKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
function practiceDays(){const set=new Set();for(const x of store.get('history',[]))set.add(dayKey(x.date));for(const x of store.get('ear',[]))set.add(dayKey(x.date));return set}
function streak(){
  const days=practiceDays();let n=0;const d=new Date();
  if(!days.has(dayKey(d)))d.setDate(d.getDate()-1); // today not done yet: streak still alive from yesterday
  while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1)}
  return n;
}
function routineSteps(){
  const today=dayKey(Date.now()),h=store.get('history',[]).filter(x=>dayKey(x.date)===today),ear=store.get('ear',[]).filter(x=>dayKey(x.date)===today);
  const sungToday=id=>h.some(x=>x.id===id);
  const w=weakData(),hasWeak=w.notes.some(x=>x.acc<.8&&x.n>=1.8)||w.ints.some(x=>x.acc<.8);
  const songIds=new Set([...BUILTIN.filter(b=>b.group==='Songs').map(b=>b.id),...tracks.map(t=>t.id),...custom.map(c=>c.id)]);
  const lastSong=[...store.get('history',[])].reverse().find(x=>songIds.has(x.id)&&allSongs().some(s=>s.id===x.id));
  const songId=lastSong?lastSong.id:'s-twinkle',songT=(allSongs().find(s=>s.id===songId)||{}).title||'a song';
  return [
    {k:'warm',t:'Warm up',sub:'Five-Note Slide',id:'w-five',done:sungToday('w-five'),icon:'1'},
    {k:'steady',t:'Breath & steadiness',sub:'Long Tones',id:'w-long',done:sungToday('w-long'),icon:'2'},
    {k:'ear',t:'Ear training',sub:'Match 5 notes',drill:'match',done:ear.some(x=>x.type==='match'),icon:'3'},
    hasWeak?{k:'focus',t:'Fix weak spots',sub:'Your personal drill',id:'drill-weak',make:true,done:sungToday('drill-weak'),icon:'4'}
           :{k:'focus',t:'Scale practice',sub:'Major Scale',id:'w-scale',done:sungToday('w-scale'),icon:'4'},
    {k:'song',t:'Sing a song',sub:songT,id:songId,done:h.some(x=>songIds.has(x.id)),icon:'5'}];
}
function renderRoutine(){
  const c=$('#routineCard');if(!c)return;
  const steps=routineSteps(),done=steps.filter(s=>s.done).length,st=streak(),days=practiceDays();
  let strip='';for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const on=days.has(dayKey(d));
    strip+=`<i title="${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}${on?': practised':''}" style="width:14px;height:14px;border-radius:4px;background:${on?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--panel3)'};${i===0?'outline:1.5px solid var(--muted);outline-offset:2px':''}"></i>`}
  const next=steps.find(s=>!s.done);
  c.innerHTML=`<div class="card-title"><span>Today’s practice · about 10 minutes</span><span style="display:flex;gap:4px;align-items:center">${strip}</span></div>
    <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin-bottom:16px">
      <div><div class="big-num">${st}<span style="font-size:20px;color:var(--muted)"> day${st===1?'':'s'}</span></div><div class="muted" style="font-size:12.5px">${st?'practice streak 🔥':'start a streak today'}</div></div>
      <div style="flex:1;min-width:200px"><div class="hold-track" style="height:10px"><i style="width:${done/steps.length*100}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></i></div>
        <div class="muted" style="font-size:12.5px;margin-top:6px">${done===steps.length?'All done for today. Great work! 🎉':`${done} of ${steps.length} steps done`}</div></div>
      ${next?`<button class="btn primary" id="rtNext">${done?'Continue':'Start'}: ${next.t}</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px" class="rt-steps">${steps.map((s,i)=>`
      <button class="rt-step${s.done?' done':''}${s===next?' next':''}" data-i="${i}">
        <span class="rt-ic">${s.done?'✓':s.icon}</span><b>${s.t}</b><span>${esc(s.sub)}</span></button>`).join('')}</div>`;
  const go=s=>{
    if(s.drill){routineMode=true;startDrill(s.drill,5);return}
    if(s.make&&!makeWeakDrill())return;
    routineMode=true;showView('practice');loadSong(s.id).then(()=>toast(`${s.t}: press Space when you’re ready`));
  };
  if(next)$('#rtNext').onclick=()=>go(next);
  $$('#routineCard .rt-step').forEach(b=>b.onclick=()=>go(steps[+b.dataset.i]));
};
function onRoutineProgress(){
  if(!routineMode)return;
  const steps=routineSteps(),left=steps.filter(s=>!s.done);
  if(!left.length){routineMode=false;setTimeout(()=>toast('🎉 Today’s routine is complete. See you tomorrow!'),600)}
  else setTimeout(()=>toast(`Routine: ${steps.length-left.length}/${steps.length} done. Next: ${left[0].t} (open the Train tab)`),600);
}
