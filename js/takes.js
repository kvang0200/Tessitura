// Tessitura · Recording your singing and playing takes back.
'use strict';
/* ================= TAKES: record & play back ================= */
function startRecording(){
  P.rec=null;
  if(!micStream||typeof MediaRecorder==='undefined')return;
  const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mt=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||'';
  try{
    const rec=new MediaRecorder(micStream,mt?{mimeType:mt}:undefined),chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.start();
    // song position that lines up with the first moment of the recording
    P.rec={rec,chunks,mime:rec.mimeType||mt||'audio/webm',s0:actx.currentTime-P.startT-outLat()-inLat-(S.sync||0)/1000};
  }catch(e){P.rec=null}
}
function finishRecording(){
  const R=P.rec;P.rec=null;if(!R)return Promise.resolve(null);
  return new Promise(res=>{R.rec.onstop=()=>res(new Blob(R.chunks,{type:R.mime}));try{R.rec.stop()}catch(e){res(null)}})
    .then(b=>b&&b.size>2000?{blob:b,mime:R.mime,s0:R.s0}:null);
}
function discardRecording(){const R=P.rec;P.rec=null;if(R)try{R.rec.onstop=null;R.rec.stop()}catch(e){}}
async function saveTake(recP,r){
  const rec=await recP;if(!rec)return null;
  const take={id:'k'+Date.now(),songId:P.song.id,title:P.song.title,date:Date.now(),score:r.score,s0:rec.s0,mime:rec.mime,blob:rec.blob,
    kind:isAudio()?'audio':'midi',tune:P.tune||0,
    notes:r.snapshot,trace:r.trace};
  try{
    await idb.tx('readwrite',s=>s.put(take),'takes');
    const all=await idb.tx('readonly',s=>s.getAll(),'takes');
    if(all&&all.length>40){all.sort((a,b)=>a.date-b.date);for(const t of all.slice(0,all.length-40))await idb.tx('readwrite',s=>s.delete(t.id),'takes')}
  }catch(e){}
  lastTake=take;updateTakesBtn();return take;
}
let lastTake=null;
async function takesFor(songId){try{const all=await idb.tx('readonly',s=>s.getAll(),'takes');return (all||[]).filter(t=>t.songId===songId).sort((a,b)=>b.date-a.date)}catch(e){return lastTake&&lastTake.songId===songId?[lastTake]:[]}}
async function updateTakesBtn(){const n=P.song?(await takesFor(P.song.id)).length:0;const b=$('#takesBtn');b.querySelector('span').textContent=n?`Takes (${n})`:'Takes';b.disabled=!n}
async function playTake(take){
  closeModal();if(P.running)stopRun();stopReplay();
  if(!P.song||P.song.id!==take.songId){await loadSong(take.songId);if(!P.song||P.song.id!==take.songId)return}
  await ensureCtx();
  let buf;try{buf=await decodeAudio(await take.blob.arrayBuffer())}catch(e){toast('This browser can’t play that recording back.');return}
  const t0=actx.currentTime+.3,nodes=[];
  const src=actx.createBufferSource();src.buffer=buf;const vg=actx.createGain();vg.gain.value=1.15;src.connect(vg);vg.connect(out());src.start(t0);nodes.push(src);
  if(S.replayBacking!==false){
    const d=trackData[take.songId];
    if(take.kind==='audio'&&d){const b=actx.createBufferSource();b.buffer=d.kar;const g=actx.createGain();g.gain.value=.5*S.music;b.connect(g);g.connect(out());b.start(t0+Math.max(0,-take.s0),Math.max(0,take.s0));nodes.push(b)}
    else for(const n of take.notes)if(n.midi!=null){const when=t0+(n.start-take.s0);if(when>actx.currentTime)nodes.push(...tone(n.midi,when,n.dur*.95,.06))}
  }
  P.replay={take,t0,nodes,dur:buf.duration};
  P.notes=take.notes.map(n=>({...n}));P.trace=take.trace;P.tune=take.tune||0;
  const ms=P.notes.filter(n=>n.midi!=null).map(n=>n.midi);if(ms.length){P.lo=Math.floor(Math.min(...ms))-4;P.hi=Math.ceil(Math.max(...ms))+4}
  P.offset=Math.max(0,take.s0);updateHint();
}
function stopReplay(){
  if(!P.replay)return;P.replay.nodes.forEach(n=>{try{n.stop()}catch(e){}});P.replay=null;build();updateHint();
}
async function openTakes(){
  const list=await takesFor(P.song.id);
  const fmt=d=>{const dt=new Date(d);return dt.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+dt.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
  const cls=s=>s>=75?'g':s>=45?'w':'b';
  $('#modal').innerHTML=`<div class="eyebrow">${esc(P.song.title)}</div><h2>Your takes</h2>
    <p class="muted" style="margin-top:6px;line-height:1.5">Listen back to hear what your pitch line looked like. Your voice plays with ${isAudio()?'the karaoke track':'a soft guide melody'} behind it.</p>
    <label class="toggle" style="margin-top:12px"><input type="checkbox" id="tkBack" ${S.replayBacking!==false?'checked':''}><span class="sw"></span>Play the backing with my voice</label>
    <div style="margin-top:12px">${list.length?list.map(t=>`<div class="row"><span class="t">${fmt(t.date)}</span><span class="pill ${cls(t.score)}">${t.score}%</span>
      <button class="btn ghost sm" data-play="${t.id}">▶ Play</button><button class="btn ghost sm" data-dl="${t.id}" title="Download">⬇</button><button class="btn ghost sm" data-rm="${t.id}" title="Delete">✕</button></div>`).join(''):'<div class="empty">No takes yet. Sing this song and your recording appears here.</div>'}</div>
    <div class="modal-actions"><button class="btn ghost" data-close>Close</button></div>`;
  openModal();
  $('#tkBack').onchange=e=>{S.replayBacking=e.target.checked;saveS()};
  $$('#modal [data-play]').forEach(b=>b.onclick=()=>playTake(list.find(t=>t.id===b.dataset.play)));
  $$('#modal [data-dl]').forEach(b=>b.onclick=()=>downloadTake(list.find(t=>t.id===b.dataset.dl)));
  $$('#modal [data-rm]').forEach(b=>b.onclick=async()=>{try{await idb.tx('readwrite',s=>s.delete(b.dataset.rm),'takes')}catch(e){}if(lastTake&&lastTake.id===b.dataset.rm)lastTake=null;updateTakesBtn();openTakes()});
}
function downloadTake(t){
  const ext=/mp4/.test(t.mime)?'m4a':/ogg/.test(t.mime)?'ogg':'webm';
  const a=document.createElement('a');a.href=URL.createObjectURL(t.blob);
  a.download=`${t.title.replace(/[^\w\- ]+/g,'')} - take ${new Date(t.date).toISOString().slice(0,16).replace('T',' ').replace(':','.')}.${ext}`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
