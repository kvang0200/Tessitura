// Tessitura · Microphone and live pitch detection (YIN), vibrato centre, audio unlocking for iPad Safari, and the little synth.
'use strict';
/* ================= AUDIO ================= */
let actx=null,analyser=null,tbuf=null,ybuf=null,micStream=null,micOn=false,level=0,master=null;
let pitch=null;const mh=[];let nullRun=0;
let inLat=.02,ANALYSIS_LAG=.05,noiseFloor=.002;
// The centre of the singer's vibrato: the average pitch over the last ~0.2 s (about one vibrato wobble).
// Listeners hear this centre as "the note", so judging uses it; the drawn pitch line still shows every wobble.
const VIB_WIN=.2,VIB_LAG=.09;
function vibCentre(){
  if(!pitch)return null;const t=performance.now()/1000;let a=0,c=0;
  for(let i=live.length-1;i>=0&&live[i].t>t-VIB_WIN;i--){const m=live[i].m;if(Math.abs(m-pitch.midi)<1.6){a+=m;c++}}
  return c>=3?a/c:pitch.midi;
}const rmsHist=[];let rmsTick=0;
const outLat=()=>actx?((actx.outputLatency||0)+(actx.baseLatency||0)):0;
const live=[];// {t,m} wall-clock seconds
// iPad/iPhone Safari only lets audio start inside a tap, and resume() called at any other moment can wait forever.
// So: switch audio on during the user's taps, and never make other work (like reading a song) wait for it.
function unlockAudio(){
  try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state!=='running'){const r=actx.resume();if(r&&r.catch)r.catch(()=>{})}}catch(e){}
}
['pointerdown','touchend','click','keydown'].forEach(ev=>addEventListener(ev,unlockAudio,{capture:true,passive:true}));
async function ensureCtx(){
  if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)();
  if(actx.state!=='running'){try{await Promise.race([actx.resume(),new Promise(r=>setTimeout(r,400))])}catch(e){}}
  return actx;
}
// decodeAudioData: callback + promise forms (older Safari only fires callbacks), with a time limit
function decodeAudio(ab){
  return new Promise((res,rej)=>{
    let done=false;const ok=b=>{if(!done){done=true;res(b)}},bad=e=>{if(!done){done=true;rej(e||new Error('decode failed'))}};
    setTimeout(()=>bad(new Error('timeout')),90000);
    try{const pr=actx.decodeAudioData(ab,ok,bad);if(pr&&pr.then)pr.then(ok,bad)}catch(e){bad(e)}
  });
}
async function enableMic(){
  await ensureCtx();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('This browser can’t access the microphone here. Try Chrome, Edge or Firefox.');return false}
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  }catch(e){toast('Microphone access was blocked — allow it in your browser’s address bar and try again.');return false}
  const src=actx.createMediaStreamSource(micStream);
  const hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=65;
  analyser=actx.createAnalyser();analyser.fftSize=actx.sampleRate>60000?4096:2048; // keep ~40 ms of audio so low voices (down to ~62 Hz) are measurable
  src.connect(hp);hp.connect(analyser);
  tbuf=new Float32Array(analyser.fftSize);ybuf=new Float32Array(analyser.fftSize/2);
  try{const st=micStream.getAudioTracks()[0].getSettings();inLat=typeof st.latency==='number'&&st.latency>=0&&st.latency<.5?st.latency:.02}catch(e){inLat=.02}
  ANALYSIS_LAG=analyser.fftSize/2/actx.sampleRate+.03;
  micOn=true;updateMicUI();toast('Mic is on — try singing a note!');
  return true;
}
function disableMic(){
  if(micStream) micStream.getTracks().forEach(t=>t.stop());
  micStream=null;micOn=false;pitch=null;level=0;if(P.running&&P.mode==='sing') stopRun();updateMicUI();
}
function updateMicUI(){
  const b=$('#micBtn');b.classList.toggle('on',micOn);b.classList.toggle('off',!micOn);
  b.querySelector('.lbl').textContent=micOn?'Mic on':'Enable mic';
  b.title=micOn?'Click to turn the microphone off':'';
  updateHint();
}
// YIN pitch detection
function yin(b,sr){
  const W=b.length>>1,d=ybuf;
  const maxT=Math.min(W-1,Math.floor(sr/62)),minT=Math.max(2,Math.floor(sr/1200));
  d[0]=1;let run=0;
  for(let t=1;t<=maxT;t++){
    let s=0;for(let i=0;i<W;i++){const x=b[i]-b[i+t];s+=x*x}
    run+=s;d[t]=run?s*t/run:1;
  }
  let tau=-1;
  for(let t=minT;t<=maxT;t++){if(d[t]<0.12){while(t+1<=maxT&&d[t+1]<d[t])t++;tau=t;break}}
  if(tau<0){let mv=1,mt=-1;for(let t=minT;t<=maxT;t++)if(d[t]<mv){mv=d[t];mt=t}if(mv<0.22)tau=mt;else return null}
  let bt=tau;
  if(tau>1&&tau<maxT){const a=d[tau-1],c=d[tau+1],m=d[tau];const den=a+c-2*m;if(den)bt=tau+(a-c)/(2*den)}
  return {freq:sr/bt,prob:1-d[tau]};
}
function updatePitch(){
  analyser.getFloatTimeDomainData(tbuf);
  let rms=0;for(let i=0;i<tbuf.length;i++)rms+=tbuf[i]*tbuf[i];rms=Math.sqrt(rms/tbuf.length);
  level=Math.max(rms,level*0.88);
  let f=null;
  // background-noise floor: drops instantly to quiet moments, creeps up slowly (so singing doesn't raise it)
  // background-noise level = the quiet end (20th percentile) of the last ~3 s, ignoring pure digital silence
  if(rms>1e-5){rmsHist.push(rms);if(rmsHist.length>180)rmsHist.shift()}
  if(++rmsTick%15===0&&rmsHist.length>20){const srt=[...rmsHist].sort((a,b)=>a-b);noiseFloor=srt[Math.floor(srt.length*.2)]}
  const gate=clamp(noiseFloor*2.5,.0012,.008);
  if(rms>gate){const r=yin(tbuf,actx.sampleRate);if(r&&r.prob>0.78&&r.freq>70&&r.freq<1200)f=r.freq}
  if(f){
    const m=f2m(f);
    if(pitch&&Math.abs(m-pitch.midi)>0.8) mh.length=0;
    mh.push(m);if(mh.length>5)mh.shift();
    const s=[...mh].sort((a,b)=>a-b);const med=s[s.length>>1];
    pitch={midi:med,freq:m2f(med)};nullRun=0;
  }else if(++nullRun>3){pitch=null;mh.length=0}
  const now=performance.now()/1000;
  if(pitch) live.push({t:now,m:pitch.midi});
  while(live.length&&live[0].t<now-12) live.shift();
}
function out(){if(!master){master=actx.createGain();master.gain.value=.9;master.connect(actx.destination)}return master}
function tone(m,t0,dur,vol=.16){
  const o=actx.createOscillator(),o2=actx.createOscillator(),g=actx.createGain(),g2=actx.createGain(),lp=actx.createBiquadFilter();
  o.type='triangle';o.frequency.value=m2f(m);o2.type='sine';o2.frequency.value=m2f(m)*2;g2.gain.value=.22;
  lp.type='lowpass';lp.frequency.value=2600;
  o.connect(g);o2.connect(g2);g2.connect(g);g.connect(lp);lp.connect(out());
  const a=.025,end=t0+dur,r=Math.min(.12,dur*.3);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+a);
  g.gain.linearRampToValueAtTime(vol*.75,Math.max(t0+a+.001,end-r));g.gain.linearRampToValueAtTime(0,end);
  o.start(t0);o2.start(t0);o.stop(end+.05);o2.stop(end+.05);
  return [o,o2];
}
function click(t0,accent){
  const o=actx.createOscillator(),g=actx.createGain();o.type='sine';o.frequency.value=accent?1760:1180;
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(accent?.3:.18,t0+.004);g.gain.exponentialRampToValueAtTime(.0001,t0+.07);
  o.connect(g);g.connect(out());o.start(t0);o.stop(t0+.08);return [o];
}
async function playNote(m,dur=1.2){await ensureCtx();tone(m,actx.currentTime+.02,dur,.2)}
