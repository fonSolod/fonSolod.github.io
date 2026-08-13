// js/notify.js — уведомления о ходе, мигание заголовка.
import {state} from './state.js';
import {toast} from './util.js';
import {soundTurn} from './sound.js';

let notifReg=null;
export function initServiceWorker(){
if('serviceWorker' in navigator){
navigator.serviceWorker.register('notify-sw.js').then(r=>{notifReg=r;}).catch(e=>console.warn('notify-sw.js не зарегистрирован:',e));
}
}

/* ---------- настройка уведомлений ---------- */
const NOTIF_KEY='tyscha_notif';
// 1) Разрешение браузера: granted / denied / default
export const notifGranted=()=>typeof Notification!=='undefined'&&Notification.permission==='granted';
// 2) Настройка приложения: пользователь включил/выключил (по умолчанию вкл)
export const notifEnabled=()=>localStorage.getItem(NOTIF_KEY)!=='off';
// 3) Итог: уведомляем, только если включено И в приложении, И разрешено браузером
export const notifActive=()=>notifEnabled()&&notifGranted();

// Запрос разрешения при создании/входе в комнату (если ещё не спрашивали)
export function requestNotif(){
if(typeof Notification==='undefined')return;
if(Notification.permission==='default')Notification.requestPermission();
}

// Переключатель: выключает, если включены; включает (с запросом разрешения), если выключены
export async function notifyToggle(){
if(typeof Notification==='undefined'){toast('Браузер не поддерживает уведомления','warn');return;}
// сейчас включены → выключаем (разрешение браузера оставляем, просто перестаём показывать)
if(notifActive()){
localStorage.setItem(NOTIF_KEY,'off');
toast('Уведомления выключены','gold');
return;
}
// сейчас выключены → пробуем включить
if(Notification.permission==='denied'){
toast('Уведомления запрещены в настройках браузера','warn');
return;
}
let perm=Notification.permission;
if(perm==='default')perm=await Notification.requestPermission();
if(perm==='granted'){
localStorage.setItem(NOTIF_KEY,'on');
toast('Уведомления включены 🔔','gold');
}else{
toast('Уведомления отклонены','warn');
}
}

// Оставлено для совместимости (иконка в топбаре, если она есть)
export function updateNotifIcon(){
const b=document.getElementById('btnNotify');
if(b)b.textContent=notifActive()?'🔔':'🔕';
}

export function showTurnNotification(){
const opts={body:'Пора бросать кубики 🎲',tag:'tyscha-turn',requireInteraction:true,data:{url:location.href}};
if(notifReg&&notifReg.showNotification){notifReg.showNotification('Ваш ход в «Тыще»!',opts);return;}
try{new Notification('Ваш ход в «Тыще»!',opts);}catch(e){}
}

let titleTimer=null;
export function blinkTitle(){
if(titleTimer)return;
const base='Тыща · 1000';
let flip=false;
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
if(document.hidden){
blinkTitle();
if(notifActive())showTurnNotification();   // было notifGranted()
}
soundTurn();
}
}catch(e){console.error('handleTurnChange:',e);}
}
