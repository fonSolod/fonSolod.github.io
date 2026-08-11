// Комнаты: создание, вход, присутствие, подписка на обновления.
import {db,ref,update,set,get,onValue,onDisconnect,configured} from './config.js';
import {state,ui} from './state.js';
import {toast,uniqueName} from './util.js';
import {playerObj} from './ledger.js';
export const R=p=>ref(db,`rooms/${state.roomCode}${p?'/'+p:''}`);
export function writeRoom(upd){return update(ref(db,`rooms/${state.roomCode}`),upd);}
const genPid=()=>'p'+Math.random().toString(36).slice(2,10);
const genCode=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=A[Math.floor(Math.random()*A.length)];return s;};
export const validCode=c=>/^[A-Z2-9]{4}$/.test(c||'');
export function getName(){const n=document.getElementById('nameInput').value.trim()||'Игрок';localStorage.setItem('tyscha_name',n);return n;}
export function copyInvite(){const link=location.href.split('#')[0]+'#'+state.roomCode;
(navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast('Ссылка скопирована','gold')).catch(()=>toast(link));}
export async function createRoom(){
const name=getName();let code=genCode();
for(let i=0;i<5;i++){const s=await get(ref(db,`rooms/${code}`));if(!s.exists())break;code=genCode();}
state.roomCode=code;state.myPid=genPid();state.isMember=true;
localStorage.setItem('tyscha_pid_'+code,state.myPid);localStorage.setItem('tyscha_last',code);
await set(ref(db,`rooms/${code}`),{meta:{status:'lobby',createdAt:Date.now(),createdBy:state.myPid},order:[state.myPid],players:{[state.myPid]:playerObj(name,0)}});
setupPresence();listen();history.replaceState(null,'','#'+code);
}
export async function joinRoom(code){
const s=await get(ref(db,`rooms/${code}`));
if(!s.exists()){toast('Комната не найдена','warn');return;}
const data=s.val();state.roomCode=code;
const saved=localStorage.getItem('tyscha_pid_'+code);
if(saved&&data.players&&data.players[saved]){state.myPid=saved;state.isMember=true;}
else{
const pids=Object.keys(data.players||{});
if(data.meta.status==='lobby'&&pids.length>=4){toast('Комната заполнена','warn');state.roomCode=null;return;}
state.myPid=genPid();state.isMember=(data.meta.status==='lobby');
localStorage.setItem('tyscha_pid_'+code,state.myPid);
if(state.isMember){
await update(ref(db,`rooms/${code}`),{[`players/${state.myPid}`]:playerObj(uniqueName(getName(),data.players),pids.length),[`order/${pids.length}`]:state.myPid});
}else toast('Игра уже идёт — вы наблюдатель','warn');
}
localStorage.setItem('tyscha_last',code);
setupPresence();listen();history.replaceState(null,'','#'+code);
}
export function setupPresence(){
if(!state.isMember)return;
const on=ref(db,`rooms/${state.roomCode}/players/${state.myPid}/online`);
onValue(ref(db,'.info/connected'),s=>{if(s.val()===true){onDisconnect(on).set(false);set(on,true);}});
}
export function listen(){
onValue(ref(db,`rooms/${state.roomCode}`),snap=>{
const data=snap.val();
if(!data){state.room=null;if(ui.onSnapshot)ui.onSnapshot(null);toast('Комната удалена','warn');return;}
const prev=state.room;state.room=data;
if(ui.onSnapshot)ui.onSnapshot(prev);
});
}
export async function autoJoin(){
if(!configured)return;
const hash=location.hash.slice(1).toUpperCase();
const code=validCode(hash)?hash:localStorage.getItem('tyscha_last');
if(!code)return;
const s=await get(ref(db,`rooms/${code}`));
if(!s.exists())return;
const saved=localStorage.getItem('tyscha_pid_'+code);
if(saved&&s.val().players&&s.val().players[saved]){joinRoom(code);return;}
if(validCode(hash)){
document.getElementById('codeInput').value=hash;
document.getElementById('nameInput').focus();
toast(`Комната ${hash} найдена — введите имя и нажмите «Войти»`,'gold');
}
}