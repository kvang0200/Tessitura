// Tessitura · Tabs, buttons, keyboard shortcuts, drag-and-drop, the animation loop and start-up. Loaded last.
'use strict';
/* ================= NAV / EVENTS ================= */
let view='practice';
function showView(v){
  if(v!=='train'&&D.on)endDrill();
  if(v!=='practice'&&P.running)stopRun();
  if(v!=='practice')stopReplay();
  view=v;$$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $$('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));
  if(v==='progress')renderProgress();
  if(v==='train')renderTrain();
}
$$('.tabs button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('#micBtn').onclick=()=>micOn?disableMic():enableMic();
$('#helpBtn').onclick=openHelp;
$('#takesBtn').onclick=openTakes;
$('#lyrBox').addEventListener('click',tapLyric);
$('#lyrT').onchange=e=>{S.lyrics=e.target.checked;saveS();lyrKey=''};
$('#newSongBtn').onclick=openCustom;
$('#singBtn').onclick=()=>P.running&&P.mode==='sing'?stopSing():startRun('sing');
$('#listenBtn').onclick=()=>P.running&&P.mode==='listen'?stopRun():startRun('listen');
const changed=()=>{if(P.running)stopRun();saveS();P.offset=0;P.loop=null;P.passes=[];updateLoopPill();build();renderHead()};
const shiftKey=d=>{if(isAudio())return;S.transpose=clamp(S.transpose+d,-12,12);changed()};
$('#sync').oninput=e=>{S.sync=+e.target.value;$('#syncLbl').textContent=S.sync+' ms';saveS()};
$('#vox').oninput=e=>{S.vox=e.target.value/100;$('#voxLbl').textContent=e.target.value+'%';saveS();applyMix()};
$('#music').oninput=e=>{S.music=e.target.value/100;$('#musicLbl').textContent=e.target.value+'%';saveS();applyMix()};
$('#uploadBtn').onclick=()=>openUploadModal();
$('#instIn').onchange=e=>{const f=e.target.files[0];e.target.value='';addInstrumental(f)};
$('#stemIn').onchange=e=>{const f=e.target.files[0];e.target.value='';addStem(f)};
$$('#filtSeg button').forEach(b=>b.onclick=()=>{if(!isAudio())return;P.song.filter=+b.dataset.v;refreshNotes(P.song)});
let dragN=0;
addEventListener('dragenter',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){dragN++;$('#drop').classList.add('show')}});
addEventListener('dragleave',()=>{if(--dragN<=0){dragN=0;$('#drop').classList.remove('show')}});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();dragN=0;$('#drop').classList.remove('show');if(modalLocked)return;const f=[...e.dataTransfer.files];if(f.length){showView('practice');openUploadModal(f)}});
$('#keyDown').onclick=()=>shiftKey(-1);$('#keyUp').onclick=()=>shiftKey(1);
$('#tempo').oninput=e=>{S.tempo=+e.target.value;changed()};
$$('#tolSeg button').forEach(b=>b.onclick=()=>{S.tol=b.dataset.v;changed()});
$('#anyOct').onchange=e=>{S.anyOct=e.target.checked;changed()};
$('#guide').onchange=e=>{S.guide=e.target.checked;changed();if(S.guide)toast('Tip: wear headphones so the mic only hears your voice')};
addEventListener('keydown',e=>{
  if(e.target.matches('textarea,select,input:not([type=range]):not([type=checkbox])'))return;
  if(e.target.matches('input[type=range]')&&/^Arrow|^Page|^Home$|^End$/.test(e.key))return;
  if(modalLocked)return;
  if(e.key==='Escape'){if(modalOpen())closeModal();else if(P.replay)stopReplay();else if(P.running)stopRun();return}
  if(view!=='practice')return;
  const resOpen=modalOpen()&&$('#againBtn');
  if(modalOpen()&&!resOpen)return;
  if(P.syncLyr&&e.key==='Enter'){e.preventDefault();tapLyric();return}
  if(P.replay&&(e.code==='Space'||e.key==='Escape')){e.preventDefault();stopReplay();return}
  if(e.code==='Space'){e.preventDefault();P.running&&P.mode==='sing'?stopSing():startRun('sing')}
  else if(e.key==='l'||e.key==='L'){P.running&&P.mode==='listen'?stopRun():startRun('listen')}
  else if(e.key==='ArrowUp'&&e.shiftKey){e.preventDefault();panView(1)}
  else if(e.key==='ArrowDown'&&e.shiftKey){e.preventDefault();panView(-1)}
  else if(e.key==='+'||e.key==='='){zoomView(1/1.25)}
  else if(e.key==='-'||e.key==='_'){zoomView(1.25)}
  else if(e.key==='0'){fitView()}
  else if(e.key==='ArrowUp'){e.preventDefault();shiftKey(1)}
  else if(e.key==='ArrowDown'){e.preventDefault();shiftKey(-1)}
});
addEventListener('resize',()=>{if(view==='progress')drawProgChart()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&P.running){if(P.mode==='sing')stopSing();else stopRun();toast('Paused because the tab was hidden')}});

function loop(){
  if(micOn&&analyser)updatePitch();else level*=.9;
  $('#meterFill').style.width=Math.min(100,level*900)+'%';
  if(view==='practice')tickPractice();else if(view==='tuner')tickTuner();else if(view==='train')tickTrain();
  tickRange();
  requestAnimationFrame(loop);
}
buildKbd();updateMicUI();tzLbl();
P.song=BUILTIN[0];
(async()=>{
  try{const recs=await idb.all();tracks=(recs||[]).map(r=>{if(!r||typeof r!=='object')return null;const {blob,vocBlob,instBlob,...m}=r;return cleanTrackMeta(m)}).filter(Boolean).sort((a,b)=>b.created-a.created)}catch(e){}
  const saved=allSongs().find(x=>x.id===S.songId);
  await loadSong(saved&&!isAudio(saved)?saved.id:BUILTIN[0].id);
})();
if(!store.get('seenHelp',false)){store.set('seenHelp',true);setTimeout(openHelp,400)}
requestAnimationFrame(loop);
