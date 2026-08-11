// Точка входа: связывает модули, вешает обработчики, запускает авто-вход.
import {configured} from './config.js';
import {state,ui} from './state.js';
import {$,toast} from './util.js';
import * as render from './render.js';
import * as actions from './actions.js';
import * as net from './net.js';
import * as notify from './notify.js';

// Реакция на каждое обновление комнаты из Firebase.
ui.onSnapshot=(prev)=>{
notify.handleTurnChange(prev);
render.checkToast();
render.renderScreen(prev);
actions.scheduleAutoAdvance();
};
// Действия могут перерисовать панель кнопок без импорта render.
ui.renderActions=render.renderActions;

if(!configured){$('joinCard').hidden=true;$('cfgWarn').hidden=false;}

// Статические кнопки.
$('createBtn').onclick=()=>{notify.requestNotif();net.createRoom();};
$('joinBtn').onclick=()=>{notify.requestNotif();const c=$('codeInput').value.trim().toUpperCase();if(net.validCode(c))net.joinRoom(c);else toast('Введите код из 4 символов','warn');};
$('codeChip').onclick=net.copyInvite;
$('copyLink').onclick=net.copyInvite;
$('leaveBtn').onclick=()=>{state.roomCode=null;state.room=null;render.showScreen('join');};
$('btnLeaveGame').onclick=()=>{state.roomCode=null;state.room=null;$('winOverlay').hidden=true;render.showScreen('join');};
$('btnRules').onclick=()=>$('modal').hidden=false;
$('modalClose').onclick=()=>$('modal').hidden=true;
$('modal').onclick=e=>{if(e.target.id==='modal')$('modal').hidden=true;};
$('btnSound').onclick=()=>{state.soundOn=!state.soundOn;$('btnSound').textContent=state.soundOn?'🔊':'🔇';};
$('btnNotify').onclick=notify.notifyToggle;
$('startGameBtn').onclick=actions.startGame;
$('btnLobby').onclick=actions.returnToLobby;
$('nameInput').value=localStorage.getItem('tyscha_name')||'';

// Динамические кнопки рендера — через делегирование по data-act.
const actMap={roll:actions.doRoll,bank:actions.bank,advance:actions.advanceTurn};
document.addEventListener('click',e=>{
const el=e.target.closest('[data-act]');
if(!el)return;
const fn=actMap[el.dataset.act];
if(fn)fn();
});

// Глобальные слушатели.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)notify.stopBlink();});
document.addEventListener('pointerdown',()=>actions.enableShake(),{once:true});

// Запуск.
notify.initServiceWorker();
notify.updateNotifIcon();
net.autoJoin();