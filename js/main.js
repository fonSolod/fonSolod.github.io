// Точка входа: авторизация, связывание модулей, запуск
import {configured} from './config.js';
import {state,ui} from './state.js';
import {$,toast} from './util.js';
import * as render from './render.js';
import * as actions from './actions.js';
import * as net from './net.js';
import * as notify from './notify.js';
import * as authM from './auth.js';

ui.onSnapshot=(prev)=>{
notify.handleTurnChange(prev);
render.checkToast();
render.renderScreen(prev);
actions.scheduleAutoAdvance();
};
ui.renderActions=render.renderActions;

if(!configured){
$('authCard').hidden=true;$('joinCard').hidden=true;$('cfgWarn').hidden=false;
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

/* ---------- сессия ---------- */
authM.watchAuth(async user=>{
if(user){
state.uid=user.uid;
state.profile=(await authM.loadProfile(user.uid))||{name:(user.email||'Игрок').split('@')[0]};
$('joinWho').textContent='Вы вошли как '+state.profile.name;
$('accountChip').textContent='👤 '+state.profile.name;
render.showScreen('join');
net.autoJoin();
}else{
net.stopListen();
state.uid=null;state.profile=null;state.roomCode=null;state.room=null;
$('winOverlay').hidden=true;
render.showScreen('auth');
}
});
$('btnLogout').onclick=()=>authM.logout();
$('joinLogout').onclick=()=>authM.logout();
$('lobbyLogout').onclick=()=>authM.logout();

/* ---------- статические кнопки ---------- */
$('createBtn').onclick=()=>{notify.requestNotif();net.createRoom();};
$('joinBtn').onclick=()=>{notify.requestNotif();const c=$('codeInput').value.trim().toUpperCase();if(net.validCode(c))net.joinRoom(c);else toast('Введите код из 4 символов','warn');};
$('codeChip').onclick=net.copyInvite;
$('copyLink').onclick=net.copyInvite;
$('leaveBtn').onclick=()=>{net.stopListen();state.roomCode=null;state.room=null;render.showScreen('join');};
$('btnLeaveGame').onclick=()=>{net.stopListen();state.roomCode=null;state.room=null;$('winOverlay').hidden=true;render.showScreen('join');};
$('btnRules').onclick=()=>$('modal').hidden=false;
$('modalClose').onclick=()=>$('modal').hidden=true;
$('modal').onclick=e=>{if(e.target.id==='modal')$('modal').hidden=true;};
$('btnSound').onclick=()=>{state.soundOn=!state.soundOn;$('btnSound').textContent=state.soundOn?'🔊':'🔇';};
$('btnNotify').onclick=notify.notifyToggle;
$('startGameBtn').onclick=actions.startGame;
$('btnLobby').onclick=actions.returnToLobby;

/* ---------- делегирование динамических кнопок ---------- */
const actMap={roll:actions.doRoll,bank:actions.bank,advance:actions.advanceTurn};
document.addEventListener('click',e=>{
const el=e.target.closest('[data-act]');
if(!el)return;
const fn=actMap[el.dataset.act];
if(fn)fn();
});

/* ---------- глобальные слушатели ---------- */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)notify.stopBlink();});
document.addEventListener('pointerdown',()=>actions.enableShake(),{once:true});

/* ---------- запуск ---------- */
notify.initServiceWorker();
notify.updateNotifIcon();
