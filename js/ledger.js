// Журнал записей очков и правила точка/болт/бочка/самосвал.
import {state} from './state.js';
import {getBarrel,SAMOSVAL,DOT_LIMIT,BOLT_LIMIT,OPEN_MIN} from './rules.js';
import {ptsWord} from './util.js';
export const projOf=(upd,pid,k)=>(`players/${pid}/${k}` in upd)?upd[`players/${pid}/${k}`]:state.room.players[pid][k];
export function pushLogIn(upd,t,k){upd[`log/l${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`]={t,k,ts:Date.now()};}
export function baseWait(g,pid){return{seq:g.seq+1,current:pid||state.myPid,phase:'wait',dice:[],tray:g.tray||[],turnTotal:0,startScore:g.startScore,hot:false,busted:false,waitTs:Date.now()};}
export function canBank(){
const p=state.room.players[state.room.game.current],g=state.room.game;
if(g.turnTotal<5)return{ok:false,why:'Сначала возьмите очки'};
if(!p.opened&&g.turnTotal<OPEN_MIN)return{ok:false,why:`Вход в игру: нужно не менее ${OPEN_MIN} очков за ход (взято ${g.turnTotal})`};
return{ok:true};
}
export function playerObj(name,seat){return{name,seat,score:0,opened:false,bolts:0,dots:0,zeroStreak:0,inBarrel:null,barrelLeft:null,histMark:null,hist:[],online:true,joinedAt:Date.now()};}
// hist: массив записей {v: счёт, x: зачёркнута}. Текущий счёт = последняя незачёркнутая запись.
export function projHist(upd,pid){
const key=`players/${pid}/hist`;
if(key in upd)return upd[key];
return (state.room.players[pid].hist||[]).map(e=>({...e}));
}
export function lastValidIndex(hist){for(let i=hist.length-1;i>=0;i--){if(!hist[i].x)return i;}return -1;}
export function effScore(hist){const i=lastValidIndex(hist);return i<0?0:hist[i].v;}
export function commitHist(upd,pid,hist){
upd[`players/${pid}/hist`]=hist;
upd[`players/${pid}/score`]=effScore(hist);
}
export function pushScore(upd,pid,v){
const hist=projHist(upd,pid);
hist.push({v});
commitHist(upd,pid,hist);
}
export function crossLast(upd,pid,n){
const hist=projHist(upd,pid);
let toCross=n;
for(let i=hist.length-1;i>=0&&toCross>0;i--){
if(!hist[i].x){hist[i].x=true;toCross--;}
}
commitHist(upd,pid,hist);
return effScore(hist);
}
export function clearBarrelState(upd,pid){
upd[`players/${pid}/inBarrel`]=null;
upd[`players/${pid}/barrelLeft`]=null;
upd[`players/${pid}/histMark`]=null;
}
export function applyDot(upd,pid,reason){
const p=state.room.players[pid];
const dots=projOf(upd,pid,'dots')+1;
if(dots>=DOT_LIMIT){
upd[`players/${pid}/dots`]=0;
const bolts=projOf(upd,pid,'bolts')+1;
if(bolts>=BOLT_LIMIT){
upd[`players/${pid}/bolts`]=0;
upd[`players/${pid}/opened`]=false;
clearBarrelState(upd,pid);
pushScore(upd,pid,0);
return {msg:`${reason} Третья точка — БОЛТ! Это третий болт: ${p.name} теряет все очки.`,cutToBarrel:false};
}
upd[`players/${pid}/bolts`]=bolts;
clearBarrelState(upd,pid);
const newScore=crossLast(upd,pid,3);
if(newScore===0)upd[`players/${pid}/opened`]=false;
const cb=getBarrel(newScore);
return {msg:`${reason} Третья точка — БОЛТ! Последние 3 записи ${p.name} зачёркнуты, счёт: ${newScore} ${ptsWord(newScore)}.${cb?' Срез привёл в бочку — на выход один ход!':''}`,cutToBarrel:!!cb};
}
upd[`players/${pid}/dots`]=dots;
return {msg:`${reason} Точка ${dots}/${DOT_LIMIT}.`,cutToBarrel:false};
}
export function barrelFall(upd,pid){
const hist=projHist(upd,pid);
const mark=projOf(upd,pid,'histMark');
const m=(mark==null||mark<0)?Math.max(0,lastValidIndex(hist)):mark;
for(let i=m;i<hist.length;i++)hist[i].x=true;
clearBarrelState(upd,pid);
commitHist(upd,pid,hist);
const fell=effScore(hist);
if(fell===0)upd[`players/${pid}/opened`]=false;
return fell;
}
export function applyBarrelTick(upd,pid,entryLeft=2){
const p=state.room.players[pid];
const score=projOf(upd,pid,'score');
const barrel=getBarrel(score);
const stored=projOf(upd,pid,'inBarrel');
if(!barrel){
if(stored!=null){
clearBarrelState(upd,pid);
pushLogIn(upd,`🛢 ${p.name} выходит из бочки!`,'bank');
}
return;
}
if(stored==null||stored!==barrel.lo){
upd[`players/${pid}/histMark`]=lastValidIndex(projHist(upd,pid));
upd[`players/${pid}/inBarrel`]=barrel.lo;
upd[`players/${pid}/barrelLeft`]=entryLeft;
pushLogIn(upd,`🛢 ${p.name} попадает в бочку ${barrel.lo}–${barrel.hi}: ${entryLeft===1?'один ход':'2 хода'} на выход!`,'dot');
return;
}
let left=projOf(upd,pid,'barrelLeft')-1;
if(left<=0){
const fell=barrelFall(upd,pid);
pushLogIn(upd,`🛢 ${p.name} не вышел из бочки ${barrel.lo}–${barrel.hi}: записи в бочке зачёркнуты, счёт возвращается на ${fell} ${ptsWord(fell)} (до входа в бочку).`,'bad');
}else{
upd[`players/${pid}/barrelLeft`]=left;
pushLogIn(upd,`🛢 ${p.name} остаётся в бочке: на выход ${left===1?'последний ход':'осталось '+hodWord(left)}`,'dot');
}
}
import {hodWord} from './util.js';
// Зачеркнуть ВСЕ записи игрока (для самосвала)
export function crossAllHist(upd,pid){
const hist=projHist(upd,pid);
hist.forEach(e=>{e.x=true;});
commitHist(upd,pid,hist);
}

// Полный самосвал для одного игрока: зачеркнуть всё, добавить 0, сбросить состояние
export function applySamosvalTo(upd,pid){
crossAllHist(upd,pid);
pushScore(upd,pid,0);
upd[`players/${pid}/opened`]=true;
upd[`players/${pid}/zeroStreak`]=0;
clearBarrelState(upd,pid);
}

// Замените существующую applySamosvalAll на эту:
export function applySamosvalAll(upd){
state.room.order.forEach(pid=>{
const val=projOf(upd,pid,'score');
if(val===SAMOSVAL){
applySamosvalTo(upd,pid);
pushLogIn(upd,`🚛 Самосвал! ${state.room.players[pid].name} обнуляется (было 555)`,'dump');
}
});
}
