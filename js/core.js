// Tessitura · Shared helpers, saved settings, the song library, browser storage (IndexedDB) and the FFT.
'use strict';
// true on phones and tablets without a mouse: swaps “press Space / click / hover” wording for “tap”
const touchUI=()=>matchMedia('(hover: none)').matches;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const pc=m=>((Math.round(m)%12)+12)%12;
const nm=m=>NAMES[pc(m)];
const oc=m=>Math.floor(Math.round(m)/12)-1;
const mname=m=>nm(m)+oc(m);
const f2m=f=>69+12*Math.log2(f/440), m2f=m=>440*Math.pow(2,(m-69)/12);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isBlack=m=>[1,3,6,8,10].includes(pc(m));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- saved data (localStorage) ----------
   Everything read back is treated as untrusted: on GitHub Pages every project of the same account shares one
   origin (and so one localStorage), and the data can also be edited by hand. Values are checked against the
   shape the app expects, so a bad or hostile entry is dropped instead of reaching the page or crashing it. */
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const vStr=(v,max=200)=>typeof v==='string'?v.slice(0,max):'';
const vNum=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v:d;
const vId=v=>{const s=vStr(v,80);return /^[\w.-]+$/.test(s)?s:''};
const SAFE_KEY=k=>k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
const CLEAN={
  history:a=>a.filter(isObj).map(x=>({id:vId(x.id),title:vStr(x.title),score:clamp(Math.round(vNum(x.score)),0,100),date:vNum(x.date),
    tol:vStr(x.tol,10),tr:clamp(Math.round(vNum(x.tr)),-24,24),dur:Math.max(0,vNum(x.dur))})).filter(x=>x.id),
  ear:a=>a.filter(isObj).map(x=>({type:vStr(x.type,20),date:vNum(x.date),correct:x.correct===true,total:Math.max(0,Math.round(vNum(x.total))),
    cents:typeof x.cents==='number'&&Number.isFinite(x.cents)?x.cents:null,level:x.level==='hard'?'hard':'easy'})),
  custom:a=>a.filter(isObj).map(x=>({id:vId(x.id),title:vStr(x.title,60)||'Untitled melody',bpm:clamp(vNum(x.bpm,90),40,220),
    bpb:[2,3,4,6].includes(x.bpb)?x.bpb:4,level:0,desc:'Your custom melody.',seq:vStr(x.seq,20000),lyr:vStr(x.lyr,20000)||undefined}))
    .filter(x=>x.id&&x.seq),
  drill:d=>{if(!isObj(d)||d.id!=='drill-weak')return null;const seq=vStr(d.seq,20000);if(!seq)return null;
    return {id:'drill-weak',kind:'midi',group:'Your drills',title:'Weak-spot drill',bpm:clamp(vNum(d.bpm,80),40,220),bpb:4,level:0,noAuto:true,
      desc:vStr(d.desc,400),seq,created:vNum(d.created)}},
  stats:o=>{const out={note:{},int:{},ear:{}};for(const kind of ['note','int','ear']){const src=isObj(o[kind])?o[kind]:{};
    for(const [k,e] of Object.entries(src)){if(!SAFE_KEY(k)||!/^-?\d{1,3}$/.test(k)||!isObj(e))continue;
      const n=vNum(e.n),s=vNum(e.s),c=vNum(e.c),cn=vNum(e.cn);if(n>0)out[kind][k]={n,s:clamp(s,0,n),c,cn:Math.max(0,cn)}}}return out},
  settings:o=>{const out={};for(const [k,v] of Object.entries(o)){if(!SAFE_KEY(k)||!/^\w{1,30}$/.test(k))continue;
    if(typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||v===null)out[k]=v;
    else if(typeof v==='string')out[k]=v.slice(0,80);
    else if(k==='range'&&isObj(v)&&[v.lo,v.hi,v.date].every(n=>typeof n==='number'&&Number.isFinite(n)))out[k]={lo:clamp(v.lo,24,108),hi:clamp(v.hi,24,108),date:v.date}}
    return out},
};
// metadata of an uploaded track as read back from IndexedDB (blobs are handled separately)
function cleanTrackMeta(m){
  if(!isObj(m)||!vId(m.id))return null;
  const edits=isObj(m.edits)?m.edits:{};
  const oct={};if(isObj(edits.oct))for(const [k,v] of Object.entries(edits.oct))if(SAFE_KEY(k)&&typeof v==='number'&&Number.isFinite(v))oct[k]=clamp(Math.round(v/12)*12,-36,36);
  return {...m,id:vId(m.id),kind:'audio',group:'Your tracks',title:vStr(m.title,120)||'My track',created:vNum(m.created),
    lyrics:Array.isArray(m.lyrics)?m.lyrics.filter(isObj).map(l=>({...l,t:vNum(l.t),text:vStr(l.text,500)})):null,
    edits:{del:Array.isArray(edits.del)?edits.del.filter(x=>typeof x==='string'||typeof x==='number'):[],oct}};
}
const sameShape=(v,d)=>d===null||d===undefined?true:Array.isArray(d)?Array.isArray(v):isObj(d)?isObj(v):typeof v===typeof d&&(typeof v!=='number'||Number.isFinite(v));
const store={
  get(k,d){try{const raw=localStorage.getItem('tessitura.'+k);if(!raw)return d;let v=JSON.parse(raw);if(!sameShape(v,d))return d;
    if(CLEAN[k])v=CLEAN[k](v);return v==null?d:v}catch(e){return d}},
  set(k,v){try{localStorage.setItem('tessitura.'+k,JSON.stringify(v))}catch(e){}}
};
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3200)}

/* ================= LIBRARY ================= */
const BUILTIN=[
 {id:'w-five',group:'Warm-ups',title:'Five-Note Slide',bpm:96,bpb:4,level:1,desc:'Step up five notes and back down, rising a step each round.',
  seq:'C4 D4 E4 F4 G4 F4 E4 D4 C4/2 R/2 D4 E4 F#4 G4 A4 G4 F#4 E4 D4/2 R/2 E4 F#4 G#4 A4 B4 A4 G#4 F#4 E4/2'},
 {id:'w-long',group:'Warm-ups',title:'Long Tones',bpm:80,bpb:4,level:1,desc:'Hold each note for a full bar. Builds breath support and steadiness.',
  seq:'C4/4 E4/4 G4/4 E4/4 C4/4'},
 {id:'w-scale',group:'Warm-ups',title:'Major Scale',bpm:92,bpb:4,level:2,desc:'Do-re-mi all the way up the octave and back down.',
  seq:'C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4/2'},
 {id:'w-arp',group:'Warm-ups',title:'Arpeggio Leaps',bpm:88,bpb:4,level:2,desc:'Jump through the chord tones — trains your ear for bigger intervals.',
  seq:'C4 E4 G4 C5 G4 E4 C4/2 D4 F#4 A4 D5 A4 F#4 D4/2'},
 {id:'w-int',group:'Warm-ups',title:'Interval Jumps',bpm:84,bpb:4,level:3,desc:'Land a fifth, a third and a full octave cleanly from the home note.',
  seq:'C4/2 G4/2 C4/2 E4/2 C4/2 A4/2 C4/2 C5/2 C4/4'},
 {id:'s-hotcross',group:'Songs',title:'Hot Cross Buns',bpm:100,bpb:4,level:1,desc:'Three notes walking down, with a quick run of repeated notes in the middle.',
  seq:'E4 D4 C4/2 E4 D4 C4/2 C4/0.5 C4/0.5 C4/0.5 C4/0.5 D4/0.5 D4/0.5 D4/0.5 D4/0.5 E4 D4 C4/2'},
 {id:'s-row',group:'Songs',title:'Row, Row, Row Your Boat',bpm:150,bpb:6,level:1,desc:'A lilting round that climbs up the scale, then tumbles down from the high note.',
  seq:'C4/3 C4/3 C4/2 D4 E4/3 E4/2 D4 E4/2 F4 G4/6 C5 C5 C5 G4 G4 G4 E4 E4 E4 C4 C4 C4 G4/2 F4 E4/2 D4 C4/6'},
 {id:'s-london',group:'Songs',title:'London Bridge',bpm:104,bpb:4,level:1,desc:'Short step-wise phrases that keep coming back to the same note.',
  seq:'G4/1.5 A4/0.5 G4 F4 E4 F4 G4/2 D4 E4 F4/2 E4 F4 G4/2 G4/1.5 A4/0.5 G4 F4 E4 F4 G4/2 D4/2 G4/2 E4 C4/3'},
 {id:'s-mary',group:'Songs',title:'Mary Had a Little Lamb',bpm:110,bpb:4,level:1,desc:'Three neighbouring notes — the perfect first song.',
  seq:'E4 D4 C4 D4 E4 E4 E4/2 D4 D4 D4/2 E4 G4 G4/2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4/4'},
 {id:'s-twinkle',group:'Songs',title:'Twinkle Twinkle Little Star',bpm:100,bpb:4,level:1,desc:'Starts with a leap of a fifth, then walks home step by step.',
  seq:'C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2 G4 G4 F4 F4 E4 E4 D4/2 G4 G4 F4 F4 E4 E4 D4/2 C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2'},
 {id:'s-ode',group:'Songs',title:'Ode to Joy',bpm:100,bpb:4,level:2,desc:'Beethoven’s famous tune — smooth steps with dotted rhythms.',
  seq:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4/1.5 D4/0.5 D4/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/1.5 C4/0.5 C4/2'},
 {id:'s-macdonald',group:'Songs',title:'Old MacDonald Had a Farm',bpm:112,bpb:4,level:1,desc:'Dips below the home note, then lots of quick repeated notes on one pitch.',
  seq:'C4 C4 C4 G3 A3 A3 G3/2 E4 E4 D4 D4 C4/3 G3 C4 C4 C4 G3 A3 A3 G3/2 E4 E4 D4 D4 C4/3 G3/0.5 G3/0.5 C4 C4 C4 G3/0.5 G3/0.5 C4 C4 C4/2 C4/0.5 C4/0.5 C4 C4/0.5 C4/0.5 C4 C4/0.5 C4/0.5 C4/0.5 C4/0.5 C4 C4 C4 C4 C4 G3 A3 A3 G3/2 E4 E4 D4 D4 C4/4'},
 {id:'s-yankee',group:'Songs',title:'Yankee Doodle',bpm:116,bpb:4,level:2,desc:'A brisk march; the chorus drops low, so keep the bottom notes supported.',
  seq:'F4 F4 G4 A4 F4 A4 G4 C4 F4 F4 G4 A4 F4/2 E4/2 F4 F4 G4 A4 Bb4 A4 G4 F4 E4 C4 D4 E4 F4/2 F4/2 D4/1.5 E4/0.5 D4 C4 D4 E4 F4/2 C4/1.5 D4/0.5 C4 Bb3 A3/2 C4/2 D4/1.5 E4/0.5 D4 C4 D4 E4 F4 D4 C4 F4 E4 G4 F4/2 F4/2'},
 {id:'s-jingle',group:'Songs',title:'Jingle Bells',bpm:112,bpb:4,level:2,desc:'Lots of repeated notes — keep them steady — and a jump up to the top on “all the way”.',
  seq:'E4 E4 E4/2 E4 E4 E4/2 E4 G4 C4/1.5 D4/0.5 E4/4 F4 F4 F4/1.5 F4/0.5 F4 E4 E4 E4/0.5 E4/0.5 E4 D4 D4 E4 D4/2 G4/2 E4 E4 E4/2 E4 E4 E4/2 E4 G4 C4/1.5 D4/0.5 E4/4 F4 F4 F4 F4 F4 E4 E4 E4/0.5 E4/0.5 G4 G4 F4 D4 C4/4'},
 {id:'s-frere',group:'Songs',title:'Frère Jacques',bpm:100,bpb:4,level:2,desc:'A round with quick runs and a drop down to the low note.',
  seq:'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4/2 E4 F4 G4/2 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 C4 G3 C4/2 C4 G3 C4/2'},
 {id:'s-bday',group:'Songs',title:'Happy Birthday',bpm:100,bpb:3,level:3,desc:'That octave leap on the third line is a real pitch test.',
  seq:'G3/0.75 G3/0.25 A3 G3 C4 B3/2 G3/0.75 G3/0.25 A3 G3 D4 C4/2 G3/0.75 G3/0.25 G4 E4 C4 B3 A3/2 F4/0.75 F4/0.25 E4 C4 D4 C4/3'},
 {id:'s-grace',group:'Songs',title:'Amazing Grace',bpm:88,bpb:3,level:3,desc:'Slow and lyrical with wide leaps — focus on tone and control.',
  seq:'D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 G4/2 E4 D4/2 D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 D5/3 R/2 B4 D5/1.5 B4/0.5 D5/0.5 B4/0.5 G4/2 D4 E4/1.5 G4/0.5 G4/0.5 E4/0.5 D4/2 D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 G4/3'},
 {id:'s-silent',group:'Songs',title:'Silent Night',bpm:120,bpb:6,level:3,desc:'Gentle and slow, but it spans more than an octave and peaks on a high F.',
  seq:'G4/3 A4 G4/2 E4/6 G4/3 A4 G4/2 E4/6 D5/4 D5/2 B4/6 C5/4 C5/2 G4/6 A4/4 A4/2 C5/3 B4 A4/2 G4/3 A4 G4/2 E4/6 A4/4 A4/2 C5/3 B4 A4/2 G4/3 A4 G4/2 E4/6 D5/4 D5/2 F5/3 D5 B4/2 C5/6 E5/6 C5/3 G4 E4/2 G4/3 F4 D4/2 C4/12'},
];
function parseSeq(str){
  const out=[];const toks=String(str).trim().split(/[\s,|]+/).filter(Boolean);
  for(const tk of toks){
    const [n,b]=tk.split('/');const beats=b===undefined?1:parseFloat(b);
    if(!(beats>0)||beats>32) throw new Error(`Bad length in “${tk}”`);
    if(/^(r|rest|-)$/i.test(n)){out.push({midi:null,beats});continue}
    const m=n.match(/^([A-Ga-g])([#♯b♭]?)(-?\d)$/);
    if(!m) throw new Error(`Can’t read “${tk}” — try something like C4, F#4 or Bb3`);
    const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()];
    const acc=m[2]==='#'||m[2]==='♯'?1:m[2]?-1:0;
    const midi=12*(parseInt(m[3])+1)+base+acc;
    if(midi<28||midi>96) throw new Error(`“${tk}” is outside the singing range`);
    out.push({midi,beats});
  }
  if(!out.some(x=>x.midi!=null)) throw new Error('Add at least one note');
  return out;
}
let custom=store.get('custom',[]);
let tracks=[];const trackData={};
const allSongs=()=>{const d=store.get('drill',null);return [...tracks,...(d?[d]:[]),...BUILTIN,...custom.map(c=>({...c,group:'My melodies'}))]};
const isAudio=s=>!!(s||P.song)&&(s||P.song).kind==='audio';
const fmtTime=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

/* ---------- uploaded tracks: storage (IndexedDB) ---------- */
const idb={
  db:null,
  open(){if(this.db)return Promise.resolve(this.db);if(this.broken)return Promise.reject(new Error('storage unavailable'));return new Promise((res,rej)=>{const fail=e=>{if(!this.db){this.broken=true;rej(e||new Error('storage unavailable'))}};setTimeout(()=>fail(new Error('storage timed out')),3500);try{const r=indexedDB.open('tessitura',2);r.onblocked=()=>fail(new Error('storage blocked by another open copy of the app'));r.onupgradeneeded=()=>{const db=r.result;for(const n of ['tracks','takes'])if(!db.objectStoreNames.contains(n))db.createObjectStore(n,{keyPath:'id'})};r.onsuccess=()=>{this.db=r.result;this.db.onversionchange=()=>{try{this.db.close()}catch(e){}this.db=null};res(r.result)};r.onerror=()=>fail(r.error)}catch(e){fail(e)}})},
  async tx(mode,fn,store='tracks'){const db=await this.open();return new Promise((res,rej)=>{setTimeout(()=>rej(new Error('storage timed out')),5000);const t=db.transaction(store,mode);const st=t.objectStore(store);const r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})},
  all(){return this.tx('readonly',s=>s.getAll())},
  get(id){return this.tx('readonly',s=>s.get(id))},
  put(o){return this.tx('readwrite',s=>s.put(o))},
  del(id){return this.tx('readwrite',s=>s.delete(id))}
};

/* ---------- FFT (radix-2, in place) ---------- */
function makeFFT(N){
  const rev=new Uint32Array(N),lev=Math.log2(N);
  for(let i=0;i<N;i++){let r=0;for(let b=0;b<lev;b++)r|=((i>>b)&1)<<(lev-1-b);rev[i]=r}
  const cs=new Float64Array(N/2),sn=new Float64Array(N/2);
  for(let i=0;i<N/2;i++){cs[i]=Math.cos(2*Math.PI*i/N);sn[i]=Math.sin(2*Math.PI*i/N)}
  return (re,im,inv)=>{
    for(let i=0;i<N;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    const sg=inv?-1:1;
    for(let size=2;size<=N;size<<=1){
      const half=size>>1,step=N/size;
      for(let i=0;i<N;i+=size)for(let j=0,k=0;j<half;j++,k+=step){
        const a=i+j,b=a+half,c=cs[k],s=sn[k]*sg;
        const tr=re[b]*c+im[b]*s,ti=im[b]*c-re[b]*s;
        re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
      }
    }
    if(inv)for(let i=0;i<N;i++){re[i]/=N;im[i]/=N}
  };
}
const yieldUI=()=>new Promise(r=>setTimeout(r,0));

/* ================= SETTINGS ================= */
const S_DEFAULTS={transpose:0,tempo:100,tol:'std',anyOct:true,guide:false,songId:'w-five',vox:.25,music:.9,sync:0,range:null,autoKey:null};
const S=Object.assign({},S_DEFAULTS,store.get('settings',{}));
// a saved value of the wrong type falls back to the default, and numbers stay inside the ranges the controls allow
for(const [k,d] of Object.entries(S_DEFAULTS))if(d!==null&&typeof S[k]!==typeof d)S[k]=d;
S.transpose=clamp(Math.round(S.transpose),-12,12);S.tempo=clamp(S.tempo,50,150);S.vox=clamp(S.vox,0,1);S.music=clamp(S.music,0,1);S.sync=clamp(S.sync,0,400);
if(!['easy','std','strict'].includes(S.tol))S.tol='std';
if(S.range!==null&&!isObj(S.range))S.range=null;
const TOL={easy:50,std:30,strict:15};
const saveS=()=>store.set('settings',S);
