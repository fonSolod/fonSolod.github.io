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
try{updateSettingsMenu();}catch(e){console.error('onSnapshot/updateSettingsMenu:',e);}
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
$('loginFields').hidden=(m!=='login');
$('regTop').hidden=(m!=='reg');
$('regBottom').hidden=(m!=='reg');
$('forgotBtn').hidden=(m!=='login');
$('authSubmit').textContent=m==='reg'?'Зарегистрироваться':'Войти';
$('authErr').hidden=true;
}
function showAuthErr(msg,ok){const e=$('authErr');e.hidden=false;e.textContent=msg;e.classList.toggle('ok',!!ok);}
function setAuthBusy(b){$('authSubmit').disabled=b;$('authSubmit').style.opacity=b?.6:1;}
$('tabLogin').onclick=()=>setAuthMode('login');
$('tabReg').onclick=()=>setAuthMode('reg');
$('authSubmit').onclick=async()=>{
$('authErr').hidden=true;
const pass=$('authPass').value;
setAuthBusy(true);
try{
if(authMode==='reg'){
const nick=$('authNick').value.trim();
const email=$('authEmail').value.trim();
if(!nick)throw new Error('Укажите ник');
if(pass.length<6)throw new Error('Пароль: минимум 6 символов');
if(pass!==$('authPass2').value)throw new Error('Пароли не совпадают');
if(email&&!authM.isEmailLike(email))throw new Error('Некорректный e-mail');
await authM.register({nick,email,password:pass});
}else{
const login=$('authLogin').value.trim();
if(!login)throw new Error('Укажите e-mail или ник');
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
const notifOn=(typeof notify.notifActive==='function')?notify.notifActive():false;
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

/* ---------- аккаунт ---------- */
function openProfile(){
const p=state.profile||{};
$('profNick').textContent=p.nick||'—';
$('profEmail').textContent=p.email||'не привязан';
$('profName').value=p.name||'';
const hasEmail=!!p.email;
$('emailLabel').textContent=hasEmail?'Сменить e-mail':'Привязать e-mail';
$('saveEmailBtn').textContent=hasEmail?'Сменить e-mail':'Привязать e-mail';
if($('profNickPass'))$('profNickPass').hidden=hasEmail;
$('profileModal').hidden=false;
}
function closeProfile(){$('profileModal').hidden=true;}
if($('homeProfileBtn'))$('homeProfileBtn').onclick=openProfile;
if($('homeWho'))$('homeWho').onclick=openProfile;
if($('profileClose'))$('profileClose').onclick=closeProfile;
if($('profileModal'))$('profileModal').onclick=e=>{if(e.target.id==='profileModal')closeProfile();};

$('saveNameBtn').onclick=async()=>{
const name=$('profName').value.trim();
if(!name){toast('Имя не может быть пустым','warn');return;}
try{
await authM.updateGameName(name);
state.profile.name=name;
$('homeWho').textContent='Вы вошли как '+name+(state.isAdmin?' 👑':'');
if($('accountChip'))$('accountChip').textContent='👤 '+name;
toast('Имя сохранено','gold');
}catch(e){toast(authM.authErrorMsg(e),'bad');}
};

$('savePassBtn').onclick=async()=>{
const cur=$('profCurPass').value,np=$('profPass').value,np2=$('profPass2').value;
if(!cur){toast('Введите текущий пароль','warn');return;}
if(np.length<6){toast('Новый пароль: минимум 6 символов','warn');return;}
if(np!==np2){toast('Пароли не совпадают','warn');return;}
try{
await authM.changePassword(cur,np);
$('profCurPass').value=$('profPass').value=$('profPass2').value='';
toast('Пароль изменён','gold');
}catch(e){toast(authM.authErrorMsg(e),'bad');}
};

$('saveEmailBtn').onclick=async()=>{
const em=$('profEmailInput').value.trim();
const pass=$('profEmailPass').value;
if(!authM.isEmailLike(em)){toast('Некорректный e-mail','warn');return;}
if(!pass){toast('Введите пароль для подтверждения','warn');return;}
try{
await authM.changeEmail(em,pass);
state.profile.email=em;
$('profEmail').textContent=em;
$('emailLabel').textContent='Сменить e-mail';
$('saveEmailBtn').textContent='Сменить e-mail';
if($('profNickPass'))$('profNickPass').hidden=true;
$('profEmailInput').value='';$('profEmailPass').value='';
toast('E-mail сохранён','gold');
}catch(e){toast(authM.authErrorMsg(e),'bad');}
};

$('saveNickBtn').onclick=async()=>{
const nn=$('profNickInput').value.trim();
const pass=$('profNickPass').value;
if(!nn){toast('Введите новый ник','warn');return;}
if(!authM.isValidNick(nn)){toast('Ник: 3–16 символов — буквы, цифры, «_» или «-»','warn');return;}
if(!(state.profile&&state.profile.email)&&!pass){toast('Введите пароль для подтверждения','warn');return;}
try{
await authM.changeNick(nn,pass);
state.profile.nick=nn;
$('profNick').textContent=nn;
$('profNickInput').value='';$('profNickPass').value='';
toast('Ник изменён — вход по новому нику','gold');
}catch(e){toast(authM.authErrorMsg(e),'bad');}
};

$('deleteAccountBtn').onclick=async()=>{
const pass=$('profDelPass').value;
if(!pass){toast('Введите пароль для подтверждения','warn');return;}
if(!confirm('Удалить аккаунт навсегда?\n\nПрофиль будет удалён, участие в комнатах останется в истории.'))return;
try{
await authM.deleteAccount(pass);
// выход произойдёт автоматически (watchAuth → экран входа)
}catch(e){toast(authM.authErrorMsg(e),'bad');}
};

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
if($('smNotify'))$('smNotify').onclick=async()=>{await notify.notifyToggle();updateSettingsMenu();};
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
