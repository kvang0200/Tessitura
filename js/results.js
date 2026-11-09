// Tessitura · Results after a run, the shared dialog (modal), custom melodies and the help screen.
'use strict';
/* ================= RESULTS ================= */
function computeResults(notes){
  const per=notes.map(n=>({dur:n.dur,midi:n.label!=null?n.label:Math.round(n.midi),score:n.total?n.hits/n.total:0,voiced:n.total?n.voiced/n.total:0,avg:n.near?n.sum/n.near:null}));
  const wsum=per.reduce((a,p)=>a+p.dur,0)||1,score=Math.round(per.reduce((a,p)=>a+p.score*p.dur,0)/wsum*100); // weighted by note length
  const good=per.filter(p=>p.score>=.6).length;
  const V=notes.reduce((a,n)=>a+n.voiced,0),T=notes.reduce((a,n)=>a+n.total,0);
  const NR=notes.reduce((a,n)=>a+n.near,0);
  const avg=NR?notes.reduce((a,n)=>a+n.sum,0)/NR:0;
  const std=NR?Math.sqrt(Math.max(0,notes.reduce((a,n)=>a+n.sq,0)/NR-avg*avg)):0;
  let streak=0,cur=0;for(const p of per){if(p.score>=.6){cur++;streak=Math.max(streak,cur)}else cur=0}
  const ms=per.map(p=>p.midi).sort((a,b)=>a-b);
  const hiT=ms[Math.floor(ms.length*.75)],loT=ms[Math.floor(ms.length*.25)];
  const missRate=arr=>arr.length?arr.filter(p=>p.score<.4).length/arr.length:0;
  return {score,good,count:per.length,per,avg,std,nearRatio:V?NR/V:0,streak,voicedRatio:T?V/T:0,
    hiMiss:missRate(per.filter(p=>p.midi>=hiT)),loMiss:missRate(per.filter(p=>p.midi<=loT)),midMiss:missRate(per.filter(p=>p.midi>loT&&p.midi<hiT))};
}
function verdict(s){return s>=90?['Stage ready','Beautifully in tune.']:s>=75?['Great singing','Most notes landed right on target.']:s>=55?['Getting there','Solid foundation — a few notes drifted.']:s>=30?['Keep at it','Every run trains your ear a little more.']:['Warming up','Try Listen first, then sing along slowly.']}
function showResults(r){
  const [h,sub]=verdict(r.score);
  const col=r.score>=75?'#5eead4':r.score>=45?'#fbbf24':'#fb7185';
  const C=2*Math.PI*58;
  const tend=r.nearRatio<.3?'—':Math.abs(r.avg)<8?'Centered':Math.round(Math.abs(r.avg))+'¢ '+(r.avg<0?'flat':'sharp');
  const steady=r.nearRatio<.3?'—':r.std<15?'Very steady':r.std<28?'Steady':r.std<45?'Wobbly':'Unsteady';
  const tips=[];
  if(r.voicedRatio<.6)tips.push('The mic heard silence for much of the notes. Sing a little louder, move closer to the mic, and hold each note for its full length.');
  if(r.nearRatio<.3&&r.voicedRatio>=.6)tips.push('Most of what you sang was on a different note from the melody. Press Listen and hum along quietly first, then try again. Turning on “Any octave” helps if the song sits too high or low for you.');
  if(r.nearRatio>=.3&&r.avg<-12)tips.push(`You tended to sing flat (about ${Math.round(-r.avg)} cents low). Keep steady breath support and think of “aiming slightly above” each note.`);
  if(r.nearRatio>=.3&&r.avg>12)tips.push(`You tended to sing sharp (about ${Math.round(r.avg)} cents high). Relax your throat and avoid pushing — let the note settle rather than reaching for it.`);
  if(r.hiMiss>.4&&r.hiMiss>r.midMiss+.15)tips.push('Your highest notes were the hardest. Try lowering the key 2–3 semitones and build up from there.');
  if(r.loMiss>.4&&r.loMiss>r.midMiss+.15)tips.push('The lowest notes slipped. Try raising the key 2–3 semitones, or turn on “Any octave”.');
  if(r.nearRatio>=.3&&r.std>35&&r.voicedRatio>=.6)tips.push('Your pitch wavered within notes. The “Long Tones” warm-up and the Tuner’s hold-steady drill are great for this.');
  if(r.score>=90)tips.push(S.tol==='strict'?'Excellent! Try a faster tempo or a harder song next.':'You nailed it — switch Accuracy to Strict for a tougher challenge.');
  if(!tips.length)tips.push('Listen once more to the tricky spots, then sing again — repetition is how pitch memory forms.');
  $('#modal').innerHTML=`
    <div class="res-top">
      <div class="ring"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="58" stroke="#24202f" stroke-width="12" fill="none"/><circle id="ringArc" cx="70" cy="70" r="58" stroke="${col}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/></svg><div class="n"><span>${r.score}<small>%</small></span></div></div>
      <div><div class="eyebrow">${esc(P.song.title)}</div><h2>${h}</h2><p class="muted" style="margin-top:6px">${sub}</p></div>
    </div>
    <div class="res-grid">
      <div><span>On pitch</span><b>${r.good}/${r.count}</b></div>
      <div><span>Tendency</span><b>${tend}</b></div>
      <div><span>Steadiness</span><b>${steady}</b></div>
      <div><span>Best streak</span><b>${r.streak} notes</b></div>
    </div>
    <div class="chips">${r.per.map(p=>`<span class="chip ${p.score>=.75?'g':p.score>=.4?'w':'b'}" title="${Math.round(p.score*100)}% on pitch${p.avg!=null?`, avg ${p.avg>0?'+':''}${Math.round(p.avg)}¢`:''}">${mname(p.midi)}</span>`).join('')}</div>
    <div class="tips">${tips.slice(0,3).map(t=>`<div>${t}</div>`).join('')}</div>
    <div class="modal-actions"><button class="btn ghost" data-close>Close</button><button class="btn ghost" id="listenBack" disabled>▶ Listen back</button><button class="btn primary" id="againBtn">Sing again <kbd style="margin-left:4px;background:rgba(0,0,0,.15);border-color:transparent;color:#1d0f08">Space</kbd></button></div>`;
  openModal();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=$('#ringArc');if(a)a.style.strokeDashoffset=C*(1-r.score/100)}));
  $('#againBtn').onclick=()=>startRun('sing');
}
function saveSession(r){
  const h=store.get('history',[]);
  h.push({id:P.song.id,title:P.song.title,score:r.score,date:Date.now(),tol:S.tol,tr:S.transpose,dur:Math.round(r.sung!=null?r.sung:P.total)});
  store.set('history',h.slice(-400));
  recordSessionStats(r);
  if(typeof onRoutineProgress==='function')onRoutineProgress();
}

/* ================= MODAL ================= */
let modalLocked=false;
function openModal(){$('#backdrop').classList.add('show')}
function closeModal(){$('#backdrop').classList.remove('show')}
const modalOpen=()=>$('#backdrop').classList.contains('show');
$('#backdrop').addEventListener('click',e=>{if(modalLocked)return;if(e.target.id==='backdrop'||e.target.closest('[data-close]'))closeModal()});

function openCustom(){
  $('#modal').innerHTML=`
    <div class="eyebrow">Custom melody</div><h2>Add your own song</h2>
    <p class="help">Type the notes of any melody you’re learning. Write each note as <code>C4</code>, <code>F#4</code> or <code>Bb3</code>. Add a length in beats after a slash — <code>G4/2</code> is two beats, <code>E4/0.5</code> is half a beat (no slash = 1 beat). Use <code>R</code> for a rest. Middle C is <code>C4</code>.</p>
    <div class="fields-row">
      <div class="field"><label>Title</label><input id="cTitle" placeholder="My song" maxlength="48"></div>
      <div class="field"><label>Tempo (bpm)</label><input id="cBpm" type="number" value="90" min="40" max="220"></div>
      <div class="field"><label>Beats / bar</label><select id="cBpb"><option>4</option><option>3</option><option>2</option><option>6</option></select></div>
    </div>
    <div class="field"><label>Notes</label><textarea id="cSeq" placeholder="C4 C4 G4 G4 A4 A4 G4/2 F4 F4 E4 E4 D4 D4 C4/2"></textarea></div>
    <div class="field"><label>Lyrics (optional): one syllable per note, end a syllable with - if the word continues, / for a new line</label><input id="cLyr" placeholder="Twin- kle twin- kle lit- tle star / How I won- der what you are"></div>
    <div class="parse-msg" id="cMsg"></div>
    <div class="modal-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn ghost" id="cPrev">▶ Preview</button><button class="btn primary" id="cSave">Save melody</button></div>`;
  openModal();
  const check=()=>{const m=$('#cMsg');try{const s=parseSeq($('#cSeq').value);const [lo,hi]=rangeOf(s);const b=s.reduce((a,n)=>a+n.beats,0);const nn=s.filter(n=>n.midi!=null).length,ly=($('#cLyr').value.trim().match(/[^\s/]+/g)||[]).length;m.className='parse-msg ok';m.textContent=`✓ ${nn} notes · ${b} beats · range ${mname(lo)}–${mname(hi)}`+(ly&&ly!==nn?` · lyrics have ${ly} syllables for ${nn} notes`:'');return s}catch(e){m.className='parse-msg err';m.textContent=$('#cSeq').value.trim()?e.message:'';return null}};
  $('#cSeq').oninput=check;$('#cLyr').oninput=check;
  $('#cPrev').onclick=async()=>{const s=check();if(!s)return;await ensureCtx();const spb=60/clamp(+$('#cBpm').value||90,40,220);let t=actx.currentTime+.1;for(const n of s){if(n.midi!=null)tone(n.midi,t,n.beats*spb*.95,.18);t+=n.beats*spb}};
  $('#cSave').onclick=()=>{
    const s=check();if(!s){if(!$('#cSeq').value.trim()){$('#cMsg').className='parse-msg err';$('#cMsg').textContent='Add some notes first'}return}
    const c={id:'c-'+Date.now(),lyr:$('#cLyr').value.trim()||undefined,title:$('#cTitle').value.trim()||'Untitled melody',bpm:clamp(+$('#cBpm').value||90,40,220),bpb:+$('#cBpb').value,level:0,desc:'Your custom melody.',seq:$('#cSeq').value.trim()};
    custom.push(c);store.set('custom',custom);closeModal();loadSong(c.id);toast('Saved to My melodies');
  };
  setTimeout(()=>$('#cTitle').focus(),50);
}
function openHelp(){
  $('#modal').innerHTML=`
    <div class="eyebrow">How it works</div><h2>Train your pitch</h2>
    <div class="help-list">
      <div><span class="n">1</span><span><b>Turn on your mic</b> and start in the <b>Train</b> tab: find your vocal range so every song moves into the right key for you, then follow today’s 10-minute routine.</span></div>
      <div><span class="n">2</span><span><b>Practice:</b> pick a song, press <b>Listen</b>, then <b>Start singing</b>. Keep your glowing line inside the bars: teal is on pitch, amber is close, rose is off. Lyrics scroll along with the notes.</span></div>
      <div><span class="n">3</span><span><b>Loop the hard parts:</b> drag across the timeline under the lanes to repeat a section, or click it to start anywhere. Slow the <b>Tempo</b> for built-in songs.</span></div>
      <div><span class="n">4</span><span><b>Listen back:</b> every sung take is recorded. Open <b>Takes</b> or press <b>Listen back</b> after a run to hear yourself with your pitch line replayed.</span></div>
      <div><span class="n">5</span><span><b>Upload your own songs</b> (add the isolated vocal file for best accuracy), turn the singer down for karaoke, and add lyrics.</span></div>
      <div><span class="n">6</span><span><b>Ear training</b> (Train tab) builds your inner pitch, and <b>Progress → Weak spots</b> shows the notes and leaps you miss most, with a drill made just for them.</span></div>
    </div>
    <p class="help" style="margin-top:18px">Shortcuts: <kbd>Space</kbd> sing / stop · <kbd>L</kbd> listen · <kbd>↑</kbd><kbd>↓</kbd> change key · <kbd>+</kbd><kbd>−</kbd> zoom lanes · <kbd>0</kbd> fit · <kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd> scroll lanes · <kbd>Esc</kbd> stop<br>On the lanes: scroll to move up/down, Ctrl/⌘ + scroll (or pinch) to zoom.</p>
    <div class="modal-actions"><button class="btn primary" data-close>Got it</button></div>`;
  openModal();
}
