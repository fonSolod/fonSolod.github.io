// js/net.js — комнаты: создание, вход, присутствие, подписки, список комнат.
import {db,ref,update,set,get,remove,onValue,onDisconnect,configured} from './config.js';
import {state,ui} from './state.js';
import {toast,uniqueName} from './util.js';
import {playerObj,pushLogIn} from './ledger.js';

export const R=p=>ref(db,`rooms/${state.roomCode}${p?'/'+p:''}`);

// Запись в комнату + автоматическое обновление lastActive (для метки «неактивна»)
export function writeRoom(upd){
console.log('[writeRoom] комната:',state.roomCode,'запись:',JSON.stringify(upd).slice(0,120));
if(state.deleting){console.warn('[writeRoom] пропуск — комната удаляется');return Promise.resolve();}
if(!state.roomCode){console.warn('[writeRoom] пропуск — нет roomCode');return Promise.resolve();}
if(upd.meta&&typeof upd.meta==='object')upd.meta={...upd.meta,lastActive:Date.now()};
else upd['meta/lastActive']=Date.now();
return update(ref(db,`rooms/${state.roomCode}`),upd);
}

const genCode=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=A[Math.floor(Math.random()*A.length)];return s;};
export const validCode=c=>/^[A-Z2-9]{4}$/.test(c||'');
export function getName(){return (state.profile&&state.profile.name)||'Игрок';}
export function copyInvite(){
const link=location.href.split('#')[0]+'#'+state.roomCode;
(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Ссылка скопирована','gold')).catch(()=>toast(link));
}

/* ---------- список комнат (главная страница) ---------- */
let unsubRooms=null;
export function stopRoomsWatch(){if(unsubRooms){unsubRooms();unsubRooms=null;}}
export function startRoomsWatch(){
if(!configured)return;
stopRoomsWatch();
unsubRooms=onValue(ref(db,'rooms'),snap=>{
state.homeRooms=snap.val()||{};
if(ui.renderHome)ui.renderHome();
});
}
export async function deleteCurrentRoom(){
const m=state.room&&state.room.meta;
const iAmCreator=m&&m.createdBy===state.uid;
if(!iAmCreator&&!state.isAdmin)return false;
if(!confirm('Удалить комнату '+state.roomCode+'? Все данные партии будут стёрты, все игроки вернутся к списку.'))return false;
const codeToDelete=state.roomCode;
stopListen();
try{
await remove(ref(db,`rooms/${codeToDelete}`));
localStorage.removeItem('tyscha_last');
localStorage.removeItem('tyscha_pid_'+codeToDelete);
localStorage.removeItem('tyscha_pidowner_'+codeToDelete);
state.roomCode=null;state.room=null;state.isMember=false;
toast('Комната удалена','gold');
return true;
}catch(e){toast('Не удалось удалить комнату','bad');return false;}
}

// Покинуть партию: выбытие с сохранением счёта, автопобеда при 1 игроке, удаление при 0.
// Если партию покидает организатор — роль переходит следующему оставшемуся игроку.
export async function leaveParty(){
if(!state.room||!state.room.game)return false;
const m=state.room.meta,g=state.room.game;
if(m.status==='finished')return false;
if(!confirm('Покинуть партию навсегда?\n\nВы выбудете из игры, вернуться в эту партию будет нельзя. Счёт и имя сохранятся в таблице.'))return false;
const codeToLeave=state.roomCode; // сохраняем ДО обнуления
const oldOrder=[...state.room.order];
const newOrder=oldOrder.filter(uid=>uid!==state.myPid);
const upd={
order:newOrder,
[`players/${state.myPid}/left`]:true,
[`players/${state.myPid}/online`]:false
};
pushLogIn(upd,`⛔ ${state.room.players[state.myPid].name} покинул партию`,'bad');
let newCreator=null;
if(m.createdBy===state.myPid&&newOrder.length>0){
const orgIdx=oldOrder.indexOf(state.myPid);
for(let k=1;k<=oldOrder.length;k++){
const cand=oldOrder[(orgIdx+k)%oldOrder.length];
if(newOrder.includes(cand)){newCreator=cand;break;}
}
if(newCreator)pushLogIn(upd,`👑 ${state.room.players[newCreator].name} становится организатором`,'turn');
}
stopListen();
try{
if(newOrder.length===0){
await remove(ref(db,`rooms/${state.roomCode}`));
toast('Все игроки покинули партию — комната удалена','gold');
}else if(newOrder.length===1){
const winner=newOrder[0];
upd.meta={...m,status:'finished',winner,createdBy:newCreator||winner};
upd.game={seq:(g.seq||0)+1,phase:'over',dice:[],tray:[],turnTotal:0,winner};
pushLogIn(upd,`🏆 ${state.room.players[winner].name} побеждает: все соперники покинули партию`,'win');
await update(ref(db,`rooms/${state.roomCode}`),upd);
toast('Партия завершена','gold');
}else{
if(newCreator)upd.meta={...m,createdBy:newCreator};
if(g.current===state.myPid){
const oldIdx=oldOrder.indexOf(state.myPid);
let next=null;
for(let k=1;k<=oldOrder.length;k++){
const cand=oldOrder[(oldIdx+k)%oldOrder.length];
if(newOrder.includes(cand)){next=cand;break;}
}
if(next){
upd.game={seq:(g.seq||0)+1,current:next,phase:'roll',dice:[],tray:[],turnTotal:0,
startScore:state.room.players[next].score,hot:false,busted:false,waitTs:0};
pushLogIn(upd,`— Ход: ${state.room.players[next].name} —`,'turn');
}
}
await update(ref(db,`rooms/${state.roomCode}`),upd);
}
// очищаем localStorage ПОСЛЕ успешной записи
localStorage.removeItem('tyscha_last');
localStorage.removeItem('tyscha_pid_'+codeToLeave);
localStorage.removeItem('tyscha_pidowner_'+codeToLeave);
state.roomCode=null;state.room=null;state.isMember=false;
return true;
}catch(e){toast('Не удалось покинуть партию','bad');return false;}
}

/* ---------- создание и вход ---------- */
export async function createRoom(opts={}){
const name=getName();let code=genCode();
for(let i=0;i<5;i++){const s=await get(ref(db,`rooms/${code}`));if(!s.exists())break;code=genCode();}
state.roomCode=code;state.myPid=state.uid;state.isMember=true;
localStorage.setItem('tyscha_pid_'+code,state.myPid);
localStorage.setItem('tyscha_pidowner_'+code,state.uid);
localStorage.setItem('tyscha_last',code);
await set(ref(db,`rooms/${code}`),{
meta:{status:'lobby',createdAt:Date.now(),createdBy:state.myPid,
hidden:!!opts.hidden,allowSpectators:opts.allowSpectators!==false,lastActive:Date.now()},
order:[state.myPid],
players:{[state.myPid]:playerObj(name,0)}
});
setupPresence();listen();history.replaceState(null,'',location.pathname+location.search);
}
export async function joinRoom(code){
const s=await get(ref(db,`rooms/${code}`));
if(!s.exists()){toast('Комната не найдена','warn');return;}
const data=s.val();state.roomCode=code;
const me=data.players&&data.players[state.uid];
const saved=localStorage.getItem('tyscha_pid_'+code);
const owner=localStorage.getItem('tyscha_pidowner_'+code);
const legacyActive=saved&&(!owner||owner===state.uid)&&data.players&&data.players[saved]&&!data.players[saved].left;
if((me&&!me.left)||legacyActive){
// активный игрок — просто возвращаемся в комнату
state.myPid=(me&&!me.left)?state.uid:saved;
state.isMember=true;
}else{
// не участвуем: входим игроком в лобби (в т.ч. ПОВТОРНО после «Покинуть партию»)
// или наблюдателем в идущую/завершённую партию
const activeCount=(data.order||[]).length;
if(data.meta.status==='lobby'&&activeCount>=4){toast('Комната заполнена','warn');state.roomCode=null;return;}
state.myPid=state.uid;
state.isMember=(data.meta.status==='lobby');
if(!state.isMember&&data.meta.allowSpectators===false){
toast('Организатор запретил наблюдателей в этой комнате','warn');state.roomCode=null;return;
}
localStorage.setItem('tyscha_pid_'+code,state.myPid);
localStorage.setItem('tyscha_pidowner_'+code,state.uid);
if(state.isMember){
const ordLen=(data.order||[]).length;
const others={...data.players};delete others[state.uid]; // своя старая запись не мешает дедупликации имени
await update(ref(db,`rooms/${code}`),{
[`players/${state.myPid}`]:playerObj(uniqueName(getName(),others),ordLen),
[`order/${ordLen}`]:state.myPid,
'meta/lastActive':Date.now()
});
}else toast('Игра уже идёт — вы наблюдатель','warn');
}
localStorage.setItem('tyscha_last',code);
setupPresence();listen();history.replaceState(null,'',location.pathname+location.search);
}

/* ---------- присутствие и подписка на комнату ---------- */
let unsubRoom=null,unsubConn=null;
export function setupPresence(){
if(!state.isMember)return;
if(unsubConn){unsubConn();unsubConn=null;}
const code=state.roomCode,pid=state.myPid;
if(!code||!pid)return;
const on=ref(db,`rooms/${code}/players/${pid}/online`);
unsubConn=onValue(ref(db,'.info/connected'),s=>{
if(s.val()===true){
// двойная защита: не пишем, если комната уже удалена, мы вышли или не участник
if(state.roomCode!==code||!state.isMember){
console.warn('[setupPresence] пропуск — не участник комнаты');
return;
}
onDisconnect(on).set(false);
set(on,true);
}
});
}
export function stopListen(){
if(unsubRoom){unsubRoom();unsubRoom=null;}
if(unsubConn){unsubConn();unsubConn=null;}
}
export function listen(){
stopListen();
unsubRoom=onValue(ref(db,`rooms/${state.roomCode}`),snap=>{
const data=snap.val();
if(!data){
// комната удалена
state.room=null;
state.roomCode=null;
state.isMember=false;
if(ui.onSnapshot)ui.onSnapshot(null);
toast('Комната удалена','warn');
setTimeout(()=>{stopListen();},0);
return;
}
// защита: если мы вышли из комнаты (left===true), отписываемся и очищаем state
const me=data.players&&data.players[state.myPid];
if(me&&me.left===true){
console.warn('[listen] игрок вышел из комнаты, отписываюсь');
state.room=null;
state.roomCode=null;
state.isMember=false;
if(ui.onSnapshot)ui.onSnapshot(null);
setTimeout(()=>{stopListen();},0);
return;
}
const prev=state.room;state.room=data;
if(ui.onSnapshot)ui.onSnapshot(prev);
});
}

/* ---------- авто-вход по ссылке / последней комнате ---------- */
export async function autoJoin(){
if(!configured||!state.uid)return false;
const hash=location.hash.slice(1).toUpperCase();
const code=validCode(hash)?hash:localStorage.getItem('tyscha_last');
if(!code)return false;
const s=await get(ref(db,`rooms/${code}`));
if(!s.exists())return false;
const data=s.val();
const saved=localStorage.getItem('tyscha_pid_'+code);
const owner=localStorage.getItem('tyscha_pidowner_'+code);
const iAmActive=data.players&&(
(data.players[state.uid]&&!data.players[state.uid].left)||
(saved&&(!owner||owner===state.uid)&&data.players[saved]&&!data.players[saved].left)
);
if(iAmActive){await joinRoom(code);return true;}
if(validCode(hash)){
const ci=document.getElementById('codeInput');if(ci)ci.value=hash;
toast(`Комната ${hash} найдена — нажмите «Войти»`,'gold');
}
return false;
}
