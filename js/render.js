// Вся отрисовка. Не импортирует действия: кнопки помечаются data-act.
import {state,isMyTurn} from './state.js';
import {PC,PIPS,TARGET,OPEN_MIN,DOT_LIMIT,BOLT_LIMIT,ZERO_STREAK,getBarrel,calcScore} from './rules.js';
import {$,esc,ptsWord,hodWord,isTouch} from './util.js';
import {playRollSound} from './sound.js';
import {canBank} from './ledger.js';
export function showScreen(name){['join','lobby','game'].forEach(s=>$(s).hidden=(s!==name));}
export function renderScreen(prev){
if(!state.room){showScreen('join');return;}
if(state.room.meta.status==='lobby'){renderLobby();showScreen('lobby');}
else{renderGame(prev);showScreen('game');}
}
export function renderLobby(){
$('lobbyCode').textContent=state.roomCode;
const box=$('lobbyPlayers');box.innerHTML='';
state.room.order.forEach(pid=>{
const p=state.room.players[pid];if(!p)return;
const r=document.createElement('div');r.className='playerRow';
r.innerHTML=`<span class="pdotBig" style="background:${PC[p.seat]};color:${PC[p.seat]}"></span>
<b>${esc(p.name)}</b>${pid===state.room.meta.createdBy?'<span class="badge">организатор</span>':''}
<span class="onlineDot" style="background:${p.online?'#7de3a1':'#5a6f64'};box-shadow:0 0 8px ${p.online?'#7de3a1':'none'}"></span>`;
box.appendChild(r);
});
$('lobbyCount').textContent=state.room.order.length;
const iAmCreator=state.room.meta.createdBy===state.myPid;
const btn=$('startGameBtn');
btn.disabled=!iAmCreator||state.room.order.length<2;
btn.style.opacity=btn.disabled?.5:1;
$('lobbyHint').textContent=!iAmCreator?'Ожидание организатора…':(state.room.order.length<2?'Нужно минимум 2 игрока — поделитесь кодом':'Всё готово!');
}
export function renderGame(prev){
$('codeChip').textContent=state.roomCode;
if(!state.room.game)return;
maybeIncomingAnim(prev);
renderPlayers();renderTrack();renderDice();renderTray();renderTurnInfo();renderActions();renderLog();
if(state.room.meta.status==='finished'){$('winOverlay').hidden=false;renderWin();}
else $('winOverlay').hidden=true;
}
export function renderPlayers(){
const box=$('players');box.innerHTML='';
const g=state.room.game;
state.room.order.forEach(pid=>{
const p=state.room.players[pid];if(!p)return;
const barrel=getBarrel(p.score),act=g&&g.current===pid;
const c=document.createElement('div');
c.className='pcard'+(act?' active':'')+(barrel?' bcard':'');
c.style.setProperty('--pc',PC[p.seat]);
const hist=p.hist||[];
if(hist.length)c.title='История записей: '+(p.opened?'':'(не открыт) ')+hist.map(e=>e.x?'✗'+e.v:e.v).join(' → ');
let potHtml='';
if(act&&state.room.meta.status==='playing'&&g&&g.turnTotal>0&&(g.phase==='choose'||g.phase==='roll')){
const pot=p.score+g.turnTotal;
const pcls=(getBarrel(pot)||pot>TARGET)?'pot danger':(pot===TARGET?'pot win':'pot');
potHtml=`<span class="${pcls}" title="Счёт + взято за ход">→ ${pot}</span>`;
}
const chips=[];
if(!p.opened)chips.push('<span class="chip lock">🔒 вход ≥50</span>');
if(p.inBarrel!=null)chips.push(`<span class="chip barrel">🛢 бочка ${p.inBarrel}–${p.inBarrel+100} · ${p.barrelLeft!=null?hodWord(p.barrelLeft):''}</span>`);
if(p.zeroStreak)chips.push(`<span class="chip zero">⚡ нулевых подряд: ${p.zeroStreak}/${ZERO_STREAK}</span>`);
if(p.dots)chips.push(`<span class="chip dot">🎯 точки: ${p.dots}/${DOT_LIMIT}</span>`);
if(p.bolts)chips.push(`<span class="chip bolt">🔩 болты: ${p.bolts}/${BOLT_LIMIT}</span>`);
if(!chips.length)chips.push('<span class="chip">в игре</span>');
c.innerHTML=`<div class="phead"><span class="pdot"></span><span class="pname">${esc(p.name)}</span>
${act?'<span class="go">ходит</span>':''}
<span class="odot" style="background:${p.online?'#7de3a1':'#5a6f64'}"></span></div>
<div class="pscore">${p.score} ${potHtml}</div><div class="chips">${chips.join('')}</div>`;
box.appendChild(c);
});
}
export function renderTrack(){
const t=$('tokens');t.innerHTML='';
state.room.order.forEach(pid=>{
const p=state.room.players[pid];if(!p)return;
const tok=document.createElement('div');
tok.className='token'+(state.room.game.current===pid?' cur':'');
tok.style.setProperty('--c',PC[p.seat]);
tok.style.left=Math.max(0,Math.min(1000,p.score))/10+'%';
t.appendChild(tok);
});
}
export function buildDieEl(face,cls){
const d=document.createElement('div');d.className='die '+(cls||'big')+(face===1?' red':'');
const f=document.createElement('div');f.className='face';
for(let i=0;i<9;i++){const c=document.createElement('span');c.className='cell'+(PIPS[face]&&PIPS[face].includes(i)?' pip':'');f.appendChild(c);}
d.appendChild(f);return d;
}
export function setFaceEl(el,face){el.classList.toggle('red',face===1);el.querySelectorAll('.cell').forEach((c,i)=>c.classList.toggle('pip',PIPS[face].includes(i)));}
export function renderDice(){
const box=$('diceBox');box.innerHTML='';
const dice=state.room.game.dice||[];
if(dice.length){
dice.forEach(d=>{
const de=buildDieEl(d.face,'big');
if(state.room.game.busted)de.classList.add('bust');
box.appendChild(de);
});
}else for(let i=0;i<5;i++){
const g=document.createElement('div');g.className='die big ghost';
g.innerHTML='<div class="face">'+Array.from({length:9},()=>'<span class="cell"></span>').join('')+'</div>';
box.appendChild(g);
}
}
export function maybeIncomingAnim(prev){
if(!prev||!prev.game||state.animLock||isMyTurn())return;
const g=state.room.game;
if(g.seq===prev.game.seq)return;
if(g.phase==='choose'||(g.phase==='wait'&&(g.dice||[]).length)){
playRollSound();
const els=[...document.querySelectorAll('#diceBox .die:not(.ghost)')];
if(!els.length)return;
state.animLock=true;
els.forEach((el,i)=>{el.classList.add('rolling');el.style.animationDelay=i*60+'ms';});
setTimeout(()=>{els.forEach(el=>{el.classList.remove('rolling');el.style.animationDelay='';});state.animLock=false;},420);
}
}
export function renderTray(){
const tb=$('trayBox');tb.innerHTML='';
const groups=(state.room.game.tray||[]).map(x=>Array.isArray(x)?x:[x]).filter(g=>g.length);
if(!groups.length){tb.innerHTML='<span class="trayEmpty">взятые за ход кубики появятся здесь</span>';}
else groups.forEach((grp,gi)=>{
if(gi>0){const plus=document.createElement('span');plus.className='trayPlus';plus.textContent='+';tb.appendChild(plus);}
const col=document.createElement('div');col.className='trayCol';
grp.forEach(f=>col.appendChild(buildDieEl(f,'mini')));
const sum=document.createElement('div');sum.className='colSum';sum.textContent=calcScore(grp);
col.appendChild(sum);
tb.appendChild(col);
});
$('turnTotalVal').textContent=state.room.game.turnTotal||0;
}
export function renderTurnInfo(){
const g=state.room.game,p=state.room.players[g.current];
let req='',cls='req';
const banner=$('banner');
if(g.phase==='wait'){
const entries=Object.values(state.room.log||{}).sort((a,b)=>a.ts-b.ts);
const last=entries[entries.length-1];
banner.hidden=false;banner.textContent=(g.busted?'💥 ':'')+(last?last.t:'');
}else banner.hidden=true;
if(!p){$('turnInfo').innerHTML='';return;}
if(!p.opened)req=`🔒 Вход в игру: нужно не менее ${OPEN_MIN} за ход (взято ${g.turnTotal||0})`;
else{
const barrel=getBarrel(p.score);
if(barrel){
const left=p.barrelLeft!=null?p.barrelLeft:2;
req=`🛢 Бочка ${barrel.lo}–${barrel.hi}: выйти выше ${barrel.hi} — ${left===1?'остался 1 ход!':'осталось '+hodWord(left)}`;
if(left===1)cls+=' bad';
}else{
const left=TARGET-(p.score+(g.turnTotal||0));
if(left<0){req=`⚠ Перебор на ${-left}: «Хватит» даст точку ${p.dots+1}/${DOT_LIMIT}`;cls+=' bad';}
else if(left===0){req='🏆 Ровно 1000 — жмите «Хватить»!';cls+=' win';}
else req=`Осталось ${left} ${ptsWord(left)}`;
}
}
$('turnInfo').innerHTML=`<div class="who">Ходит: <b style="color:${PC[p.seat]}">${esc(p.name)}</b>${isMyTurn()?' — это вы':''}</div><div class="${cls}">${req}</div>`;
}
export function btn(cls,text,act){const b=document.createElement('button');b.className='btn '+cls;b.textContent=text;b.dataset.act=act;return b;}
export function renderActions(){
const A=$('actions');A.innerHTML='';
const g=state.room.game,p=state.room.players[g.current];
if(state.room.meta.status==='finished')return;
if(g.phase==='wait'){
A.appendChild(btn('primary','Следующий игрок ➤','advance'));
const h=document.createElement('div');h.className='pickHint';
h.textContent=isMyTurn()?'Ход передастся автоматически…':'Ход передастся автоматически, либо нажмите кнопку';
A.appendChild(h);return;
}
if(!isMyTurn()){
const w=document.createElement('div');w.className='waitNote';
w.textContent=p&&p.online?`Ждём хода ${p.name}…`:`⚠ ${p?p.name:'Игрок'} не в сети`;
A.appendChild(w);
return;
}
if(g.phase==='roll'){
const n=(g.dice||[]).length||5;
const label=(g.hot&&g.turnTotal>0)?'🎲 Обязательный бросок — все 5 кубиков':`🎲 Бросить ${n===5?'5 кубиков':n+' '+kubWord(n)}`;
const b=btn('primary',label,'roll');if(state.animLock)b.classList.add('blocked');A.appendChild(b);
if(isTouch){const h=document.createElement('div');h.className='pickHint';h.textContent='📱 …или встряхните телефон';A.appendChild(h);}
}else if(g.phase==='choose'){
const n=(g.dice||[]).length;
A.appendChild(btn('ghost',`🎲 Бросить ещё (${n} ${kubWord(n)})`,'roll'));
const chk=canBank(),ns=p.score+g.turnTotal;
let label=`💰 Хватит (+${g.turnTotal})`,cls='primary';
if(ns===TARGET){label='🏆 Хватить — ровно 1000!';cls='goldWin';}
else if(ns>TARGET){label=`⚠️ Хватить — будет точка ${p.dots+1}/${DOT_LIMIT}`;cls='danger';}
const b=btn(cls,label,'bank');if(!chk.ok)b.classList.add('blocked');
A.appendChild(b);
if(!chk.ok){const h=document.createElement('div');h.className='pickHint';h.textContent=chk.why;A.appendChild(h);}
if(isTouch){const h=document.createElement('div');h.className='pickHint';h.textContent='📱 Переброс — тоже встряхиванием';A.appendChild(h);}
}
}
import {kubWord} from './util.js';
let lastLogCount=0;
export function renderLog(){
const logBox=$('log'),list=$('logList');
const entries=Object.values(state.room.log||{}).sort((a,b)=>b.ts-a.ts).slice(0,60);
list.innerHTML='';
entries.forEach(e=>{
const d=document.createElement('div');d.className='entry '+(e.k||'');d.textContent=e.t;list.appendChild(d);
});
const total=Object.keys(state.room.log||{}).length;
if(total!==lastLogCount){lastLogCount=total;logBox.scrollTop=0;}
}
export function checkToast(){
const entries=Object.values(state.room.log||{}).sort((a,b)=>a.ts-b.ts);
const last=entries[entries.length-1];
if(!last||last.ts<=state.joinedAt||last.ts<=state.lastToastTs)return;
if(['bad','dot','dump','ovr','win'].includes(last.k)){
toast(last.t,last.k==='win'?'gold':(last.k==='ovr'?'':'bad'));state.lastToastTs=last.ts;
}
}
import {toast} from './util.js';
export function renderWin(){
$('winTitle').textContent=state.room.players[state.room.meta.winner]?.name||'';
$('winRows').innerHTML=state.room.order.map(pid=>state.room.players[pid]).filter(Boolean)
.sort((a,b)=>b.score-a.score)
.map((p,i)=>`<div class="winRow${i===0?' first':''}">
<span class="place">${i+1}</span><span class="pdotBig" style="background:${PC[p.seat]}"></span>${esc(p.name)}
<span class="wscore">${p.score}</span></div>`).join('');
$('btnLobby').hidden=state.room.meta.createdBy!==state.myPid;
}
export function showScreen(name){['auth','join','lobby','game'].forEach(s=>$(s).hidden=(s!==name));}
