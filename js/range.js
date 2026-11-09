// Tessitura · Vocal range test, voice type and fitting songs into your range.
'use strict';
/* ================= VOCAL RANGE ================= */
const VOICE_TYPES=[['Bass',40,64],['Baritone',43,67],['Tenor',48,72],['Alto',53,77],['Mezzo-soprano',57,81],['Soprano',60,84]];
function voiceType(lo,hi){let best=null,bd=1e9;for(const [n,a,b] of VOICE_TYPES){const d=Math.abs(lo-a)+Math.abs(hi-b);if(d<bd){bd=d;best=[n,a,b]}}return best}
const spanTxt=n=>{const o=Math.floor(n/12),r=n%12;return (o?`${o} octave${o>1?'s':''}`:'')+(o&&r?' + ':'')+(r?`${r} note${r>1?'s':''}`:'')||'0 notes'};
// the part of the range that is comfortable to sing whole songs in
function comfortZone(){if(!S.range)return null;const {lo,hi}=S.range,sh=hi-lo>=14?2:hi-lo>=9?1:0;return [lo+sh,hi-sh]}
// best transposition (semitones) to fit a melody spanning lo..hi into the singer's comfortable zone
function autoKeyFor(song){
  if(!S.autoKey||!S.range||!song||isAudio(song)||song.noAuto)return 0;
  let seq;try{seq=parseSeq(song.seq)}catch(e){return 0}
  const [lo,hi]=rangeOf(seq),[zl,zh]=comfortZone();
  let best=0,bs=1e9;
  for(let t=-12;t<=12;t++){const over=Math.max(0,zl-(lo+t))+Math.max(0,(hi+t)-zh);const sc=over*100+Math.abs(t);if(sc<bs){bs=sc;best=t}}
  return best;
}
const keyOf=song=>autoKeyFor(song)+S.transpose;
function renderRangeCard(){
  const c=$('#rangeCard');if(!c)return;
  if(!S.range){
    c.innerHTML=`<div class="card-title"><span>Your vocal range</span></div>
      <p style="line-height:1.6;color:#d9d4e3">Find the lowest and highest notes you can sing comfortably. Tessitura will then move every song into the right key for <i>your</i> voice, which is one of the quickest ways to stop missing notes.</p>
      <div style="margin-top:16px"><button class="btn primary" id="rangeGo">Find my range</button></div>
      <p class="muted" style="margin-top:12px;font-size:12.5px">Takes about a minute. Needs the microphone.</p>`;
  }else{
    const {lo,hi}=S.range,[vt,a,b]=voiceType(lo,hi);
    const L=36,H=86,X=m=>(m-L)/(H-L)*100;let keys='';
    for(let m=L;m<=H;m++)if(!isBlack(m))keys+=`<div class="rk${pc(m)===0?' c':''}" style="left:${X(m)}%">${pc(m)===0?`<span>${mname(m)}</span>`:''}</div>`;
    c.innerHTML=`<div class="card-title"><span>Your vocal range</span><span class="muted">tested ${new Date(S.range.date).toLocaleDateString()}</span></div>
      <div class="kv"><div><span>Range</span><b>${mname(lo)} – ${mname(hi)}</b></div><div><span>Span</span><b>${spanTxt(hi-lo)}</b></div><div><span>Closest voice type</span><b>${vt}</b></div></div>
      <div class="range-bar">${keys}<div class="vt" style="left:${X(a)}%;width:${X(b)-X(a)}%" title="Typical ${vt} range"></div><div class="fill" style="left:${X(lo)}%;width:${X(hi)-X(lo)}%"></div></div>
      <p class="muted" style="font-size:12.5px;line-height:1.5">Orange = your range. Dashed = the typical ${vt.toLowerCase()} range. Voice types are a rough guide only; your range grows with practice.</p>
      <div style="display:flex;gap:12px;align-items:center;margin-top:14px;flex-wrap:wrap">
        <label class="toggle"><input type="checkbox" id="autoKeyT" ${S.autoKey?'checked':''}><span class="sw"></span>Auto-fit songs to my range</label>
        <button class="btn ghost sm" id="rangeGo">Test again</button></div>`;
    $('#autoKeyT').onchange=e=>{S.autoKey=e.target.checked;changed();toast(S.autoKey?'Songs will now be moved into your range':'Songs will play in their original key')};
  }
  $('#rangeGo').onclick=startRangeTest;
}
const RF={active:false,step:0,low:null,high:null};
function stableNote(){ // a note held steadily for ~1 s, or null
  const now=performance.now()/1000,pts=live.filter(p=>p.t>now-1);
  if(pts.length<10||pts[0].t>now-.85)return null;
  for(let i=1;i<pts.length;i++)if(pts[i].t-pts[i-1].t>.15)return null; // must be continuous
  const avg=pts.map(p=>{let a=0,c=0;for(const q of pts)if(Math.abs(q.t-p.t)<=VIB_WIN/2){a+=q.m;c++}return a/c});
  const ms=avg.sort((a,b)=>a-b),lo=ms[Math.floor(ms.length*.1)],hi=ms[Math.floor(ms.length*.9)];
  return hi-lo<.7?Math.round(ms[ms.length>>1]):null;
}
async function startRangeTest(){
  if(!micOn){const ok=await enableMic();if(!ok)return}
  Object.assign(RF,{active:true,step:0,low:null,high:null});renderRangeWizard();
}
function renderRangeWizard(){
  const st=RF.step;
  const txt=st===0
    ?['Lowest note','Sing “ah” and slide down slowly. Stop at the lowest note that still feels easy, not croaky or breathy, and hold it for a second.']
    :['Highest note','Now slide up slowly. Stop at the highest note you can sing without straining or shouting, and hold it for a second. Falsetto counts if it feels easy.'];
  $('#modal').innerHTML=`<div class="steps-dots"><i class="on"></i><i class="${st?'on':''}"></i></div>
    <div class="eyebrow">Step ${st+1} of 2</div><h2>${txt[0]}</h2><p class="muted" style="margin-top:6px;line-height:1.55">${txt[1]}</p>
    <div class="wiz-note" id="rfNote">—</div><div class="wiz-sub" id="rfSub">waiting for your voice…</div>
    <div class="stab"><i id="rfStab"></i></div><div class="muted" style="font-size:12px">Steadiness: hold the note until this bar fills</div>
    <div class="capt"><span>${st===0?'Lowest':'Highest'} steady note so far</span><b id="rfCap">—</b></div>
    <div class="modal-actions"><button class="btn ghost" id="rfCancel">Cancel</button><button class="btn ghost" id="rfReset">Reset</button><button class="btn primary" id="rfNext" disabled>${st===0?'Next: highest note':'Finish'}</button></div>`;
  openModal();modalLocked=true;
  $('#rfCancel').onclick=()=>{RF.active=false;modalLocked=false;closeModal()};
  $('#rfReset').onclick=()=>{if(st===0)RF.low=null;else RF.high=null};
  $('#rfNext').onclick=()=>{
    if(st===0){RF.step=1;renderRangeWizard();return}
    RF.active=false;modalLocked=false;
    let lo=RF.low,hi=RF.high;if(hi<lo)[lo,hi]=[hi,lo];
    if(hi-lo<5){toast('That range looks too small. Try again, sliding further down and up.');closeModal();return}
    S.range={lo,hi,date:Date.now()};if(S.autoKey==null)S.autoKey=true;saveS();
    closeModal();renderRangeCard();renderRoutine();build();renderHead();
    const [vt]=voiceType(lo,hi);toast(`Your range: ${mname(lo)}–${mname(hi)} (closest to ${vt}). Songs now fit your voice.`);
  };
}
function tickRange(){
  if(!RF.active)return;
  const n=$('#rfNote');if(!n)return;
  if(pitch){n.textContent=mname(pitch.midi);$('#rfSub').textContent=pitch.freq.toFixed(0)+' Hz'}else{n.textContent='—';$('#rfSub').textContent='waiting for your voice…'}
  const now=performance.now()/1000,pts=live.filter(p=>p.t>now-1);
  let stab=0;if(pts.length>5){const ms=pts.map(p=>{let a=0,c=0;for(const q of pts)if(Math.abs(q.t-p.t)<=VIB_WIN/2){a+=q.m;c++}return a/c}).sort((a,b)=>a-b);const spread=ms[Math.floor(ms.length*.9)]-ms[Math.floor(ms.length*.1)];let gap=0;for(let i=1;i<pts.length;i++)gap=Math.max(gap,pts[i].t-pts[i-1].t);stab=(gap>.15?0:clamp((now-pts[0].t)/.9,0,1))*clamp(1-(spread-.3)/.8,0,1)}
  $('#rfStab').style.width=stab*100+'%';
  const sn=stableNote();
  if(sn!=null){if(RF.step===0)RF.low=RF.low==null?sn:Math.min(RF.low,sn);else RF.high=RF.high==null?sn:Math.max(RF.high,sn)}
  const cap=RF.step===0?RF.low:RF.high;$('#rfCap').textContent=cap==null?'—':mname(cap);$('#rfNext').disabled=cap==null;
}

function renderTrain(){renderRangeCard();renderRoutine();renderEarCard()}
function tickTrain(){tickDrill()}
