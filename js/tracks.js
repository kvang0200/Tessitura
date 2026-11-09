// Tessitura · Uploaded songs: the processing dialog, preparing tracks, the Add-a-song window, adding vocals or instrumental later.
'use strict';
function showProc(title){
  const steps=['Reading the audio','Separating the vocals','Tracking the singer’s pitch','Building your note guide'];
  $('#modal').innerHTML=`<div class="eyebrow">Preparing track</div><h2>${esc(title)}</h2><p class="muted" style="margin-top:6px;line-height:1.5">Finding the lead vocal and mapping its melody. Everything happens on your computer, and nothing is uploaded anywhere.</p>
    <div class="proc-steps">${steps.map((s,i)=>`<div data-st="${i}"><i></i>${s}</div>`).join('')}</div>
    <div class="proc-bar"><i id="procFill"></i></div><div class="proc-pct" id="procPct">0%</div>`;
  modalLocked=true;openModal();setProc(0,0);
}
function setProc(stage,frac){
  $$('.proc-steps [data-st]').forEach(el=>{const i=+el.dataset.st;el.className=i<stage?'done':i===stage?'on':'';el.querySelector('i').textContent=i<stage?'✓':''});
  const w=[.1,.45,.4,.05];let p=0;for(let i=0;i<stage;i++)p+=w[i];p+=(w[stage]||0)*frac;
  const pct=Math.round(p*100);$('#procFill').style.width=pct+'%';$('#procPct').textContent=pct+'%';
}
async function decodeBlob(blob,label){
  const ab=await blob.arrayBuffer();
  try{return await decodeAudio(ab)}catch(e){throw new Error(e&&e.message==='timeout'?`Reading the ${label} file took too long. Try a shorter or smaller file (MP3 works best).`:`Your browser couldn’t decode the ${label} file. Try an MP3, M4A or WAV.`)}
}
function fitLen(buf,len){ // pad/trim a buffer to len samples, stereo
  const out=actx.createBuffer(2,len,buf.sampleRate);
  for(let c=0;c<2;c++){const src=buf.getChannelData(Math.min(c,buf.numberOfChannels-1)),dst=out.getChannelData(c);dst.set(src.subarray(0,Math.min(len,src.length)))}
  return out;
}
async function prepareTrack(meta){
  showProc(meta.title);
  try{
    await ensureCtx();
    let rec=null;try{rec=await idb.get(meta.id)}catch(e){}
    const mixB=meta._blob||(rec&&rec.blob),vocB=meta._voc||(rec&&rec.vocBlob),insB=meta._inst||(rec&&rec.instBlob);
    if(!mixB&&!vocB)throw new Error('The audio for this track couldn’t be found. Try uploading it again.');
    let mix=mixB?await decodeBlob(mixB,'song'):null;
    let voc=vocB?await decodeBlob(vocB,'vocal'):null;
    let ins=insB?await decodeBlob(insB,'instrumental'):null;
    const len=Math.max(mix?mix.length:0,voc?voc.length:0,ins?ins.length:0);
    if(mix)mix=fitLen(mix,len);if(voc)voc=fitLen(voc,len);if(ins)ins=fitLen(ins,len);
    if(!mix){ // only stems given: rebuild the full song
      mix=actx.createBuffer(2,len,voc.sampleRate);
      for(let c=0;c<2;c++){const o=mix.getChannelData(c),a=voc.getChannelData(c),b=ins?ins.getChannelData(c):null;for(let i=0;i<len;i++)o[i]=a[i]+(b?b[i]:0)}
    }
    setProc(1,0);await yieldUI();
    let sp,kar,mono=false;
    if(voc){
      sp=await sepPass(voc,false,false,setProc,1);
      if(ins)kar=ins;
      else{ // karaoke = song − vocal stem (stems from separators line up sample-for-sample)
        const m0=mix.getChannelData(0),v0=voc.getChannelData(0);let xy=0,yy=0,xx=0;
        for(let i=0;i<len;i+=8){xy+=m0[i]*v0[i];yy+=v0[i]*v0[i];xx+=m0[i]*m0[i]}
        const g=yy?xy/yy:0,corr=yy&&xx?xy/Math.sqrt(xx*yy):0;
        if(corr>.2&&g>.4&&g<2.5){
          kar=actx.createBuffer(2,len,mix.sampleRate);
          for(let c=0;c<2;c++){const o=kar.getChannelData(c),a=mix.getChannelData(c),b=voc.getChannelData(c);for(let i=0;i<len;i++)o[i]=a[i]-g*b[i]}
        }else{const s2=await sepPass(mix,true,true,()=>{},1);kar=s2.kar;mono=s2.mono}
      }
    }else{
      sp=await sepPass(mix,true,true,setProc,1);kar=sp.kar;mono=sp.mono;
    }
    setProc(2,0);await yieldUI();
    const pp=await pitchPass(sp,mix.sampleRate,setProc,2);
    setProc(3,0);await yieldUI();
    const an={...pp,mono,stem:!!voc};
    trackData[meta.id]={orig:mix,kar,an,dur:mix.duration};
    if(meta.filter==null)meta.filter=rec&&rec.filter!=null?rec.filter:(voc?0:1); // vocal files have no instruments to filter out
    if(!meta.edits)meta.edits=(rec&&rec.edits)||{del:[],oct:{}};
    Object.assign(meta,{dur:mix.duration,mono,stem:!!voc});
    applyNotes(meta);
    setProc(4,0);modalLocked=false;closeModal();
    return true;
  }catch(e){modalLocked=false;closeModal();toast(e.message||'Something went wrong preparing that track');return false}
}
const isAudioFile=f=>/^audio\//.test(f.type)||/\.(mp3|wav|m4a|aac|ogg|oga|flac|webm|opus)$/i.test(f.name);
const stemKind=name=>/(no.?vocal|instrumental|karaoke|accompan|backing|minus.?one|\binst\b|music)/i.test(name)?'inst':/(vocal|acapella|a.?cappella|voice|vox)/i.test(name)?'voc':'mix';
/* ---------- Add-a-song window: separate slots for vocals, instrumental, full song ---------- */
function cleanTitle(n){
  let t=n.replace(/\.[^.]+$/,'');
  t=t.replace(/^ytdown\.com[_\s-]*/i,'').replace(/^youtube[_\s-]*media[_\s-]*/i,'').replace(/^[\w-]{11}_/,'');   // download-site prefixes + video id
  t=t.replace(/[_\s-]+\d{2,3}[_\s-]+\d+k[_\s-].*$/i,'');                                                        // "_009_128k_..." quality tags
  t=t.replace(/[_\s(\[-]+(vocals?|instrumental|acapella|a[_\s-]?cappella|no[_\s-]?vocals?|karaoke)\b.*$/i,'');      // stem labels
  t=t.replace(/[_\s(\[-]+(official[_\s-]*)?(lyrics?|lyric[_\s-]*video|music[_\s-]*video|audio|video)[)\]]*$/i,'');
  if(!/\s/.test(t))t=t.replace(/[-_]+/g,' ');else t=t.replace(/_+/g,' ');
  return t.replace(/\s{2,}/g,' ').trim().slice(0,60);
}
const UP={voc:null,inst:null,mix:null};
const SLOTS=[
  ['voc','Vocals only','The singing on its own, e.g. from Ultimate Vocal Remover. Gives the most accurate notes.','Best accuracy'],
  ['inst','Instrumental','The music without vocals, so you have a backing track to sing along to.','Optional'],
  ['mix','Full song','Only if you don’t have separate files. The vocals are separated automatically, less accurately.','']];
function openUploadModal(pre){
  UP.voc=UP.inst=UP.mix=null;let title='';
  if(UP.refresh&&$('#modal .slots')&&modalOpen()){for(const f of [...(pre||[])].filter(isAudioFile)){const k=stemKind(f.name);UP[k]=f}UP.refresh();return}
  for(const f of [...(pre||[])].filter(isAudioFile)){const k=stemKind(f.name);if(!UP[k])UP[k]=f;else if(!UP.mix)UP.mix=f}
  $('#modal').innerHTML=`<div class="eyebrow">New track</div><h2>Add a song</h2>
    <p class="muted" style="margin-top:6px;line-height:1.5">Add the vocals, the music, or both. You can add the missing part to the song later.</p>
    <div class="slots">${SLOTS.map(([k,t,d,b])=>`<div class="slot" data-k="${k}"><div class="slot-ic">${k==='voc'?'🎤':k==='inst'?'🎹':'🎵'}</div>
      <div class="slot-tx"><b>${t}${b?` <span class="slot-badge${k==='voc'?' best':''}">${b}</span>`:''}</b><span class="slot-d">${d}</span><span class="slot-f" id="sf-${k}"></span></div>
      <button class="btn ghost sm" data-pick="${k}">Choose…</button><button class="slot-x" data-clear="${k}" title="Remove" hidden>✕</button>
      <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden data-in="${k}"></div>`).join('')}</div>
    <div class="field"><label>Song title</label><input id="upTitle" maxlength="60" placeholder="My song"></div>
    <div class="parse-msg" id="upMsg"></div>
    <div class="modal-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="upGo" disabled>Add song</button></div>`;
  openModal();
  const refresh=()=>{
    for(const [k] of SLOTS){const f=UP[k],el=$(`#sf-${k}`),sl=$(`.slot[data-k="${k}"]`);el.textContent=f?'✓ '+f.name:'';sl.classList.toggle('has',!!f);
      sl.querySelector('[data-pick]').textContent=f?'Change…':'Choose…';sl.querySelector('[data-clear]').hidden=!f}
    const first=UP.voc||UP.mix||UP.inst;if(first&&!$('#upTitle').dataset.touched)$('#upTitle').value=cleanTitle(first.name);
    const ok=!!(UP.voc||UP.mix),m=$('#upMsg');$('#upGo').disabled=!ok;
    m.className='parse-msg '+(ok?'ok':'');
    m.textContent=!UP.voc&&!UP.mix&&UP.inst?'Add the vocals or the full song too, so there’s a melody to follow.'
      :UP.voc&&!UP.inst&&!UP.mix?'✓ Notes come from your vocals. Add the instrumental now or later for music behind you.'
      :UP.voc&&UP.inst?'✓ Best setup: accurate notes and a clean karaoke track.'
      :UP.mix&&!UP.voc?'✓ Vocals will be separated from the full song automatically.':'';
  };
  $$('.slot').forEach(sl=>{
    const k=sl.dataset.k,inp=sl.querySelector('[data-in]');
    sl.querySelector('[data-pick]').onclick=()=>inp.click();
    inp.onchange=()=>{const f=inp.files[0];inp.value='';if(f&&isAudioFile(f)){UP[k]=f;refresh()}else if(f)toast('Please choose an audio file (MP3, WAV, M4A…)')};
    sl.querySelector('[data-clear]').onclick=()=>{UP[k]=null;refresh()};
    sl.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();sl.classList.add('over')});
    sl.addEventListener('dragleave',()=>sl.classList.remove('over'));
    sl.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();sl.classList.remove('over');dragN=0;$('#drop').classList.remove('show');const f=e.dataTransfer.files[0];if(f&&isAudioFile(f)){UP[k]=f;refresh()}});
  });
  UP.refresh=refresh;
  $('#upTitle').oninput=e=>{e.target.dataset.touched='1'};
  $('#upGo').onclick=()=>{const t=$('#upTitle').value.trim();closeModal();createTrack({voc:UP.voc,inst:UP.inst,mix:UP.mix,title:t})};
  refresh();
}
async function createTrack({voc,inst,mix,title}){
  if(P.running)stopRun();
  const meta={id:'t-'+Date.now(),kind:'audio',group:'Your tracks',title:title||cleanTitle((voc||mix||inst).name)||'My track',_blob:mix,_voc:voc,_inst:inst};
  const ok=await prepareTrack(meta);if(!ok)return;
  delete meta._blob;delete meta._voc;delete meta._inst;meta.hasInst=!!inst||!!mix;meta.hasMix=!!mix;tracks.unshift(meta);
  try{await idb.put({...meta,blob:mix,vocBlob:voc,instBlob:inst,created:Date.now()})}catch(e){toast(/blocked/.test(e&&e.message)?'Song ready, but it can’t be saved for next time while the app is open in another tab or on the Home Screen. Close the other copy.':'Song ready (it couldn’t be saved for next time in this browser)')}
  showView('practice');await loadSong(meta.id);
  if(!meta.count)toast('No clear vocal melody was found. Try setting Background filter to Off.');
  else toast(`Found ${meta.count} notes${voc?' in your vocals':''}. Press Space when you’re ready to sing!`);
}
async function addInstrumental(file){
  if(!file||!isAudioFile(file)||!isAudio())return;
  const meta=P.song;if(P.running)stopRun();
  meta._inst=file;const ok=await prepareTrack(meta);delete meta._inst;if(!ok)return;
  meta.hasInst=true;
  try{const rec=await idb.get(meta.id);await idb.put({...rec,instBlob:file,hasInst:true,count:meta.count})}catch(e){}
  build();renderLib();renderHead();toast('Instrumental added. Turn “Original vocals” down for karaoke.');
}
async function addStem(file){
  if(!file||!isAudioFile(file)||!isAudio())return;
  const meta=P.song;if(P.running)stopRun();
  meta._voc=file;meta.edits={del:[],oct:{}};
  const ok=await prepareTrack(meta);delete meta._voc;if(!ok)return;
  try{const rec=await idb.get(meta.id);await idb.put({...rec,vocBlob:file,edits:meta.edits,stem:true,count:meta.count})}catch(e){}
  build();renderLib();renderHead();toast(`Vocal stem added. The note guide now has ${meta.count} notes.`);
}
async function removeStem(){
  const meta=P.song;if(P.running)stopRun();
  try{const rec=await idb.get(meta.id);delete rec.vocBlob;await idb.put({...rec,stem:false})}catch(e){}
  meta.edits={del:[],oct:{}};const ok=await prepareTrack(meta);if(!ok)return;
  saveTrackMeta(meta);build();renderLib();renderHead();
}
async function deleteTrack(id){
  tracks=tracks.filter(t=>t.id!==id);delete trackData[id];
  try{await idb.del(id)}catch(e){}
  if(S.songId===id)loadSong(BUILTIN[0].id);else renderLib();
}
function rangeOf(seq){const ms=seq.filter(n=>n.midi!=null).map(n=>n.midi);return [Math.min(...ms),Math.max(...ms)]}
