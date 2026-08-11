// Уведомления о ходе и мигание заголовка вкладки.
import {toast} from './util.js';
import {state} from './state.js';
import {soundTurn} from './sound.js';
let notifReg=null;
export function initServiceWorker(){
if('serviceWorker' in navigator){
navigator.serviceWorker.register('notify-sw.js').then(r=>{notifReg=r;}).catch(e=>console.warn('notify-sw.js не зарегистрирован:',e));
}
}
export const notifGranted=()=>typeof Notification!=='undefined'&&Notification.permission==='granted';
export function requestNotif(){
if(typeof Notification==='undefined')return;
if(Notification.permission==='default')Notification.requestPermission().then(updateNotifIcon);
updateNotifIcon();
}
export function updateNotifIcon(){const b=document.getElementById('btnNotify');if(b)b.textContent=notifGranted()?'🔔':'🔕';}
export function notifyToggle(){
if(typeof Notification==='undefined'){toast('Браузер не поддерживает уведомления','warn');return;}
Notification.requestPermission().then(p=>{updateNotifIcon();toast(p==='granted'?'Уведомления включены 🔔':'Уведомления отклонены','gold');});
}
export function showTurnNotification(){
const opts={body:'Пора бросать кубики 🎲',tag:'tyscha-turn',requireInteraction:true,data:{url:location.href}};
if(notifReg&&notifReg.showNotification){notifReg.showNotification('Ваш ход в «Тыще»!',opts);return;}
try{new Notification('Ваш ход в «Тыще»!',opts);}catch(e){}
}
let titleTimer=null;
export function blinkTitle(){
if(titleTimer)return;
const base='Тыща · 1000';let flip=false;
titleTimer=setInterval(()=>{document.title=flip?base:'❗ Ваш ход — Тыща';flip=!flip;},1200);
}
export function stopBlink(){
if(titleTimer){clearInterval(titleTimer);titleTimer=null;document.title='Тыща · 1000 — сетевая игра';}
}
export function handleTurnChange(prev){
try{
const {room,myPid}=state;
if(!room||!room.game||!myPid||room.meta.status!=='playing')return;
const nowCur=room.game.current,prevCur=prev&&prev.game?prev.game.current:null;
if(nowCur===myPid&&prevCur!==myPid){
if(document.hidden){blinkTitle();if(notifGranted())showTurnNotification();}
soundTurn();
}
}catch(e){console.error('handleTurnChange:',e);}
}