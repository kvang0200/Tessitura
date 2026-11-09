// Tessitura · The Practice screen: building songs, playing/singing runs, scoring, the note lanes, HUD, timeline, looping, zoom and note editing.
'use strict';
/* ================= PRACTICE ================= */
const P={song:null,notes:[],total:0,spb:.6,countIn:4,lo:48,hi:72,center:60,ref:60,pps:120,running:false,mode:null,startT:0,trace:[],nodes:[],now:-.6,active:null,offset:0,runFrom:0,unit:.6,gO:null,gK:null};
const fold=(m,ref)=>S.anyOct?m-12*Math.round((m-ref)/12):m;
function build(){
  if(isAudio()){
    const d=trackData[P.song.id];
    P.spb=1;P.countIn=4;P.unit=1;P.total=d.dur;
    const tu=d.an.tuning||0;P.tune=tu;
    P.notes=d.an.notes.map(n=>({midi:n.midi+tu,label:n.midi,key:n.key,start:n.start,dur:n.dur,hits:0,total:0,voiced:0,near:0,sum:0,sq:0}));
    P.lo=d.an.lo-5;P.hi=d.an.hi+5;if(P.hi-P.lo<14){const c=(P.lo+P.hi)/2;P.lo=Math.floor(c-7);P.hi=Math.ceil(c+7)}
    P.center=(d.an.lo+d.an.hi)/2+tu;P.ref=P.notes.length?P.notes[0].midi:60;
    // quick ornaments (runs, grace notes) are drawn but not scored, like a karaoke chart's main notes;
    // if a song is mostly quick notes (very fast singing), everything is scored
    const main=P.notes.filter(n=>n.dur>=.25).length;
    if(main>=10)for(const n of P.notes)n.orn=n.dur<.25;   // only very sparse guides score everything
    // mostly very short notes = rapped or spoken lyrics, which have no held note to aim for
    const shortShare=P.notes.length?P.notes.filter(n=>n.dur<.2).length/P.notes.length:0;
    P.speechy=P.notes.length>=40&&shortShare>.6;
    P.pps=150;P.trace=[];P.active=null;attachLyrics();
    return;
  }
  P.tune=0;
  const s=P.song;let seq;try{seq=parseSeq(s.seq)}catch(e){seq=[{midi:60,beats:1}]}
  const bpm=s.bpm*S.tempo/100;P.spb=60/bpm;P.countIn=s.bpb||4;
  let b=0;
  const K=keyOf(s);P.key=K;
  P.notes=seq.map(n=>{const o={midi:n.midi==null?null:n.midi+K,start:b*P.spb,dur:n.beats*P.spb,hits:0,total:0,voiced:0,near:0,sum:0,sq:0};b+=n.beats;return o});
  P.total=b*P.spb;
  const [lo,hi]=rangeOf(P.notes);
  P.lo=lo-4;P.hi=hi+4;P.center=(lo+hi)/2;P.ref=P.notes.find(n=>n.midi!=null).midi;
  P.pps=clamp(78/P.spb,110,210);P.trace=[];P.active=null;P.unit=P.spb;attachLyrics();
}
async function loadSong(id){
  if(P.running) stopRun();
  const s=allSongs().find(x=>x.id===id)||BUILTIN[0];
  if(isAudio(s)&&!trackData[s.id]){const ok=await prepareTrack(s);if(!ok)return}
  P.song=s;S.songId=s.id;saveS();P.offset=0;P.loop=null;P.passes=[];P.lastPass=null;Z.center=null;updateLoopPill();
  stopReplay();build();renderLib();renderHead();updateZoomUI();updateTakesBtn();
}
function renderHead(){
  const s=P.song,au=isAudio(s);
  $('#ctlKey').hidden=au;$('#ctlTempo').hidden=au;$('#ctlVox').hidden=!au;$('#ctlMusic').hidden=!au;$('#ctlFilter').hidden=!au;
  if(au)$$('#filtSeg button').forEach(b=>b.classList.toggle('on',+b.dataset.v===(s.filter==null?1:s.filter)));
  $('#vox').value=Math.round(S.vox*100);$('#voxLbl').textContent=Math.round(S.vox*100)+'%';
  $('#music').value=Math.round(S.music*100);$('#musicLbl').textContent=Math.round(S.music*100)+'%';
  const z=TOL[S.tol];const zone=$('#hudZone');zone.style.left=(50-z/2)+'%';zone.style.width=z+'%';
  $$('#tolSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.tol));
  $('#anyOct').checked=S.anyOct;$('#guide').checked=S.guide;
  $('#sync').value=S.sync;$('#syncLbl').textContent=S.sync+' ms';
  $('#ctlLyr').hidden=!(P.lyr||(au&&s.lyrics&&s.lyrics.length));$('#lyrT').checked=S.lyrics!==false;lyrKey='';
  const bn=$('#banner');
  if(au){
    const d=trackData[s.id];
    const tc=Math.round((d.an.tuning||0)*100);
    $('#songMeta').textContent=`Your track · ${fmtTime(d.dur)} · ${d.an.notes.length} notes${d.an.notes.length?` · ${mname(d.an.lo)}–${mname(d.an.hi)}`:''}${d.an.stem?' · from your vocals':''}${Math.abs(tc)>=5?` · tuned ${Math.abs(tc)}¢ ${tc<0?'flat':'sharp'}`:''}`;
    $('#songTitle').textContent=s.title;
    $('#songDesc').textContent=(d.an.stem?'Notes come from your isolated vocal file. ':'Notes were detected from the lead vocal automatically. ')+(P.notes.some(n=>n.orn)?'Thin dashed bars are quick notes (ornaments or rapped words): shown but not scored. ':'')+'Click a note to fix it, or click the timeline to start anywhere.';
    $('#vox').disabled=d.an.mono&&!d.an.stem;
    const msgs=[];
    if(d.an.mono&&!d.an.stem)msgs.push('This file is mono, so the original vocals can’t be removed and the note guide is less reliable.');
    if(!d.an.notes.length)msgs.push('No clear vocal melody was found. Try Background filter “Off”, or add a vocal stem.');
    else if(P.speechy)msgs.push(`This song is mostly rapped or spoken, so there are few held notes to aim for. Only its ${P.notes.filter(n=>!n.orn).length} held, sung notes are scored; the rest are shown as thin dashed bars.`);
    else if(!S.anyOct)msgs.push('Tip: turn on “Any octave”. Your voice may sit an octave away from the singer’s.');
    if(S.range&&d.an.notes.length){const up=d.an.hi-S.range.hi,dn=S.range.lo-d.an.lo;
      if(up>0||dn>0)msgs.push(`This song reaches ${up>0?mname(d.an.hi)+`, ${up} note${up>1?'s':''} above`:''}${up>0&&dn>0?' and ':''}${dn>0?mname(d.an.lo)+`, ${dn} note${dn>1?'s':''} below`:''} your range.${S.anyOct?' “Any octave” is on, so you can sing those parts an octave '+(up>0?'lower':'higher')+'.':' Turn on “Any octave” to sing those parts in a different octave.'}`);}
    const ed=s.edits||{del:[],oct:{}},nEd=ed.del.length+Object.keys(ed.oct).length;
    bn.hidden=false;
    bn.innerHTML=(msgs.length?esc(msgs.join(' '))+'<br>':'')+
      (d.an.stem
        ?`<span>${s.hasInst===false?'Vocals only, so there’s no music behind you yet.':'Notes come from your vocals file.'}</span> <button class="btn ghost sm" id="instBtn" style="margin-left:6px">${s.hasInst===false?'Add instrumental':'Change instrumental'}</button>${s.hasMix!==false&&s.hasInst!==false?' <button class="btn ghost sm" id="rmStem" style="margin-left:6px">Use the full song only</button>':''}`
        :`<span>Seeing notes when nobody sings, or wrong pitches? For the most accurate guide, add the song’s <b>isolated vocals</b> (made with the free app Ultimate Vocal Remover).</span> <button class="btn ghost sm" id="addStemBtn" style="margin-left:6px">Add vocals file</button>`)+
      ` <button class="btn ghost sm" id="lyrBtn" style="margin-left:6px">${s.lyrics&&s.lyrics.length?'Edit lyrics':'Add lyrics'}</button>`+
      (nEd?` <button class="btn ghost sm" id="resetEd" style="margin-left:6px">Undo my ${nEd} note edit${nEd>1?'s':''}</button>`:'');
    const a1=$('#addStemBtn');if(a1)a1.onclick=()=>$('#stemIn').click();
    const a0=$('#instBtn');if(a0)a0.onclick=()=>$('#instIn').click();
    const a2=$('#rmStem');if(a2)a2.onclick=removeStem;
    $('#lyrBtn').onclick=openLyricsEditor;
    const a3=$('#resetEd');if(a3)a3.onclick=()=>{s.edits={del:[],oct:{}};refreshNotes(s)};
    return;
  }
  bn.hidden=true;
  let seq=[];try{seq=parseSeq(s.seq)}catch(e){}
  const [lo,hi]=seq.length?rangeOf(seq):[60,60];
  const K=keyOf(s),ak=autoKeyFor(s);
  $('#songMeta').textContent=`${s.group==='Warm-ups'?'Warm-up':s.group==='Songs'?'Song':s.group==='Your drills'?'Drill':'Custom'} · ${s.bpb||4}/4 · ${Math.round(s.bpm*S.tempo/100)} bpm · ${mname(lo+K)}–${mname(hi+K)}${ak?' · moved to fit your range':''}`;
  $('#songTitle').textContent=s.title;
  $('#songDesc').textContent=s.desc||'';
  const t=S.transpose,sg=v=>(v>0?'+':'−')+Math.abs(v);
  $('#keyLbl').textContent=ak?`Auto ${sg(ak)}${t?' '+sg(t):''}`:t===0?'Original':sg(t)+' semitone'+(Math.abs(t)===1?'':'s');
  $('#keyLbl').title=ak?'Moved into your vocal range automatically (turn off in Train → Your vocal range). +/− nudge it further.':'';
  $('#tempo').value=S.tempo;$('#tempoLbl').textContent=S.tempo+'%';
}
function bestFor(id){const h=store.get('history',[]);let b=null;for(const x of h)if(x.id===id&&(b===null||x.score>b))b=x.score;return b}
function renderLib(){
  const groups={};for(const s of allSongs())(groups[s.group]=groups[s.group]||[]).push(s);
  const wrap=$('#libList');wrap.innerHTML='';
  for(const [g,list] of Object.entries(groups)){
    const div=document.createElement('div');div.className='lib-group';div.innerHTML=`<h4>${esc(g)}</h4>`;
    for(const s of list){
      if(isAudio(s)){
        const best=bestFor(s.id);
        const b=document.createElement('button');b.className='song'+(P.song&&P.song.id===s.id?' active':'');
        b.innerHTML=`<span class="ic">♪</span><span class="tx"><div class="t">${esc(s.title)}</div><div class="m"><span>${s.dur?fmtTime(s.dur):''}${s.count!=null?` · ${s.count} notes`:''}</span></div></span>${best!=null?`<span class="best">${best}%</span>`:''}<span class="del" title="Remove track" data-del="1">×</span>`;
        b.onclick=e=>{if(e.target.closest('[data-del]')){e.stopPropagation();if(confirm(`Remove “${s.title}” from your tracks?`))deleteTrack(s.id);return}loadSong(s.id)};
        div.appendChild(b);continue;
      }
      let seq=[];try{seq=parseSeq(s.seq)}catch(e){}
      const [lo,hi]=seq.length?rangeOf(seq):[60,60];
      const best=bestFor(s.id);
      const lvl=s.level?`<span class="lvl">${[1,2,3].map(i=>`<i class="${i<=s.level?'f':''}"></i>`).join('')}</span>`:'';
      const b=document.createElement('button');b.className='song'+(P.song&&P.song.id===s.id?' active':'');
      b.innerHTML=`<span class="ic">${esc(nm(lo).replace('♯','♯'))}</span><span class="tx"><div class="t">${esc(s.title)}</div><div class="m">${lvl}<span>${mname(lo)}–${mname(hi)}</span></div></span>${best!=null?`<span class="best">${best}%</span>`:''}${g==='My melodies'?`<span class="del" title="Delete" data-del="${esc(s.id)}">×</span>`:''}`;
      b.onclick=e=>{
        const d=e.target.closest('[data-del]');
        if(d){e.stopPropagation();if(confirm(`Delete “${s.title}”?`)){custom=custom.filter(c=>c.id!==s.id);store.set('custom',custom);if(S.songId===s.id)loadSong(BUILTIN[0].id);else renderLib()}return}
        loadSong(s.id);
      };
      div.appendChild(b);
    }
    wrap.appendChild(div);
  }
}
async function startRun(mode,opt={}){
  stopReplay();
  if(P.running) stopRun();
  await ensureCtx();
  if(mode==='sing'&&!micOn){const ok=await enableMic();if(!ok)return}
  closeModal();build();$('#notePop').hidden=true;
  if(!opt.pass){P.passes=[];P.lastPass=null;updateLoopPill()}
  if(P.loop&&!opt.pass)P.offset=P.loop.a;
  P.mode=mode;P.running=true;
  if(isAudio()){
    const d=trackData[P.song.id];
    if(P.offset>=d.dur-1)P.offset=0;
    const cd=mode==='sing'&&!opt.pass?3:0,t0=actx.currentTime+.25+cd;
    P.runFrom=P.offset;P.unit=1;P.startT=t0-P.offset;P.nodes=[];
    P.gO=actx.createGain();P.gK=actx.createGain();P.gO.connect(out());P.gK.connect(out());applyMix(true);
    const so=actx.createBufferSource();so.buffer=d.orig;so.connect(P.gO);
    const sk=actx.createBufferSource();sk.buffer=d.kar;sk.connect(P.gK);
    so.start(t0,P.offset);sk.start(t0,P.offset);P.nodes.push(so,sk);
    if(S.guide)for(const n of P.notes)if(n.start>=P.offset)P.nodes.push(...tone(n.midi,P.startT+n.start,n.dur*.95,.07));
    if(mode==='sing')startRecording();
    updateTransport();updateHint();return;
  }
  if(P.offset>=P.total-.5)P.offset=0;
  P.runFrom=P.offset;P.unit=P.spb;
  const lead=opt.pass?.1:.25,t=actx.currentTime,ci=opt.pass?2:P.countIn;
  P.startT=t+lead+ci*P.spb-P.offset;P.nodes=[];
  for(let i=0;i<ci;i++)P.nodes.push(...click(t+lead+i*P.spb,i===0));
  if(mode==='listen'||S.guide)for(const n of P.notes)if(n.midi!=null&&n.start>=P.offset-.01)P.nodes.push(...tone(n.midi,P.startT+n.start,n.dur*.95,mode==='listen'?.18:.08));
  if(mode==='sing')startRecording();
  updateTransport();updateHint();
}
function applyMix(instant){
  if(!P.gO)return;const d=trackData[P.song&&P.song.id];const v=d&&d.an.mono?1:S.vox,m=S.music;
  if(instant){P.gO.gain.value=m*v;P.gK.gain.value=m*(1-v);return}
  const t=actx.currentTime;P.gO.gain.setTargetAtTime(m*v,t,.04);P.gK.gain.setTargetAtTime(m*(1-v),t,.04);
}
function stopRun(){
  if(P.syncLyr){const f=finishLyrSync;P.syncLyr&&setTimeout(f,0)}
  discardRecording();
  P.nodes.forEach(n=>{try{n.stop()}catch(e){}});P.nodes=[];
  if(P.gO){try{P.gO.disconnect();P.gK.disconnect()}catch(e){}P.gO=P.gK=null}
  P.running=false;P.mode=null;P.active=null;P.vAct=null;
  $('#countdown').classList.remove('show');updateTransport();updateHint();
}
function finishRun(){
  const mode=P.mode,sung=Math.max(0,P.now-P.runFrom);
  const notes=P.notes.filter(n=>n.midi!=null&&n.total>0);
  const recP=mode==='sing'?finishRecording():null;
  const snapshot=P.notes.map(n=>({midi:n.midi,label:n.label,start:n.start,dur:n.dur,hits:n.hits,total:n.total})),trace=P.trace.map(p=>({t:p.t,m:p.m,s:p.s}));
  stopRun();
  if(mode==='sing'&&notes.length){const r=computeResults(notes);r.sung=sung;r.snapshot=snapshot;r.trace=trace;saveSession(r);showResults(r);renderLib();
    const tp=saveTake(recP,r);const lb=$('#listenBack');if(lb){lb.textContent='Saving…';tp.then(t=>{const b=$('#listenBack');if(!b)return;if(t){b.disabled=false;b.textContent='▶ Listen back';b.onclick=()=>playTake(t)}else b.textContent='No recording'})}}
}
// Stop pressed mid-song: show results if enough was sung, otherwise just stop
function stopSing(){
  const cur=P.notes.filter(n=>n.midi!=null&&n.total>0).length;
  if(P.mode==='sing'&&cur<4&&P.lastPass&&P.lastPass.length){P.notes=P.lastPass;finishRun();return}
  if(P.mode==='sing'&&cur>=4)finishRun();else stopRun();
}
function updateTransport(){
  const sing=$('#singBtn'),lis=$('#listenBtn');
  const sOn=P.running&&P.mode==='sing',lOn=P.running&&P.mode==='listen';
  sing.classList.toggle('stop',sOn);sing.querySelector('span').textContent=sOn?'Stop':'Start singing';
  lis.classList.toggle('stop',lOn);lis.querySelector('span').textContent=lOn?'Stop':'Listen';
}
function updateHint(){
  const h=$('#stageHint');
  if(P.replay){h.classList.remove('hide');h.innerHTML=`<span><b>Playing your take</b> · ${P.replay.take.score}% · listen for where your line leaves the bars</span><button class="btn ghost sm" id="stopRp">■ Stop</button>`;$('#stopRp').onclick=stopReplay;return}
  if(P.running){h.classList.add('hide');return}
  h.classList.remove('hide');
  h.innerHTML=micOn
    ?`<span><b>Ready.</b> Press <kbd>Space</kbd> to sing along, or <kbd>L</kbd> to hear it first.</span>`
    :`<span>Turn on your mic to see your voice on the lanes</span><button class="btn primary sm" id="hintMic">Enable mic</button>`;
  const b=$('#hintMic');if(b)b.onclick=enableMic;
}
function tickPractice(){
  let now;
  if(P.replay){
    P.now=actx.currentTime-P.replay.t0+P.replay.take.s0;
    if(actx.currentTime-P.replay.t0>P.replay.dur+.3){stopReplay();return}
    drawRoll();updateHud();updateLyrics();drawTimeline();return;
  }
  if(P.running){
    // "now" = the song position you are HEARING (output delay removed);
    // "vt"  = the song position when the voice the mic is delivering right now was sung.
    now=actx.currentTime-P.startT-outLat();
    const vt=now-inLat-ANALYSIS_LAG-(S.sync||0)/1000;P.vt=vt;
    const cd=$('#countdown');
    if(now<P.runFrom){cd.textContent=Math.ceil((P.runFrom-now)/P.unit-1e-6);cd.classList.add('show')}else cd.classList.remove('show');
    const act=P.notes.find(n=>n.midi!=null&&now>=n.start&&now<n.start+n.dur)||null;
    if(act)P.ref=act.midi;else{const nx=P.notes.find(n=>n.midi!=null&&n.start>now);if(nx&&nx.start-now<P.spb*1.5)P.ref=nx.midi}
    P.active=act;
    const va=P.notes.find(n=>n.midi!=null&&vt>=n.start&&vt<n.start+n.dur)||null;P.vAct=va;
    if(P.mode==='sing'&&vt>=P.runFrom-P.unit*.5){
      let st=null,um=null,ui=null,uc=null;
      const ref=va?va.midi:P.ref;
      if(pitch){um=fold(pitch.midi,ref);if(va){ui=fold(pitch.midi,va.midi);uc=fold(vibCentre(),va.midi)}}
      // on pitch if EITHER the exact pitch or the vibrato centre (average of the last ~0.2 s) is in range:
      // straight singing is judged exactly as before, and vibrato swinging around a centred note isn't punished
      const dev=va&&ui!=null?Math.min(Math.abs(ui-va.midi),Math.abs(uc-va.midi))*100:null;
      // timing slack: within 0.12 s of a note change, matching the neighbouring note also counts
      // (nobody hits every change to the hundredth of a second)
      const SLACK=.12,devTo=n=>{if(!n||!pitch)return 1e9;const a=fold(pitch.midi,n.midi),b=fold(vibCentre(),n.midi);return Math.min(Math.abs(a-n.midi),Math.abs(b-n.midi))*100};
      let slackDev=dev;
      if(va&&pitch)for(const dt of [-SLACK,SLACK]){const k=P.notes.find(n=>n.midi!=null&&vt+dt>=n.start&&vt+dt<n.start+n.dur);if(k&&k!==va)slackDev=Math.min(slackDev,devTo(k))}
      if(dev!=null)st=slackDev<=TOL[S.tol]?'hit':dev<=TOL[S.tol]*2.2?'near':'off';
      const act=va;
      if(act&&!act.orn&&vt>=P.runFrom&&vt>=act.start+Math.min(.12,act.dur*.2)&&vt<=act.start+act.dur-.04){
        act.total++;
        if(ui!=null){const d=(Math.abs(uc-act.midi)<Math.abs(ui-act.midi)?uc-act.midi:ui-act.midi)*100;act.voiced++;if(Math.abs(d)<=100){act.near++;act.sum+=d;act.sq+=d*d}if(slackDev<=TOL[S.tol])act.hits++}
      }
      if(um!=null)P.trace.push({t:vt,m:um,s:st});
    }
    if(P.loop&&now>=P.loop.b){P.now=now;loopRestart();return}
    if(now>P.total+.5){P.now=now;finishRun();return}
  }else now=P.offset-.6;
  P.now=now;drawRoll();updateHud();updateLyrics();
  drawTimeline();
}
function refreshNotes(meta){
  if(P.running)stopRun();applyNotes(meta);build();renderLib();renderHead();saveTrackMeta(meta);
}
let popNote=null;
function noteAt(ev){
  const L=P._lay;if(!L||!isAudio()||P.running)return null;
  const r=$('#roll').getBoundingClientRect(),x=ev.clientX-r.left,y=ev.clientY-r.top;
  const nh=Math.max(10,Math.min(L.lh*.8,30));
  for(const n of P.notes){if(n.midi==null)continue;const x0=L.X(n.start),x1=L.X(n.start+n.dur),yy=L.Y(n.midi);
    if(x>=x0&&x<=x1&&Math.abs(y-yy)<=nh/2+3)return {n,x:(Math.max(x0,L.gut)+Math.min(x1,L.W))/2,y:yy-nh/2}}
  return null;
}
$('#roll').addEventListener('mousemove',e=>{$('#roll').style.cursor=noteAt(e)?'pointer':'default'});
$('#roll').addEventListener('click',e=>{
  const hit=noteAt(e),pop=$('#notePop');
  if(!hit){pop.hidden=true;popNote=null;return}
  popNote=hit.n;$('#npLbl').textContent=mname(hit.n.label);
  pop.style.left=clamp(hit.x,120,$('#stage').clientWidth-120)+'px';pop.style.top=Math.max(50,hit.y)+'px';pop.hidden=false;
});
$('#notePop').addEventListener('click',e=>{
  const a=e.target.closest('[data-a]');if(!a||!popNote)return;
  const meta=P.song;meta.edits=meta.edits||{del:[],oct:{}};const k=popNote.key;
  if(a.dataset.a==='del')meta.edits.del.push(k);
  else{meta.edits.oct[k]=(meta.edits.oct[k]||0)+(a.dataset.a==='up'?12:-12);if(!meta.edits.oct[k])delete meta.edits.oct[k]}
  $('#notePop').hidden=true;popNote=null;refreshNotes(meta);
});
function drawTimeline(){
  const c=$('#tlCv');if(!c.clientWidth||!P.song)return;const [g,W,H]=fitCanvas(c);g.clearRect(0,0,W,H);
  const dur=Math.max(1,P.total),X=t=>t/dur*W;
  const ms=P.notes.filter(n=>n.midi!=null).map(n=>n.midi);
  const lo=(ms.length?Math.min(...ms):48)-2,hi=(ms.length?Math.max(...ms):72)+2,Y=m=>6+(1-(m-lo)/Math.max(1,hi-lo))*(H-12);
  const pos=P.running||P.replay?clamp(P.now,0,dur):P.offset;
  const lp=P.loopDraft||P.loop;
  if(lp){g.fillStyle='rgba(147,197,253,.13)';g.fillRect(X(lp.a),0,X(lp.b)-X(lp.a),H);g.fillStyle='rgba(147,197,253,.85)';g.fillRect(X(lp.a)-1,0,2,H);g.fillRect(X(lp.b)-1,0,2,H)}
  else{g.fillStyle='rgba(255,196,107,.06)';g.fillRect(0,0,X(pos),H)}
  for(const n of P.notes){
    if(n.midi==null)continue;const played=n.total>0;
    g.fillStyle=played?(n.hits/n.total>=.75?COL.hit:n.hits/n.total>=.4?COL.near:COL.off):'rgba(255,255,255,.35)';
    g.fillRect(X(n.start),Y(n.midi)-1.5,Math.max(1.5,X(n.dur)),3);
  }
  g.fillStyle='#ffc46b';g.fillRect(Math.round(X(pos))-1,0,2,H);
  g.beginPath();g.moveTo(X(pos)-5,0);g.lineTo(X(pos)+5,0);g.lineTo(X(pos),6);g.fill();
  g.font='600 10px JetBrains Mono';g.textBaseline='bottom';g.fillStyle='rgba(243,240,248,.7)';
  g.textAlign='left';g.fillText(fmtTime(pos),6,H-4);g.textAlign='right';g.fillText(fmtTime(dur),W-6,H-4);
}
/* ---------- timeline: click = start here, drag = loop a section ---------- */
let tlDrag=null;
const tlTime=e=>{const r=$('#timeline').getBoundingClientRect();return clamp((e.clientX-r.left)/r.width,0,1)*Math.max(1,P.total)};
$('#timeline').addEventListener('pointerdown',e=>{if(e.target.closest('.loop-pill'))return;tlDrag={x:e.clientX,t:tlTime(e),moved:false};$('#timeline').setPointerCapture(e.pointerId)});
$('#timeline').addEventListener('pointermove',e=>{if(!tlDrag)return;if(Math.abs(e.clientX-tlDrag.x)>6)tlDrag.moved=true;if(tlDrag.moved){const t=tlTime(e);P.loopDraft={a:Math.min(t,tlDrag.t),b:Math.max(t,tlDrag.t)}}});
$('#timeline').addEventListener('pointerup',e=>{
  if(!tlDrag)return;const d=tlDrag;tlDrag=null;const draft=P.loopDraft;P.loopDraft=null;
  const mode=P.running?P.mode:null;
  if(d.moved&&draft&&draft.b-draft.a>=1){
    if(P.running)stopRun();build();P.loop={a:Math.max(0,draft.a),b:Math.min(P.total,draft.b)};P.offset=P.loop.a;P.passes=[];
    updateLoopPill();toast(`Looping ${fmtTime(P.loop.a)}–${fmtTime(P.loop.b)}. Press Space to start.`);
    if(mode)startRun(mode);return;
  }
  if(d.moved)return;
  if(P.running)stopRun();build();P.loop=null;updateLoopPill();P.offset=Math.max(0,d.t-.5);
  if(mode)startRun(mode);
});
function updateLoopPill(){
  const pl=$('#loopPill');if(!P.loop){pl.hidden=true;return}
  const ps=P.passes||[];
  pl.hidden=false;pl.querySelector('span').textContent=`Loop ${fmtTime(P.loop.a)}–${fmtTime(P.loop.b)}${ps.length?` · pass ${ps.length+1} · last ${ps[ps.length-1]}%`:''}`;
}
$('#loopPill button').onclick=e=>{e.stopPropagation();P.loop=null;P.passes=[];updateLoopPill();toast('Loop cleared')};
function passScore(){
  const ns=P.notes.filter(n=>n.midi!=null&&n.total>0);if(!ns.length)return null;
  const w=ns.reduce((a,n)=>a+n.dur,0)||1;return Math.round(ns.reduce((a,n)=>a+n.hits/n.total*n.dur,0)/w*100);
}
function loopRestart(){
  const mode=P.mode;
  if(mode==='sing'){const sc=passScore();if(sc!=null){P.passes.push(sc);P.lastPass=P.notes.filter(n=>n.midi!=null&&n.total>0).map(n=>({...n}));toast(`Pass ${P.passes.length}: ${sc}%`)}}
  if(P.rec)discardRecording();
  P.offset=P.loop.a;startRun(mode,{pass:true});updateLoopPill();
}
const COL={hit:'#5eead4',near:'#fbbf24',off:'#fb7185'};
function rr(g,x,y,w,h,r){r=Math.min(r,h/2,w/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function fitCanvas(c){const W=c.clientWidth,H=c.clientHeight,d=window.devicePixelRatio||1;if(c.width!==Math.round(W*d)||c.height!==Math.round(H*d)){c.width=Math.round(W*d);c.height=Math.round(H*d)}const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return [g,W,H]}
/* ---------- lane zoom ---------- */
const Z={span:typeof S.zoom==='number'?S.zoom:null,center:null};
const fitSpan=()=>Math.max(6,P.hi-P.lo);
function viewRange(){
  if(!Z.span)return [P.lo,P.hi];
  const c=Z.center!=null?Z.center:(P.lo+P.hi)/2;return [c-Z.span/2,c+Z.span/2];
}
function zoomView(f,anchor){
  const cur=Z.span||fitSpan(),[lo,hi]=viewRange(),c=(lo+hi)/2;
  const ns=clamp(cur*f,5,48);if(Math.abs(ns-cur)<.01)return;
  const a=anchor!=null?anchor:c;
  Z.center=a-(a-c)*ns/cur;Z.span=ns;clampCenter();S.zoom=ns;saveS();updateZoomUI();
}
function panView(semis){
  if(!Z.span){Z.span=fitSpan();Z.center=(P.lo+P.hi)/2}
  if(Z.center==null)Z.center=(P.lo+P.hi)/2;
  Z.center+=semis;clampCenter();Z.manualAt=performance.now();updateZoomUI();
}
function fitView(){Z.span=null;Z.center=null;S.zoom=null;saveS();updateZoomUI()}
function clampCenter(){if(Z.center!=null)Z.center=clamp(Z.center,P.lo-12+Z.span/2*0,P.hi+12)}
function updateZoomUI(){
  const sp=Z.span;
  $('#zoomLbl').textContent=!sp?'All':sp>=11.5?`${+(sp/12).toFixed(1)} oct`:`${Math.round(sp)} notes`;
  $('#zoomLbl').title=!sp?'Showing the whole song':`Showing ${Math.round(sp)} semitones`;
  $('#zoomCtl [data-z=in]').disabled=!!sp&&sp<=5.01;
  $('#zoomCtl [data-z=out]').disabled=!!sp&&sp>=47.99;
}
// while singing zoomed-in, glide the view so the current/next note stays on screen
function followView(){
  if(!Z.span||!P.running)return;
  if(Z.manualAt&&performance.now()-Z.manualAt<1500)return;
  const tgt=P.active||P.notes.find(n=>n.midi!=null&&n.start>P.now);if(!tgt)return;
  const m=(tgt.label!=null?tgt.label:tgt.midi);
  if(Z.center==null)Z.center=(P.lo+P.hi)/2;
  const lo=Z.center-Z.span/2,hi=Z.center+Z.span/2,mg=Math.min(2,Z.span*.2);
  if(m<lo+mg||m>hi-mg)Z.center+=(m-Z.center)*.08;
}
$('#zoomCtl').addEventListener('click',e=>{
  const b=e.target.closest('[data-z]');if(!b)return;const z=b.dataset.z;
  if(z==='in')zoomView(1/1.25);else if(z==='out')zoomView(1.25);else if(z==='fit')fitView();
  else panView(z==='up'?2:-2);
});
$('#stage').addEventListener('wheel',e=>{
  if(e.target.closest('.zoom,.note-pop,.stage-hint'))return;
  const L=P._lay;if(!L)return;
  if(e.ctrlKey||e.metaKey){ // pinch / Ctrl+scroll = zoom around the pointer
    e.preventDefault();
    const r=$('#roll').getBoundingClientRect(),y=e.clientY-r.top,anchor=L.vhi-(y-L.pad)/L.lh;
    zoomView(Math.exp(clamp(e.deltaY,-120,120)*.0022),anchor);
  }else if(Z.span&&Z.span<fitSpan()+24){ // plain scroll = move up/down
    e.preventDefault();panView(-e.deltaY/Math.max(8,L.lh)*.5);
  }
},{passive:false});
$('#tzIn').onclick=()=>{T.span=clamp(T.span-4,6,36);store.set('trailSpan',T.span);tzLbl()};
$('#tzOut').onclick=()=>{T.span=clamp(T.span+4,6,36);store.set('trailSpan',T.span);tzLbl()};
function tzLbl(){$('#tzLbl').textContent=T.span%12===0?`${T.span/12} octave${T.span>12?'s':''}`:`${T.span} notes`}
function drawRoll(){
  const c=$('#roll');if(!c.clientWidth)return;
  const [g,W,H]=fitCanvas(c);g.clearRect(0,0,W,H);
  const gut=58,ph=gut+(W-gut)*.28,pps=P.pps,now=P.now,pad=14;
  followView();
  const [vlo,vhi]=viewRange(),span=vhi-vlo,lh=(H-pad*2)/span;
  // Y: real pitch → screen (shifted by the song's tuning so in-tune singing sits mid-lane); YL: lane rows
  const tu=P.tune||0,YL=m=>pad+(vhi-m)*lh,Y=m=>YL(m-tu), X=t=>ph+(t-now)*pps;
  P._lay={gut,ph,pps,now,lh,X,Y,W,H,pad,vhi};
  // lanes
  g.textAlign='right';g.textBaseline='middle';
  g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
  for(let m=Math.floor(vlo);m<=Math.ceil(vhi);m++){
    const y=YL(m),blk=isBlack(m);
    if(blk){g.fillStyle='rgba(0,0,0,.22)';g.fillRect(gut,y-lh/2,W-gut,lh)}
    g.strokeStyle=pc(m)===0?'rgba(255,255,255,.09)':'rgba(255,255,255,.03)';g.lineWidth=1;
    g.beginPath();g.moveTo(gut,Math.round(y+lh/2)+.5);g.lineTo(W,Math.round(y+lh/2)+.5);g.stroke();
    const showLbl=lh>=13?(!blk||lh>16):lh>=7?[0,4,7].includes(pc(m)):pc(m)===0;
    if(showLbl&&y>4&&y<H-4){g.fillStyle=pc(m)===0?'#d6cfe4':blk?'#4f495c':'#77708a';g.font=`${pc(m)===0?600:500} ${lh<13?10:lh>24?12:11}px JetBrains Mono`;g.fillText(mname(m),gut-12,y)}
  }
  g.restore();
  // gutter divider
  g.fillStyle='rgba(255,255,255,.05)';g.fillRect(gut,0,1,H);
  g.save();g.beginPath();g.rect(gut+1,0,W-gut,H);g.clip();
  // beat grid
  const b0=Math.floor((now-(ph-gut)/pps)/P.spb),b1=Math.ceil((now+(W-ph)/pps)/P.spb);
  for(let b=b0;b<=b1;b++){const x=X(b*P.spb);const bar=((b%P.countIn)+P.countIn)%P.countIn===0;g.fillStyle=bar?'rgba(255,255,255,.07)':'rgba(255,255,255,.025)';g.fillRect(Math.round(x),0,1,H)}
  if(P.loop){const xa=X(P.loop.a),xb=X(P.loop.b);g.fillStyle='rgba(147,197,253,.05)';g.fillRect(xa,0,xb-xa,H);g.fillStyle='rgba(147,197,253,.45)';g.fillRect(Math.round(xa),0,1,H);g.fillRect(Math.round(xb),0,1,H);
    g.font='700 10px JetBrains Mono';g.textAlign='left';g.fillStyle='rgba(191,219,254,.8)';if(xa>gut)g.fillText('LOOP START',xa+6,H-10);if(xb<W)g.fillText('LOOP END',xb+6,H-10)}
  // detected vocal contour of the original singer (uploaded tracks)
  if(isAudio()){
    const an=trackData[P.song.id].an,cn=an.contour,hs=an.hopSec;
    const fA=Math.max(1,Math.floor((now-(ph-gut)/pps-an.t0)/hs)),fB=Math.min(cn.length-1,Math.ceil((now+(W-ph)/pps-an.t0)/hs));
    g.strokeStyle='rgba(255,196,107,.28)';g.lineWidth=1.5;g.setLineDash([3,4]);g.beginPath();
    for(let f=fA;f<=fB;f++){const a=cn[f-1],b=cn[f];if(a===a&&b===b&&Math.abs(a-b)<1.5){g.moveTo(X(an.t0+(f-1)*hs),Y(a));g.lineTo(X(an.t0+f*hs),Y(b))}}
    g.stroke();g.setLineDash([]);
  }
  // notes
  const nh=Math.max(10,Math.min(lh*.8,30));
  for(const n of P.notes){
    if(n.midi==null)continue;
    const x0=X(n.start)+1,x1=X(n.start+n.dur)-2;if(x1<gut||x0>W)continue;
    const y=Y(n.midi)-nh/2,w=Math.max(4,x1-x0);
    const isAct=P.running&&P.active===n,scored=n.total>0&&!isAct;
    g.shadowBlur=0;
    if(isAct){
      const gr=g.createLinearGradient(x0,0,x1,0);gr.addColorStop(0,'#ff8a5c');gr.addColorStop(1,'#ffc46b');
      g.shadowColor='rgba(255,138,92,.7)';g.shadowBlur=22;g.fillStyle=gr;rr(g,x0,y,w,nh,8);g.fill();g.shadowBlur=0;
    }else if(scored){
      const s=n.hits/n.total,col=s>=.75?COL.hit:s>=.4?COL.near:COL.off;
      g.fillStyle=col+'33';rr(g,x0,y,w,nh,8);g.fill();g.strokeStyle=col+'aa';g.lineWidth=1.5;g.stroke();
    }else if(n.orn){ // quick ornament: shown, not scored
      g.fillStyle='rgba(255,255,255,.055)';rr(g,x0,y+nh*.25,w,nh*.5,5);g.fill();g.setLineDash([3,3]);g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=1;g.stroke();g.setLineDash([]);
    }else{
      g.fillStyle='rgba(255,255,255,.075)';rr(g,x0,y,w,nh,8);g.fill();g.strokeStyle='rgba(255,255,255,.2)';g.lineWidth=1;g.stroke();
    }
    if(n.syl&&lh>=14&&S.lyrics!==false&&x1>gut){g.textAlign='left';g.font='600 10.5px Manrope';g.fillStyle=isAct?'#ffc46b':'rgba(243,240,248,.45)';g.fillText(n.syl,Math.max(x0,gut+4)+2,y+nh+9)}
    if(w>38&&nh>=14){g.textAlign='left';g.font='700 11px Manrope';g.fillStyle=isAct?'#2a140a':scored?'rgba(255,255,255,.85)':'rgba(255,255,255,.6)';g.fillText(mname(n.label!=null?n.label:n.midi),Math.max(x0,gut+4)+9,y+nh/2+.5)}
  }
  // trace
  let pts;
  if((P.running&&P.mode==='sing')||P.replay){const tmin=now-(ph-gut)/pps-.2;pts=P.trace.filter(p=>p.t>tmin&&(!P.replay||p.t<=now)).map(p=>({x:X(p.t),y:Y(p.m),s:p.s,t:p.t}))}
  else{const nw=performance.now()/1000;pts=live.filter(p=>p.t>nw-(ph-gut)/pps-.2).map(p=>({x:ph+(p.t-nw)*pps,y:Y(fold(p.m,P.center)),s:null,t:p.t}))}
  g.lineCap='round';g.lineJoin='round';g.lineWidth=3.5;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];if(b.t-a.t>.12||Math.abs(b.y-a.y)>lh*1.6)continue;
    g.strokeStyle=b.s?COL[b.s]:'rgba(243,240,248,.85)';g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }
  // playhead
  const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'rgba(255,196,107,0)');gr.addColorStop(.5,'rgba(255,196,107,.7)');gr.addColorStop(1,'rgba(255,196,107,0)');
  g.fillStyle=gr;g.fillRect(ph-1,0,2,H);
  // live dot
  if(pitch&&micOn&&!P.replay){
    const sing=P.running&&P.mode==='sing',va=sing?P.vAct:null;
    const m=sing?fold(pitch.midi,va?va.midi:P.ref):fold(pitch.midi,P.center);const y=clamp(Y(m),4,H-4);
    const dx=sing?X(P.vt):ph;
    let col='#f3f0f8';
    if(va){const d=Math.abs(m-va.midi)*100;col=d<=TOL[S.tol]?COL.hit:d<=TOL[S.tol]*2.2?COL.near:COL.off}
    const rg=g.createRadialGradient(dx,y,0,dx,y,22);rg.addColorStop(0,col+'88');rg.addColorStop(1,col+'00');
    g.fillStyle=rg;g.beginPath();g.arc(dx,y,22,0,7);g.fill();
    g.fillStyle=col;g.beginPath();g.arc(dx,y,6.5,0,7);g.fill();
    g.strokeStyle='#0c0b11';g.lineWidth=2.5;g.stroke();
  }
  g.restore();
  // left fade
  const lf=g.createLinearGradient(gut,0,gut+50,0);lf.addColorStop(0,'rgba(17,15,23,.9)');lf.addColorStop(1,'rgba(17,15,23,0)');g.fillStyle=lf;g.fillRect(gut+1,0,50,H);
}
let lastHud='';
function updateHud(){
  const ta=P.running?(P.mode==='sing'?P.vAct:P.active):null,tgt=ta?ta.midi:null;
  let c=null;const lp=P.replay?null:pitch; // no live pitch while replaying a take
  if(lp){const ce=vibCentre();c=tgt!=null?(fold(ce,tgt)-tgt)*100:(ce-Math.round(ce))*100}
  const done=P.notes.filter(n=>n.midi!=null&&n.total>0&&n!==P.vAct);
  const dw=done.reduce((a,n)=>a+n.dur,0)||1,sc=done.length?Math.round(done.reduce((a,n)=>a+n.hits/n.total*n.dur,0)/dw*100)+'%':'—';
  const tStr=ta?mname(ta.label!=null?ta.label:ta.midi):P.running?'·':'—';
  const yStr=lp?mname(lp.midi-(P.tune||0)):'—';
  const cStr=c==null?'—':Math.abs(c)>=100?(c>0?'+':'−')+(Math.abs(c)/100).toFixed(1)+' st':(c>0?'+':c<0?'−':'')+Math.abs(Math.round(c))+'¢';
  const key=tStr+yStr+cStr+sc;
  const nd=$('#hudNeedle');
  nd.style.left=(c==null?50:50+clamp(c,-100,100)/2)+'%';
  nd.classList.toggle('live',c!=null);
  const tol=TOL[S.tol];const ab=c==null?null:Math.abs(c);
  nd.classList.toggle('hit',ab!=null&&ab<=tol);nd.classList.toggle('near',ab!=null&&ab>tol&&ab<=tol*2.2);nd.classList.toggle('off',ab!=null&&ab>tol*2.2);
  if(key===lastHud)return;lastHud=key;
  $('#hudTarget').textContent=tStr;$('#hudYou').textContent=yStr;$('#hudCents').textContent=cStr;$('#hudScore').textContent=sc;
}
