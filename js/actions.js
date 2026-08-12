// js/actions.js — игровые действия: бросок, банк, передача хода, встряхивание.
import {state,ui,isMyTurn} from './state.js';
import {rndFace,calcScore,scoringFlags,TARGET,SAMOSVAL,ZERO_STREAK,getBarrel} from './rules.js';
import {baseWait,pushLogIn,pushScore,applyDot,applyBarrelTick,applySamosvalAll,clearBarrelState,crossLast,projHist,lastValidIndex,canBank} from './ledger.js';
import {writeRoom} from './net.js';
import {buildDieEl,setFaceEl} from './render.js';
import {playRollSound} from './sound.js';
import {stopBlink,requestNotif} from './notify.js';
import {$,toast,ptsWord,isTouch} from './util.js';

/* ---------- бросок ---------- */
export function doRoll(){
stopBlink();
if(!isMyTurn()||!(state.room.game.phase==='roll'||state.room.game.phase==='choose')||state.animLock)return;
playRollSound();
const g=state.room.game,n=(g.dice||[]).length||5;
state.animLock=true;if(ui.renderActions)ui.renderActions();
const box=$('diceBox');box.innerHTML='';
const els=[];for(let i=0;i<n;i++){const de=buildDieEl(1,'big');box.appendChild(de);els.push(de);}
els.forEach((el,i)=>{el.classList.add('rolling');el.style.animationDelay=i*70+'ms';});
const iv=setInterval(()=>els.forEach(el=>setFaceEl(el,rndFace())),85);
setTimeout(()=>{
clearInterval(iv);
const faces=Array.from({length:n},rndFace);
els.forEach((el,i)=>{el.classList.remove('rolling');setFaceEl(el,faces[i]);});
setTimeout(()=>finishRoll(faces),260);
},760);
}

function finishRoll(faces){
const g=state.room.game,p=state.room.players[state.myPid];
const pts=calcScore(faces);
const diceObjs=faces.map(f=>({face:f,sel:false,scoring:false}));
const upd={};
if(pts===0){
let entryLeft=2;
if(p.opened){
const streak=(p.zeroStreak||0)+1;
upd[`players/${state.myPid}/zeroStreak`]=streak;
if(streak>=ZERO_STREAK){
upd[`players/${state.myPid}/zeroStreak`]=0;
const r=applyDot(upd,state.myPid,`${p.name}: три нулевых хода подряд!`);
pushLogIn(upd,r.msg+` Очки хода (${g.turnTotal}) сгорают.`,'dot');
entryLeft=r.cutToBarrel?1:2;
}else{
pushLogIn(upd,`⚡ Нулевой ход у ${p.name}! Очки хода (${g.turnTotal}) сгорают. Нулевых ходов подряд: ${streak}/${ZERO_STREAK}.`,'bad');
}
}else{
pushLogIn(upd,`⚡ Нулевой ход у ${p.name}! Очки хода (${g.turnTotal}) сгорают. До входа в игру нулевые ходы не считаются.`,'bad');
}
upd.game={...baseWait(g),dice:diceObjs,busted:true};
applyBarrelTick(upd,state.myPid,entryLeft);
applySamosvalAll(upd);
}else{
const flags=scoringFlags(faces);
const takenF=faces.filter((f,i)=>flags[i]);
const takenPts=calcScore(takenF);
const newTurnTotal=g.turnTotal+takenPts;
const newTray=[...(g.tray||[]),takenF];
const pot=p.score+newTurnTotal;
pushLogIn(upd,`${p.name} бросает [${faces.join(' ')}] → ${pts} ${ptsWord(pts)} (за ход ${newTurnTotal})`,'take');
if(pot===TARGET){
pushScore(upd,state.myPid,TARGET);
upd[`players/${state.myPid}/opened`]=true;
upd[`players/${state.myPid}/zeroStreak`]=0;
upd.meta={...state.room.meta,status:'finished',winner:state.myPid};
upd.game={...g,seq:g.seq+1,phase:'over',dice:[],tray:newTray,turnTotal:newTurnTotal};
pushLogIn(upd,`🏆 ${p.name} набирает ровно 1000 и ПОБЕЖДАЕТ!`,'win');
}else if(pot>TARGET){
const r=applyDot(upd,state.myPid,`${p.name}: перебор ${pot} вместо 1000.`);
pushLogIn(upd,r.msg+' Ход не засчитывается.','dot');
upd.game={...baseWait(g),tray:newTray};
applyBarrelTick(upd,state.myPid,r.cutToBarrel?1:2);
applySamosvalAll(upd);
}else if(pot===SAMOSVAL){
pushScore(upd,state.myPid,0);
upd[`players/${state.myPid}/opened`]=true;
upd[`players/${state.myPid}/zeroStreak`]=0;
clearBarrelState(upd,state.myPid);
pushLogIn(upd,`🚛 Самосвал! ${p.name} набирает 555 — все очки списываются.`,'dump');
upd.game={...baseWait(g),tray:newTray};
}else{
const remain=faces.filter((f,i)=>!flags[i]);
if(remain.length===0){
upd.game={...g,seq:g.seq+1,dice:[],tray:newTray,turnTotal:newTurnTotal,phase:'roll',hot:true};
}else{
upd.game={...g,seq:g.seq+1,dice:remain.map(f=>({face:f,sel:false,scoring:false})),tray:newTray,turnTotal:newTurnTotal,phase:'choose',hot:false};
}
}
}
writeRoom(upd).catch(e=>toast('Ошибка сети','bad')).finally(()=>{state.animLock=false;});
}

/* ---------- банк (хватить) ---------- */
export function bank(){
if(!isMyTurn()||state.room.game.phase!=='choose')return;
const chk=canBank();if(!chk.ok){toast(chk.why,'warn');return;}
const g=state.room.game,p=state.room.players[state.myPid],ns=p.score+g.turnTotal,upd={};
if(ns>TARGET){
const r=applyDot(upd,state.myPid,`${p.name}: перебор ${ns} вместо 1000.`);
pushLogIn(upd,r.msg+' Ход не засчитывается.','dot');
applyBarrelTick(upd,state.myPid,r.cutToBarrel?1:2);
applySamosvalAll(upd);
upd.game=baseWait(g);
writeRoom(upd);return;
}
pushScore(upd,state.myPid,ns);
upd[`players/${state.myPid}/opened`]=true;
upd[`players/${state.myPid}/zeroStreak`]=0;
pushLogIn(upd,`💰 ${p.name} записывает ${g.turnTotal} ${ptsWord(g.turnTotal)} → ${ns}`,'bank');
if(ns===TARGET){
upd.meta={...state.room.meta,status:'finished',winner:state.myPid};
upd.game={...g,seq:g.seq+1,phase:'over'};
pushLogIn(upd,`🏆 ${p.name} набирает ровно 1000 и ПОБЕЖДАЕТ!`,'win');
writeRoom(upd);return;
}
// обгон: обогнанный срезается до СВОЕГО прошлого значения; равный счёт тоже обгон
state.room.order.forEach(pid=>{
if(pid===state.myPid)return;
const o=state.room.players[pid];
if(g.startScore<o.score&&ns>=o.score){
if(o.left)return;
if(getBarrel(o.score)){
pushLogIn(upd,`⚔ ${p.name} обгоняет ${o.name}, но тот в бочке — срез не применяется`,'ovr');
return;
}
const newScore=crossLast(upd,pid,1);
if(newScore===0)upd[`players/${pid}/opened`]=false;
pushLogIn(upd,`⚔ Обгон! ${o.name} срезается до прошлого значения: ${newScore} ${ptsWord(newScore)}`,'ovr');
const cb=getBarrel(newScore);
if(cb){
upd[`players/${pid}/inBarrel`]=cb.lo;
upd[`players/${pid}/barrelLeft`]=2;
upd[`players/${pid}/histMark`]=lastValidIndex(projHist(upd,pid));
pushLogIn(upd,`🛢 ${o.name} после среза попадает в бочку ${cb.lo}–${cb.hi}: 2 хода на выход`,'dot');
}
}
});
applyBarrelTick(upd,state.myPid,2);
applySamosvalAll(upd);
upd.game=baseWait(g);
writeRoom(upd);
}

/* ---------- передача хода ---------- */
export function advanceTurn(){
if(!state.room||!state.room.game||state.room.game.phase!=='wait')return;
const g=state.room.game,o=state.room.order;
const np=o[(o.indexOf(g.current)+1)%o.length],npP=state.room.players[np];
const upd={game:{seq:g.seq+1,current:np,phase:'roll',dice:[],tray:[],turnTotal:0,startScore:npP.score,hot:false,busted:false,waitTs:0}};
pushLogIn(upd,`— Ход: ${npP.name} —`,'turn');
writeRoom(upd);
}
export function scheduleAutoAdvance(){
clearTimeout(state.advTimer);
if(state.room&&state.room.game&&state.room.game.phase==='wait'&&state.room.game.current===state.myPid){
state.advTimer=setTimeout(()=>{if(state.room&&state.room.game&&state.room.game.phase==='wait')advanceTurn();},2200);
}
}

/* ---------- запуск игры ---------- */
function launchGame(){
const upd={meta:{...state.room.meta,status:'playing'}};
state.room.order.forEach(pid=>{
['score','bolts','dots','zeroStreak'].forEach(k=>upd[`players/${pid}/${k}`]=0);
upd[`players/${pid}/opened`]=false;
upd[`players/${pid}/hist`]=null;
upd[`players/${pid}/histMark`]=null;
clearBarrelState(upd,pid);
});
const order=[...state.room.order];
for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
upd.order=order;
const first=order[0];
upd.game={seq:1,current:first,phase:'roll',dice:[],tray:[],turnTotal:0,startScore:0,hot:false,busted:false,waitTs:0};
pushLogIn(upd,'Игра началась! Очередность ходов разыграна жребием. Цель — ровно 1000.','turn');
pushLogIn(upd,`— Ход: ${state.room.players[first].name} —`,'turn');
writeRoom(upd);
}
export function startGame(){
if(state.room.meta.createdBy!==state.myPid||state.room.order.length<2)return;
requestNotif();
launchGame();
}
export function newGameSamePlayers(){
if(state.room.meta.createdBy!==state.myPid)return;
if(state.room.order.length<1)return;
launchGame();
}
export function returnToLobby(){
const {room,myPid}=state;
if(room.meta.createdBy!==myPid)return;
writeRoom({meta:{status:'lobby',createdAt:room.meta.createdAt,createdBy:room.meta.createdBy},game:null,log:null});
}

/* ---------- встряхивание телефона ---------- */
let shakeReady=false,lastMotion={x:null,y:null,z:null},lastShakeAt=0;
const SHAKE_THRESHOLD=18, SHAKE_COOLDOWN=1200;
export function enableShake(){
if(!isTouch||shakeReady)return;
if(typeof DeviceMotionEvent==='undefined')return;
if(typeof DeviceMotionEvent.requestPermission==='function'){
DeviceMotionEvent.requestPermission().then(res=>{
if(res==='granted')attachMotion();
else toast('Встряхивание недоступно: нет доступа к датчикам','warn');
}).catch(()=>{});
}else attachMotion();
}
function attachMotion(){
if(shakeReady)return;
shakeReady=true;
window.addEventListener('devicemotion',onMotion);
}
function onMotion(e){
const a=e.accelerationIncludingGravity;
if(!a||a.x==null)return;
if(lastMotion.x==null){lastMotion={x:a.x,y:a.y,z:a.z};return;}
const change=Math.abs(a.x-lastMotion.x)+Math.abs(a.y-lastMotion.y)+Math.abs(a.z-lastMotion.z);
lastMotion={x:a.x,y:a.y,z:a.z};
const now=Date.now();
if(change>SHAKE_THRESHOLD&&now-lastShakeAt>SHAKE_COOLDOWN){
lastShakeAt=now;shakeRoll();
}
}
function shakeRoll(){
if(!state.room||!state.room.game||state.room.meta.status!=='playing')return;
if(!isMyTurn()||state.animLock)return;
if(state.room.game.phase!=='roll'&&state.room.game.phase!=='choose')return;
if(navigator.vibrate)navigator.vibrate(60);
doRoll();
}
