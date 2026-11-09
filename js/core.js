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
const store={
  get(k,d){try{const v=localStorage.getItem('tessitura.'+k);return v?JSON.parse(v):d}catch(e){return d}},
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
 {id:'s-mary',group:'Songs',title:'Mary Had a Little Lamb',bpm:110,bpb:4,level:1,desc:'Three neighbouring notes — the perfect first song.',
  seq:'E4 D4 C4 D4 E4 E4 E4/2 D4 D4 D4/2 E4 G4 G4/2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4/4'},
 {id:'s-twinkle',group:'Songs',title:'Twinkle Twinkle Little Star',bpm:100,bpb:4,level:1,desc:'Starts with a leap of a fifth, then walks home step by step.',
  seq:'C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2 G4 G4 F4 F4 E4 E4 D4/2 G4 G4 F4 F4 E4 E4 D4/2 C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2'},
 {id:'s-ode',group:'Songs',title:'Ode to Joy',bpm:100,bpb:4,level:2,desc:'Beethoven’s famous tune — smooth steps with dotted rhythms.',
  seq:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4/1.5 D4/0.5 D4/2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4/1.5 C4/0.5 C4/2'},
 {id:'s-frere',group:'Songs',title:'Frère Jacques',bpm:100,bpb:4,level:2,desc:'A round with quick runs and a drop down to the low note.',
  seq:'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4/2 E4 F4 G4/2 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 C4 G3 C4/2 C4 G3 C4/2'},
 {id:'s-bday',group:'Songs',title:'Happy Birthday',bpm:100,bpb:3,level:3,desc:'That octave leap on the third line is a real pitch test.',
  seq:'G3/0.75 G3/0.25 A3 G3 C4 B3/2 G3/0.75 G3/0.25 A3 G3 D4 C4/2 G3/0.75 G3/0.25 G4 E4 C4 B3 A3/2 F4/0.75 F4/0.25 E4 C4 D4 C4/3'},
 {id:'s-grace',group:'Songs',title:'Amazing Grace',bpm:88,bpb:3,level:3,desc:'Slow and lyrical with wide leaps — focus on tone and control.',
  seq:'D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 G4/2 E4 D4/2 D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 D5/3 R/2 B4 D5/1.5 B4/0.5 D5/0.5 B4/0.5 G4/2 D4 E4/1.5 G4/0.5 G4/0.5 E4/0.5 D4/2 D4 G4/2 B4/0.5 G4/0.5 B4/2 A4 G4/3'},
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
const S=Object.assign({transpose:0,tempo:100,tol:'std',anyOct:true,guide:false,songId:'w-five',vox:.25,music:.9,sync:0,range:null,autoKey:null},store.get('settings',{}));
const TOL={easy:50,std:30,strict:15};
const saveS=()=>store.set('settings',S);
