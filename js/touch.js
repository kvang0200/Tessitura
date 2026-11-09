// Tessitura · Phone and tablet support: song drawer, settings sheet, tap-friendly tips, pinch/drag on the lanes.
'use strict';

/* ---------- song drawer (narrow screens) and settings sheet (phones) ---------- */
const narrowMQ=matchMedia('(max-width:1000px)');
const sheetMQ=matchMedia('(max-width:640px),(max-height:560px) and (max-width:1000px)');
function setPanel(which){
  $('.library').classList.toggle('open',which==='lib');
  $('#controls').classList.toggle('open',which==='set');
  $('#scrim').classList.toggle('show',!!which);
}
const closePanels=()=>setPanel(null);
$('#libBtn').onclick=()=>setPanel('lib');
$('#setBtn').onclick=()=>setPanel('set');
$('#libClose').onclick=closePanels;
$('#setClose').onclick=closePanels;
$('#scrim').onclick=closePanels;
// picking a song, adding one, or making a melody closes the drawer
$('.library').addEventListener('click',e=>{
  if(!narrowMQ.matches)return;
  if(e.target.closest('.del'))return;
  if(e.target.closest('.song,#uploadBtn,#newSongBtn'))setTimeout(closePanels,120);
});
$$('.tabs button').forEach(b=>b.addEventListener('click',closePanels));
narrowMQ.addEventListener('change',closePanels);
sheetMQ.addEventListener('change',closePanels);
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#scrim').classList.contains('show')){closePanels();e.stopImmediatePropagation()}},true);

/* ---------- tips: hover with a mouse, tap with a finger; always kept on screen ---------- */
const tipBox=document.createElement('div');tipBox.className='tipbox';tipBox.hidden=true;document.body.appendChild(tipBox);
let tipFor=null,lastPtr='mouse';
function showTip(el){
  tipFor=el;tipBox.textContent=el.dataset.tip;tipBox.hidden=false;
  const r=el.getBoundingClientRect(),w=tipBox.offsetWidth,h=tipBox.offsetHeight;
  let y=r.top-h-8;if(y<8)y=r.bottom+8;
  tipBox.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';tipBox.style.top=y+'px';
}
function hideTip(){tipBox.hidden=true;tipFor=null}
document.addEventListener('pointerdown',e=>{lastPtr=e.pointerType||'mouse'},true);
document.addEventListener('pointerover',e=>{
  if(e.pointerType!=='mouse')return;
  const t=e.target.closest('[data-tip]');
  if(t){if(t!==tipFor)showTip(t)}else if(tipFor)hideTip();
});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tip]');
  if(t&&lastPtr!=='mouse'){if(tipFor===t)hideTip();else showTip(t);return}
  if(tipFor&&!t)hideTip();
},true);
addEventListener('scroll',()=>{if(tipFor)hideTip()},true);
addEventListener('resize',()=>{if(tipFor)hideTip()});

/* ---------- lanes: pinch to zoom, drag up/down to move when zoomed in ---------- */
const touches=new Map();let gest=null,gestEnd=0;
$('#stage').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||e.target.closest('.zoom,.note-pop,.stage-hint,.lyrics.sync'))return;
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});gest=null;
});
$('#stage').addEventListener('pointermove',e=>{
  const p=touches.get(e.pointerId);if(!p)return;
  const L=P._lay;if(!L){p.x=e.clientX;p.y=e.clientY;return}
  if(touches.size>=2){
    p.x=e.clientX;p.y=e.clientY;
    const [a,b]=[...touches.values()],d=Math.max(20,Math.hypot(a.x-b.x,a.y-b.y));
    const r=$('#roll').getBoundingClientRect(),my=(a.y+b.y)/2-r.top,anchor=L.vhi-(my-L.pad)/L.lh;
    if(!gest||gest.kind!=='pinch'){gest={kind:'pinch',d,span:Z.span||fitSpan()};return}
    const want=clamp(gest.span*gest.d/d,5,48),cur=Z.span||fitSpan();
    if(Math.abs(want-cur)>.05)zoomView(want/cur,anchor);
  }else{
    const dy=e.clientY-p.y;
    if(!gest){if(Math.abs(dy)<8&&Math.abs(e.clientX-p.x)<8)return;gest={kind:'pan'}}
    p.x=e.clientX;p.y=e.clientY;
    if(gest.kind==='pan'&&Z.span)panView(dy/Math.max(8,L.lh));
  }
});
const endTouch=e=>{if(!touches.delete(e.pointerId))return;if(gest)gestEnd=performance.now();if(!touches.size)gest=null};
$('#stage').addEventListener('pointerup',endTouch);
$('#stage').addEventListener('pointercancel',endTouch);
// a pinch or drag shouldn't also open the note editor
$('#roll').addEventListener('click',e=>{if(performance.now()-gestEnd<400)e.stopImmediatePropagation()},true);
