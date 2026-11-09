// Tessitura · Lyrics: built-in syllables, display, the lyrics editor, automatic placement and tap-to-sync.
'use strict';
/* ================= LYRICS ================= */
const LYRICS={"w-five": "Ma Me Mi Mo Mu Mo Mi Me Ma / Ma Me Mi Mo Mu Mo Mi Me Ma / Ma Me Mi Mo Mu Mo Mi Me Ma", "w-long": "Ah / Eh / Ee / Oh / Oo", "w-scale": "Do Re Mi Fa Sol La Ti Do / Ti La Sol Fa Mi Re Do", "w-arp": "Do Mi Sol Do Sol Mi Do / Re Fi La Re La Fi Re", "w-int": "Do Sol Do Mi Do La Do Do Do", "s-mary": "Ma- ry had a lit- tle lamb, / lit- tle lamb, / lit- tle lamb, / Ma- ry had a lit- tle lamb, its / fleece was white as snow.", "s-twinkle": "Twin- kle, twin- kle, lit- tle star, / How I won- der what you are! / Up a- bove the world so high, / Like a dia- mond in the sky. / Twin- kle, twin- kle, lit- tle star, / How I won- der what you are!", "s-ode": "Joy- ful, joy- ful, we a- dore thee, / God of glo- ry, Lord of love; / Hearts un- fold like flow'rs be- fore thee, / Op'- ning to the sun a- bove.", "s-frere": "Frè- re Jac- ques, / Frè- re Jac- ques, / Dor- mez- vous? / Dor- mez- vous? / Son- nez les ma- ti- nes, / Son- nez les ma- ti- nes, / Ding, dang, dong. / Ding, dang, dong.", "s-bday": "Hap- py birth- day to you, / Hap- py birth- day to you, / Hap- py birth- day dear sing- er, / Hap- py birth- day to you!", "s-grace": "A- maz- ing ~ grace, how sweet the sound / That saved a ~ wretch like me. / I once was lost ~ ~ but now am ~ ~ found, / Was blind but ~ now I see."};
function attachLyrics(){
  P.lyr=null;if(!P.song)return;
  if(isAudio()){const ly=P.song.lyrics;if(ly&&ly.length)P.lyr={kind:'time',lines:ly};return}
  const src=P.song.lyr||LYRICS[P.song.id];if(!src)return;
  const lines=String(src).split('/').map(l=>l.trim().split(/\s+/).filter(Boolean));
  const notes=P.notes.filter(n=>n.midi!=null),sylls=[];let k=0;
  lines.forEach((ln,li)=>ln.forEach(tk=>{const n=notes[k++];if(!n)return;
    if(tk==='~'&&sylls.length){n.sylId=sylls.length-1;sylls[sylls.length-1].notes.push(n)}
    else{sylls.push({text:tk,line:li,notes:[n]});n.sylId=sylls.length-1;n.syl=tk.replace(/-$/,'')}}));
  if(sylls.length)P.lyr={kind:'syl',sylls,nLines:lines.length};
}
let lyrKey='';
function sylHtml(list,cls){let h='';list.forEach((x,i)=>{const t=x.text,join=/-$/.test(t);h+=`<span class="${cls(x,i)}">${esc(t.replace(/-$/,''))}</span>${join?'':' '}`});return h}
function updateLyrics(){
  const box=$('#lyrBox');
  if(P.syncLyr){const sl=P.syncLyr,ln=sl.lines[sl.i]||'';const key='sync'+sl.i;if(key!==lyrKey){lyrKey=key;box.hidden=false;box.classList.add('sync');
      $('#lyr1').innerHTML=`<span class="cur">${esc(ln)}</span>`;$('#lyr2').innerHTML=`Press <kbd>Enter</kbd> (or click here) the moment this line starts · ${sl.i+1} of ${sl.lines.length}`}return}
  box.classList.remove('sync');
  if(!P.lyr||S.lyrics===false){if(!box.hidden){box.hidden=true;lyrKey=''}return}
  const now=P.now;let key,l1='',l2='';
  if(P.lyr.kind==='syl'){
    const sy=P.lyr.sylls;let nx=sy.findIndex(x=>{const e=x.notes[x.notes.length-1];return e.start+e.dur>now});
    const done=nx<0;if(done)nx=sy.length-1;
    const isCur=!done&&now>=sy[nx].notes[0].start-.05,line=sy[nx].line;
    key=line+'|'+nx+'|'+isCur+'|'+done;if(key===lyrKey)return;
    const inLine=sy.map((x,i)=>({...x,i})).filter(x=>x.line===line),nextLine=sy.filter(x=>x.line===line+1);
    l1=sylHtml(inLine,x=>done||x.i<nx?'past':x.i===nx&&isCur?'cur':'');
    l2=sylHtml(nextLine,()=>'');
  }else{
    const ls=P.lyr.lines;let i=-1;for(let j=0;j<ls.length;j++)if(ls[j].t<=now+.25)i=j;
    key='t'+i;if(key===lyrKey)return;
    if(i<0){l1=`<span>${esc(ls[0].text)}</span>`;l2=ls[1]?esc(ls[1].text):''}
    else{l1=`<span class="cur">${esc(ls[i].text)}</span>`;l2=ls[i+1]?esc(ls[i+1].text):''}
  }
  lyrKey=key;box.hidden=false;$('#lyr1').innerHTML=l1;$('#lyr2').innerHTML=l2;
}
function parseLRC(text){
  const out=[];let timed=false;
  for(const raw of text.split(/\r?\n/)){
    const tags=[...raw.matchAll(/\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];const line=raw.replace(/\[[^\]]*\]/g,'').trim();
    if(tags.length){timed=true;for(const m of tags)out.push({t:+m[1]*60+parseFloat(m[2].replace(':','.')),text:line})}
    else if(line&&!/^\[/.test(raw.trim()))out.push({t:null,text:line});
  }
  return {timed,lines:timed?out.filter(x=>x.t!=null&&x.text).sort((a,b)=>a.t-b.t):out.map(x=>x.text)};
}
function fmtLRC(t){const m=Math.floor(t/60),s=(t%60).toFixed(2).padStart(5,'0');return `[${String(m).padStart(2,'0')}:${s}]`}
/* ---------- automatic lyric placement ----------
   Fits lyric lines onto the sung notes: each line should cover about as many notes as it has syllables,
   lines tend to start after a breath (a gap in the singing), and a line rarely contains a long pause. */
function wordSyl(w){
  w=w.toLowerCase().replace(/[^a-zà-ÿ']/g,'').replace(/'/g,'');if(!w)return 0;if(w.length<=3)return 1;
  let s=(w.match(/[aeiouyà-ÿ]+/g)||[]).length;
  if(/[^aeiouy]e$/.test(w)&&!/[^aeiouy]le$/.test(w))s--;                       // silent final e ("time"), but "lit-tle" is sung
  if(/[^aeiouy](es|ed)$/.test(w)&&!/(t|d)ed$|(s|z|x|ch|sh|c|g)es$/.test(w))s--; // "saved", "times" (but "wanted", "kisses")
  return Math.max(1,s);
}
const lineSyl=l=>l.split(/[\s\-–—]+/).reduce((a,w)=>a+wordSyl(w),0);
function readLyricLines(text){
  const out=[];let brk=false;
  for(const raw of String(text).split(/\r?\n/)){
    const l=raw.replace(/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/g,'').trim();
    if(!l||/^\[[^\]]*\]$/.test(l)||/^(verse|chorus|bridge|intro|outro|pre-?chorus|hook)\b[\s\d:]*$/i.test(l)){brk=true;continue} // blank lines and [Chorus] labels mark sections
    out.push({text:l,syl:Math.max(1,lineSyl(l)),brk});brk=false;
  }
  return out;
}
function autoPlaceLyrics(lines,notes){
  notes=[...notes].sort((a,b)=>a.start-b.start);
  const N=notes.length,L=lines.length;if(!N||!L)return null;
  const st=notes.map(n=>n.start),en=notes.map(n=>n.start+n.dur),gap=st.map((t,j)=>j?t-en[j-1]:.6); // the song's first note is not a 'breath'
  const pen=new Float64Array(N);for(let j=1;j<N;j++)pen[j]=pen[j-1]+6*Math.max(0,gap[j]-.5); // long pauses inside a line are unlikely
  const lineCost=(i,j,k)=>{ // line i covers notes j..k-1
    const n=k-j,s=lines[i].syl,mis=n>=s?.5*(n-s)*(n-s)/(s+2):2*(s-n)*(s-n)/(s+1);
    const inner=pen[k-1]-pen[j],dur=en[k-1]-st[j],tooLong=Math.max(0,dur-(s*.9+2));
    return mis+inner+tooLong;
  };
  const startBonus=(i,j)=>1.2*Math.min(gap[j],1)+(lines[i].brk&&gap[j]>1.5?1:0);
  const D=[],B=[];for(let i=0;i<L;i++){D.push(new Float64Array(N).fill(Infinity));B.push(new Int32Array(N).fill(-1))}
  for(let j=0;j<N;j++)D[0][j]=.25*j-startBonus(0,j);   // notes before the first line (intro ad-libs) cost a little each
  for(let i=1;i<L;i++){const W=lines[i-1].syl*3+12;
    for(let k=i;k<N;k++){let best=Infinity,bj=-1;
      for(let j=Math.max(i-1,k-W);j<k;j++){const c=D[i-1][j];if(c===Infinity)continue;const v=c+lineCost(i-1,j,k);if(v<best){best=v;bj=j}}
      if(bj>=0){D[i][k]=best-startBonus(i,k);B[i][k]=bj}}}
  // the last line ends wherever fits best; leftover notes (outro ad-libs) cost a little each
  let best=Infinity,bj=-1;const sL=lines[L-1].syl;
  for(let j=L-1;j<N;j++){if(D[L-1][j]===Infinity)continue;
    for(let e=j+1;e<=Math.min(N,j+sL*3+12);e++){const v=D[L-1][j]+lineCost(L-1,j,e)+.25*(N-e);if(v<best){best=v;bj=j}}}
  if(bj<0)return null;
  const starts=new Array(L);starts[L-1]=bj;for(let i=L-1;i>0;i--)starts[i-1]=B[i][starts[i]];
  return lines.map((l,i)=>({t:Math.max(0,st[starts[i]]-.08),text:l.text}));
}

function openLyricsEditor(){
  const meta=P.song,has=meta.lyrics&&meta.lyrics.length,d=trackData[meta.id],canAuto=!!(d&&d.an.notes&&d.an.notes.length>=8);
  $('#modal').innerHTML=`<div class="eyebrow">${esc(meta.title)}</div><h2>Lyrics</h2>
    <p class="help">Paste the lyrics (one sung line per line) or choose a <code>.txt</code> / <code>.lrc</code> file. Timed lyrics (lines like <code>[01:23.45] text</code>) line up straight away. For plain lyrics, choose <b>Place automatically</b> and the app fits each line onto the singing, or <b>Tap to sync</b> to tap along as the song plays.</p>
    <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap"><button class="btn ghost sm" id="lyFile">📄 Choose file…</button><input type="file" id="lyFileIn" accept=".lrc,.txt,text/plain" hidden>
      <span class="muted" style="font-size:12px" id="lyShiftWrap" hidden>Move all lines: <button class="btn ghost sm" data-sh="-0.5">−0.5 s</button> <button class="btn ghost sm" data-sh="-0.1">−0.1 s</button> <button class="btn ghost sm" data-sh="0.1">+0.1 s</button> <button class="btn ghost sm" data-sh="0.5">+0.5 s</button></span></div>
    <div class="field"><label>Lyrics</label><textarea id="lyIn" style="min-height:220px;font-family:Manrope,sans-serif">${esc(has?meta.lyrics.map(l=>fmtLRC(l.t)+' '+l.text).join('\n'):'')}</textarea></div>
    <div class="parse-msg" id="lyMsg"></div>
    <div class="modal-actions">${has?'<button class="btn ghost" id="lyDel">Remove</button>':''}<button class="btn ghost" data-close>Cancel</button>
      <button class="btn ghost" id="lyTap" hidden>Tap to sync</button><button class="btn primary" id="lyAuto" hidden>Place automatically</button><button class="btn primary" id="lySave" hidden>Save</button></div>`;
  openModal();
  const chk=()=>{const r=parseLRC($('#lyIn').value),m=$('#lyMsg');
    $('#lySave').hidden=!r.timed;$('#lyAuto').hidden=r.timed||!r.lines.length;$('#lyTap').hidden=r.timed||!r.lines.length;$('#lyShiftWrap').hidden=!r.timed;
    if(!r.lines.length){m.textContent='';return r}
    m.className='parse-msg ok';m.textContent=r.timed?`✓ ${r.lines.length} timed lines, ready to save`:`${r.lines.length} lines.`+(canAuto?' Place them automatically, or tap along as the song plays.':' Tap along as the song plays to place them.');
    if(!canAuto)$('#lyAuto').hidden=true;return r};
  $('#lyIn').oninput=chk;chk();
  $('#lyFile').onclick=()=>$('#lyFileIn').click();
  $('#lyFileIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>500000){toast('That file is too large for lyrics');return}
    try{$('#lyIn').value=await f.text();chk()}catch(err){toast('Couldn’t read that file')}};
  $$('#lyShiftWrap [data-sh]').forEach(b=>b.onclick=()=>{const dt=+b.dataset.sh;
    $('#lyIn').value=$('#lyIn').value.replace(/\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g,(m,mm,ss)=>fmtLRC(Math.max(0,+mm*60+parseFloat(ss.replace(':','.'))+dt)));chk()});
  const del=$('#lyDel');if(del)del.onclick=()=>{meta.lyrics=null;saveTrackMeta(meta);closeModal();attachLyrics();lyrKey='';renderHead()};
  const saveLines=(lines,msg)=>{meta.lyrics=lines;saveTrackMeta(meta);closeModal();attachLyrics();lyrKey='';renderHead();toast(msg)};
  $('#lySave').onclick=()=>{const r=chk();if(r.timed&&r.lines.length)saveLines(r.lines,`Lyrics saved (${r.lines.length} lines)`)};
  $('#lyAuto').onclick=()=>{
    const lines=readLyricLines($('#lyIn').value),placed=autoPlaceLyrics(lines,d.an.units&&d.an.units.length?d.an.units:d.an.notes);
    if(!placed){$('#lyMsg').className='parse-msg err';$('#lyMsg').textContent='Couldn’t place these lyrics automatically. Try Tap to sync.';return}
    saveLines(placed,'Lyrics placed automatically. Play the song to check; Edit lyrics lets you fine-tune.');
  };
  $('#lyTap').onclick=()=>{const r=chk();if(!r.lines.length)return;closeModal();P.offset=0;P.loop=null;updateLoopPill();
    startRun('listen').then(()=>{P.syncLyr={lines:r.lines,i:0,out:[]};lyrKey=''})};
}
function tapLyric(){
  const sl=P.syncLyr;if(!sl||!P.running)return;
  sl.out.push({t:Math.max(0,P.now-.12),text:sl.lines[sl.i]});sl.i++;
  if(sl.i>=sl.lines.length)finishLyrSync();else lyrKey='';
}
function finishLyrSync(){
  const sl=P.syncLyr;if(!sl)return;P.syncLyr=null;lyrKey='';
  if(P.running)stopRun();
  const meta=P.song;if(!sl.out.length){toast('Lyrics sync cancelled');return}
  let last=sl.out[sl.out.length-1].t;for(let j=sl.i;j<sl.lines.length;j++){last+=3;sl.out.push({t:last,text:sl.lines[j]})}
  meta.lyrics=sl.out;saveTrackMeta(meta);attachLyrics();renderHead();
  toast(sl.i>=sl.lines.length?'Lyrics synced and saved!':`Synced ${sl.i} of ${sl.lines.length} lines. Edit them anytime from the banner.`);
}
