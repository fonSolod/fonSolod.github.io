// js/main.js — точка входа: авторизация, связывание модулей, запуск
import {configured} from './config.js';
import {state,ui} from './state.js';
import {$,toast} from './util.js';
import * as render from './render.js';
import * as actions from './actions.js';
import * as net from './net.js';
import * as notify from './notify.js';
import * as authM from './auth.js';
import * as home from './home.js';
import * as sound from './sound.js';

ui.onSnapshot=(prev)=>{
try{notify.handleTurnChange(prev);}catch(e){console.error('onSnapshot/handleTurnChange:',e);}
try{render.checkToast();}catch(e){console.error('onSnapshot/checkToast:',e);}
try{render.renderScreen(prev);}catch(e){console.error('onSnapshot/renderScreen:',e);}
try{actions.scheduleAutoAdvance();}catch(e){console.error('onSnapshot/scheduleAutoAdvance:',e);}
try{actions.updateSettingsMenu();}catch(e){console.error('onSnapshot/updateSettingsMenu:',e);}
};
ui.renderActions=render.renderActions;
ui.renderHome=home.renderHome;

if(!configured){
$('authCard').hidden=true;
$('cfgWarn').hidden=false;
}

/* ---------- экран авторизации ---------- */
let authMode='login';
function setAuthMode(m){
authMode=m;
$('tabLogin').classList.toggle('on',m==='login');
$('tabReg').classList.toggle('on',m==='reg');
$('regExtra').hidden=(m!=='reg');
$('forgotBtn').hidden=(m!=='login');
$('authSubmit').textContent=m==='reg'?'Зарегистрироваться':'Войти';
$('authErr').hidden=true;
}
function showAuthErr(msg,ok){const e=$('authErr');e.hidden=false;e.textContent=msg;e.classList.toggle('ok',!!ok);}
function setAuthBusy(b){$('authSubmit').disabled=b;$('authSubmit').style.opacity=b?.6:1;}
$('tabLogin').onclick=()=>setAuthMode('login');
$('tabReg').onclick=()=>setAuthMode('reg');
$('authSubmit').onclick=async()=>{
const login=$('authLogin').value.trim();
const pass=$('authPass').value;
$('authErr').hidden=true;
if(!login){showAuthErr('Укажите e-mail или ник');return;}
setAuthBusy(true);
try{
if(authMode==='reg'){
if(pass.length<6)throw new Error('Пароль: минимум 6 символов');
if(pass!==$('authPass2').value)throw new Error('Пароли не совпадают');
if(!authM.isEmailLike(login)){
if(!authM.isValidNick(login))throw new Error('Ник: 3–16 символов — буквы, цифры, «_» или «-», без пробелов');
const tech=await authM.nickToTechEmail(login);
const ok=confirm('«'+login+'» не похож на e-mail.\n\nВосстановление пароля будет недоступно.\nЛогин сохранится как ник (технический адрес: '+tech+').\n\nПродолжить регистрацию без почты?');
if(!ok){setAuthBusy(false);return;}
}
await authM.register({login,password:pass,name:$('authName').value});
}else{
await authM.login({login,password:pass});
}
}catch(e){showAuthErr(authM.authErrorMsg(e));}
setAuthBusy(false);
};
$('forgotBtn').onclick=async()=>{
const login=$('authLogin').value.trim();
if(!authM.isEmailLike(login)){showAuthErr('Восстановление пароля — только для регистрации по e-mail');return;}
try{await authM.resetPassword(login);showAuthErr('Письмо для сброса пароля отправлено на '+login,true);}
catch(e){showAuthErr(authM.authErrorMsg(e));}
};

function updateSettingsMenu(){
if(!$('settingsMenu'))return;
const notifOn=(typeof notify.notifGranted==='function')?notify.notifGranted():false;
if($('smNotify'))$('smNotify').textContent=notifOn?'🔔 Уведомления: вкл':'🔕 Уведомления: выкл';
if($('smSound'))$('smSound').textContent=state.soundOn?'🔊 Звук: вкл':'🔇 Звук: выкл';
if($('smLeaveParty'))$('smLeaveParty').hidden=!(state.isMember&&state.room&&state.room.meta&&state.room.meta.status==='playing');
if($('smDeleteRoom')){
const iAmCreator=state.room&&state.room.meta&&state.room.meta.createdBy===state.myPid;
$('smDeleteRoom').hidden=!(iAmCreator||state.isAdmin);
}
}

/* ---------- сессия ---------- */
authM.watchAuth(async user=>{
if(user){
state.uid=user.uid;
state.profile=(await authM.loadProfile(user.uid))||{name:(user.email||'Игрок').split('@')[0]};
state.isAdmin=state.profile.isAdmin===true;
$('homeWho').textContent='Вы вошли как '+state.profile.name+(state.isAdmin?' 👑':'');
$('accountChip').textContent='👤 '+state.profile.name;
render.showScreen('home');
net.startRoomsWatch();
net.autoJoin();
}else{
net.stopListen();
net.stopRoomsWatch();
state.uid=null;state.profile=null;state.isAdmin=false;
state.roomCode=null;state.room=null;state.homeRooms={};
$('winOverlay').hidden=true;
render.showScreen('auth');
}
});
const doLogout=()=>authM.logout();
if($('btnLogout'))$('btnLogout').onclick=doLogout;
if($('homeLogout'))$('homeLogout').onclick=doLogout;
if($('lobbyLogout'))$('lobbyLogout').onclick=doLogout;

/* ---------- главная страница ---------- */
$('showCreateBtn').onclick=()=>{$('createPanel').hidden=!$('createPanel').hidden;};
$('doCreateBtn').onclick=()=>{
notify.requestNotif();
net.createRoom({hidden:$('optHidden').checked,allowSpectators:$('optSpectators').checked});
};
$('joinBtn').onclick=()=>{notify.requestNotif();const c=$('codeInput').value.trim().toUpperCase();if(net.validCode(c))net.joinRoom(c);else toast('Введите код из 4 символов','warn');};
$('roomFilter').oninput=()=>{state.homeFilter=$('roomFilter').value;home.renderHome();};

/* ---------- статические кнопки ---------- */
$('leaveBtn').onclick=()=>{net.stopListen();state.roomCode=null;state.room=null;render.showScreen('home');};
$('codeChip').onclick=net.copyInvite;
$('copyLink').onclick=net.copyInvite;
$('modalClose').onclick=()=>$('modal').hidden=true;
$('modal').onclick=e=>{if(e.target.id==='modal')$('modal').hidden=true;};
$('startGameBtn').onclick=actions.startGame;
$('btnLobby').onclick=actions.returnToLobby;
$('lobbyDeleteBtn').onclick=async()=>{if(await net.deleteCurrentRoom())render.showScreen('home');};
$('btnNewGame').onclick=()=>actions.newGameSamePlayers();
$('btnDeleteRoomWin').onclick=async()=>{if(await net.deleteCurrentRoom())render.showScreen('home');};
$('btnHomeFromWin').onclick=()=>{net.stopListen();state.roomCode=null;state.room=null;$('winOverlay').hidden=true;render.showScreen('home');};

/* ---------- меню настроек ---------- */
if($('btnSettings')){
$('btnSettings').onclick=(e)=>{
e.stopPropagation();
updateSettingsMenu();
$('settingsMenu').hidden=!$('settingsMenu').hidden;
};
}
document.addEventListener('click',e=>{
const m=$('settingsMenu');
if(m&&!m.hidden&&!m.contains(e.target))m.hidden=true;
});
if($('smNotify'))$('smNotify').onclick=()=>{notify.notifyToggle();updateSettingsMenu();};
if($('smSound'))$('smSound').onclick=()=>{state.soundOn=!state.soundOn;updateSettingsMenu();};
if($('smRules'))$('smRules').onclick=()=>{$('modal').hidden=false;$('settingsMenu').hidden=true;};
if($('smDeleteRoom'))$('smDeleteRoom').onclick=async()=>{$('settingsMenu').hidden=true;if(await net.deleteCurrentRoom())render.showScreen('home');};
if($('smLeaveParty'))$('smLeaveParty').onclick=async()=>{$('settingsMenu').hidden=true;if(await net.leaveParty())render.showScreen('home');};
if($('smLeaveGame'))$('smLeaveGame').onclick=()=>{net.stopListen();state.roomCode=null;state.room=null;$('winOverlay').hidden=true;render.showScreen('home');};
if($('smLogout'))$('smLogout').onclick=()=>authM.logout();

/* ---------- раскрывающиеся панели ---------- */
function wireCollapsible(toggleId,panelId){
const t=$(toggleId),p=$(panelId);
if(!t||!p)return;
t.onclick=()=>p.classList.toggle('closed');
}
wireCollapsible('scoreToggle','scorePanel');
wireCollapsible('logToggle','logPanel');


/* ---------- делегирование динамических кнопок ---------- */
const actMap={roll:actions.doRoll,bank:actions.bank,advance:actions.advanceTurn,
enter:(el)=>net.joinRoom(el.dataset.code),
delroom:(el)=>net.deleteRoom(el.dataset.code)};
document.addEventListener('click',e=>{
const el=e.target.closest('[data-act]');
if(!el)return;
const fn=actMap[el.dataset.act];
if(fn)fn(el);
});

/* ---------- глобальные слушатели ---------- */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)notify.stopBlink();});
document.addEventListener('pointerdown',()=>{actions.enableShake();sound.initAudioOnGesture();},{once:true});
document.addEventListener('keydown',()=>sound.initAudioOnGesture(),{once:true});

/* ---------- запуск ---------- */
notify.initServiceWorker();
notify.updateNotifIcon();
