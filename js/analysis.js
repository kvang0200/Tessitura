// Tessitura · Song analysis: separating the vocal from a mix, tracking its pitch, turning it into notes, tuning and the background filter.
'use strict';
/* ---------- vocal isolation + melody extraction ----------
   Pass 1 (STFT): vocals are usually mixed in the centre of a stereo track, so energy that is strong
   in the centre (L+R) but not the sides (L−R) is treated as voice. This gives a vocal estimate to
   pitch-track, a harmonic "salience" guess of the pitch per frame, and a karaoke mix.
   If the user supplies an isolated vocal stem, pass 1 runs on the stem with no masking instead.
   Pass 2: YIN pitch tracking on the vocal estimate, guided by the salience guess.
   Pass 3 (instant, re-runnable): song tuning, note segmentation, and the background filter. */
async function sepPass(buf,useMask,wantKar,prog,stage){
  const sr=buf.sampleRate,len=buf.length;
  const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
  let em=0,es=0;for(let i=0;i<len;i+=64){const m=L[i]+R[i],s=L[i]-R[i];em+=m*m;es+=s*s}
  const mono=!useMask||es<em*0.003;
  const N=2048,H=1024,fft=makeFFT(N),win=new Float32Array(N);
  for(let n=0;n<N;n++)win[n]=Math.sin(Math.PI*(n+.5)/N);
  const vlow=new Float32Array(len),kmid=wantKar?new Float32Array(len):null;
  const re=new Float64Array(N),im=new Float64Array(N),zr=new Float64Array(N),zi=new Float64Array(N);
  const binHz=sr/N,alpha=1.3;
  const kV0=Math.ceil(70/binHz),kV1=Math.floor(1100/binHz),kK0=Math.ceil(120/binHz),kK1=Math.floor(8000/binHz);
  const frames=Math.ceil(len/H)+1;
  const kS=Math.min(N/2-2,Math.floor(5000/binHz)),vmag=new Float32Array(N/2+1);
  const cand=[];for(let f0=75;f0<=1050;f0*=Math.pow(2,1/36))cand.push(f0);
  const coarse=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    const s0=(f-1)*H;
    for(let n=0;n<N;n++){const i=s0+n;let l=0,r=0;if(i>=0&&i<len){l=L[i];r=R[i]}re[n]=(l+r)*.5*win[n];im[n]=(l-r)*.5*win[n]}
    fft(re,im,false);
    for(let k=0;k<=N/2;k++){
      const kn=(N-k)&(N-1);
      const xr=re[k],xi=im[k],yr=re[kn],yi=im[kn];
      const mr=(xr+yr)/2,mi=(xi-yi)/2,sR=(xi+yi)/2,sI=-(xr-yr)/2;
      let m=0,mm=0;
      if(k<=kK1)mm=Math.hypot(mr,mi);
      if(!mono&&((k>=kV0&&k<=kV1)||(k>=kK0&&k<=kK1))){const ms=Math.hypot(sR,sI);m=mm>1e-9?clamp((mm-alpha*ms)/mm,0,1):0}
      vmag[k]=(k>=kV0&&k<=kS)?(mono?mm:mm*m):0;
      const mV=(k>=kV0&&k<=kV1)?(mono?1:m):0;
      const mK=(!mono&&k>=kK0&&k<=kK1)?m:0;
      const ar=mr*mV,ai=mi*mV,br=mr*(1-mK),bi=mi*(1-mK);
      zr[k]=ar-bi;zi[k]=ai+br;
      if(kn!==k){zr[kn]=ar+bi;zi[kn]=br-ai}
    }
    {let best=0,bf=0;
      for(let c=0;c<cand.length;c++){const f0=cand[c];let sal=0,w=1;
        for(let h=1;h<=10;h++){const fk=h*f0/binHz;if(fk>=kS)break;const k0=fk|0;sal+=w*Math.max(vmag[k0],vmag[k0+1]);w*=.8}
        if(sal>best){best=sal;bf=f0}}
      coarse[f]=bf;}
    fft(zr,zi,true);
    for(let n=0;n<N;n++){const i=s0+n;if(i>=0&&i<len){vlow[i]+=zr[n]*win[n];if(kmid)kmid[i]+=zi[n]*win[n]}}
    if(f%250===0){prog(stage,f/frames);await yieldUI()}
  }
  let kar=null;
  if(wantKar){
    kar=actx.createBuffer(2,len,sr);const KL=kar.getChannelData(0),KR=kar.getChannelData(1);
    for(let i=0;i<len;i++){const sd=(L[i]-R[i])*.5;KL[i]=kmid[i]+sd;KR[i]=kmid[i]-sd}
  }
  return {vlow,coarse,frames,H,mono,kar};
}
async function pitchPass(sp,sr,prog,stage){
  const {vlow,coarse,frames,H}=sp,len=vlow.length;
  const D=Math.max(1,Math.round(sr/11025)),dsr=sr/D,dl=Math.floor(len/D),x=new Float32Array(dl);
  for(let i=0;i<dl;i++)x[i]=vlow[i*D];
  const W=512,hop=256,maxT=Math.min(W-1,Math.floor(dsr/75)),minT=Math.max(2,Math.floor(dsr/1000));
  const nF=Math.max(0,Math.floor((dl-W-maxT)/hop));
  const rms=new Float32Array(nF);
  for(let f=0;f<nF;f++){let s=0;const o=f*hop;for(let i=0;i<W;i++)s+=x[o+i]*x[o+i];rms[f]=Math.sqrt(s/W)}
  const sorted=Array.from(rms).sort((a,b)=>a-b);const p95=sorted[Math.floor(sorted.length*.95)]||0;
  const gate=Math.max(1e-4,p95*.14);
  const d=new Float32Array(maxT+2),raw=new Float32Array(nF).fill(NaN),clar=new Float32Array(nF); // clar: how clearly pitched (0–1)
  for(let f=0;f<nF;f++){
    if(rms[f]>=gate){
      const o=f*hop,cf=coarse[clamp(Math.round((o+W/2)*D/H),0,frames-1)];
      let tau=-1;
      if(cf>0){
        const tc=dsr/cf,top=Math.min(maxT,Math.ceil(2*tc*1.09)+1);
        d[0]=1;let run=0;
        for(let t=1;t<=top;t++){let s=0;for(let i=0;i<W;i++){const v=x[o+i]-x[o+i+t];s+=v*v}run+=s;d[t]=run?s*t/run:1}
        const near=c=>{const lo=Math.max(minT,Math.floor(c/1.09)),hi=Math.min(top-1,Math.ceil(c*1.09));let mv=1,mt=-1;for(let t=lo;t<=hi;t++)if(d[t]<mv){mv=d[t];mt=t}return [mv,mt]};
        let [mv,mt]=near(tc);
        // octave check: if the wave clearly repeats at double the period, the note is an octave lower
        if(2*tc*1.09<top+1){const [m2,t2]=near(2*tc);if(t2>0&&m2<.2&&m2<mv*.4){mv=m2;mt=t2}}
        tau=mv<=.45?mt:-1;if(tau>0)clar[f]=1-mv;
      }
      if(tau>0){
        let bt=tau;if(tau<maxT){const a=d[tau-1],c=d[tau+1],mm=d[tau],den=a+c-2*mm;if(den)bt=tau+(a-c)/(2*den)}
        const m=f2m(dsr/bt);if(m>=38&&m<=86)raw[f]=m;
      }
    }
    if(f%400===0){prog(stage,f/nF);await yieldUI()}
  }
  // median smoothing + octave-jump repair
  const med=new Float32Array(nF).fill(NaN);
  for(let f=0;f<nF;f++){if(isNaN(raw[f]))continue;const w=[];for(let j=-2;j<=2;j++){const v=raw[f+j];if(v===v&&v!==undefined)w.push(v)}w.sort((a,b)=>a-b);med[f]=w[w.length>>1]}
  for(let f=0;f<nF;f++){if(isNaN(med[f]))continue;const w=[];for(let j=-12;j<=12;j++){const v=med[f+j];if(v===v&&v!==undefined)w.push(v)}w.sort((a,b)=>a-b);const c=w[w.length>>1],df=med[f]-c;if(Math.abs(df-12)<1.2){med[f]-=12;raw[f]-=12}else if(Math.abs(df+12)<1.2){med[f]+=12;raw[f]+=12}}
  return {raw,clar,contour:med,hopSec:hop/dsr,t0:(W/2)/dsr};
}
// Pass 3 — instant. filter: 0 off, 1 normal, 2 strong
function buildNotes(an,filter){
  const med=an.contour,raw=an.raw,hopSec=an.hopSec,t0=an.t0,nF=med.length;
  // 1) the song's tuning: recordings are often a little sharp or flat of A=440
  let C=0,Sn=0,cnt=0;
  for(let f=0;f<nF;f++){const v=med[f];if(v===v){const a=2*Math.PI*(v-Math.round(v));C+=Math.cos(a);Sn+=Math.sin(a);cnt++}}
  let tuning=0;if(cnt>50&&Math.hypot(C,Sn)/cnt>.25)tuning=Math.atan2(Sn,C)/(2*Math.PI);
  // 2) segment into notes, in the song's own tuning (hysteresis so vibrato doesn't split notes)
  const runs=[];let cur=null,run=null;
  for(let f=0;f<nF;f++){
    const v=med[f]-tuning;let q=null;
    if(v===v){if(cur!=null&&Math.abs(v-cur)<.72)q=cur;else{cur=Math.round(v);q=cur}}else cur=null;
    if(run&&run.m===q&&q!=null)run.f1=f;
    else{if(run&&run.m!=null)runs.push(run);run=q!=null?{m:q,f0:f,f1:f}:null}
  }
  if(run)runs.push(run);
  // every separate sung sound (before repeated same-pitch notes are merged): used to place lyrics syllable by syllable
  const uMin=Math.ceil(.06/hopSec),units=runs.filter(r=>r.f1-r.f0+1>=uMin).map(r=>({start:t0+r.f0*hopSec-hopSec/2,dur:(r.f1-r.f0+1)*hopSec}));
  const minF=Math.ceil((an.stem?.08:.11)/hopSec) /* clean vocal files keep quick runs and ornaments */,gapF=Math.ceil(.06/hopSec);
  const kept=[];
  // name each note by its typical pitch, not its first moment (singers often slide into notes)
  for(const r of runs){const vs=[];for(let f=r.f0;f<=r.f1;f++){const x=med[f];if(x===x)vs.push(x-tuning)}if(vs.length){vs.sort((a,b)=>a-b);r.m=Math.round(vs[vs.length>>1])}}
  for(const r of runs){if(r.f1-r.f0+1<minF)continue;const last=kept[kept.length-1];if(last&&last.m===r.m&&r.f0-last.f1<=gapF)last.f1=r.f1;else kept.push({...r})}
  // 3) how "voice-like" is each note? Voices always waver (vibrato, natural jitter);
  //    pianos, synths and guitars hold a near-perfectly steady pitch.
  for(const r of kept){
    const vals=[];
    for(let f=r.f0+2;f<=r.f1-2;f++){let v=raw[f];if(v!==v)continue;v-=tuning;v-=12*Math.round((v-r.m)/12);if(Math.abs(v-r.m)<.6)vals.push(v)}
    if(vals.length<5){r.wob=null;continue}
    const s=[...vals].sort((p,q)=>p-q),mdn=s[s.length>>1];
    let ss=0;for(const v of vals)ss+=(v-mdn)*(v-mdn);r.wob=Math.sqrt(ss/vals.length)*100;
  }
  const cl=an.clar;for(const r of kept){let a=0,c=0;for(let f=r.f0;f<=r.f1;f++){a+=cl?cl[f]:1;c++}r.clar=c?a/c:1}
  let notes=kept.map(r=>({midi:r.m,start:t0+r.f0*hopSec-hopSec/2,dur:(r.f1-r.f0+1)*hopSec,wob:r.wob,clar:r.clar}));
  // 4) judge each note together with its neighbours (±2.5 s): sung passages waver, instrumental ones don't
  if(filter>0&&notes.length){
    for(const n of notes)n.v=n.wob==null?null:clamp((n.wob-2.5)/4,0,1);
    const keep=[];
    for(const n of notes){
      const c=n.start+n.dur/2,vs=[];let wt=0;
      for(const o of notes){if(o.v!=null&&Math.abs(o.start+o.dur/2-c)<=2.5){vs.push([o.v,o.dur]);wt+=o.dur}}
      if(wt<.6){if(filter===1&&n.dur>=.3)keep.push(n);continue}   // too little evidence: keep only longer notes
      vs.sort((p,q)=>p[0]-q[0]);let acc=0,sc=0;for(const [v,dd] of vs){acc+=dd;if(acc>=wt/2){sc=v;break}}n.vs=sc;
      if(filter===1?(sc>=.35||(n.v!=null&&n.v>=.75)):(sc>=.55&&(n.v==null?n.dur<.6:n.v>=.3)))keep.push(n);
    }
    notes=keep;
  }
  // 5) short notes an octave away from everything around them are almost always detection slips
  for(let pass=0;pass<2;pass++)for(const n of notes){
    if(n.dur>.45)continue;
    const ctx=notes.filter(o=>o!==n&&Math.abs(o.start-n.start)<4).map(o=>o.midi).sort((a,b)=>a-b);
    if(ctx.length<3)continue;const c=ctx[ctx.length>>1],df=n.midi-c;
    if(df>=9&&Math.abs(df-12)<Math.abs(df)-3)n.midi-=12;else if(df<=-9&&Math.abs(df+12)<Math.abs(df)-3)n.midi+=12;
  }
  for(let i=notes.length-1;i>0;i--){const a=notes[i-1],b=notes[i];if(a.midi===b.midi&&b.start-(a.start+a.dur)<=.06){a.dur=b.start+b.dur-a.start;notes.splice(i,1)}}
  for(const n of notes)n.key=Math.round(n.start*100);
  let lo=48,hi=72;
  if(notes.length){const ms=notes.map(n=>n.midi).sort((a,b)=>a-b);lo=ms[Math.floor(ms.length*.08)];hi=ms[Math.min(ms.length-1,Math.ceil(ms.length*.92)-1)];
    if(hi-lo>22){const md=ms[ms.length>>1];lo=Math.max(lo,md-11);hi=Math.min(hi,md+11)}}
  return {notes,tuning,lo,hi,units};
}
// Apply the background filter + the user's manual edits to a prepared track
function applyNotes(meta){
  const d=trackData[meta.id];if(!d)return;
  const r=buildNotes(d.an,meta.filter==null?1:meta.filter);
  const ed=meta.edits||{del:[],oct:{}};
  r.notes=r.notes.filter(n=>!ed.del.includes(n.key));
  for(const n of r.notes)if(ed.oct[n.key])n.midi+=ed.oct[n.key];
  Object.assign(d.an,r);
  meta.count=r.notes.length;meta.lo=r.lo;meta.hi=r.hi;
}
async function saveTrackMeta(meta){
  try{const rec=await idb.get(meta.id);if(rec)await idb.put({...rec,filter:meta.filter,edits:meta.edits,lyrics:meta.lyrics||null,title:meta.title,count:meta.count,dur:meta.dur,lo:meta.lo,hi:meta.hi,mono:meta.mono,stem:meta.stem})}catch(e){}
}
