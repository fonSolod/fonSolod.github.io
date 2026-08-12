// js/state.js — общее изменяемое состояние.
// Все модули читают и пишут через этот объект. Сам объект НЕ заменяется.

export const state={
// аккаунт (Firebase Auth)
uid:null,
profile:null,        // профиль из users/{uid}
isAdmin:false,       // users/{uid}/isAdmin === true

// главная страница (список комнат)
homeRooms:{},        // снапшот всех комнат: {КОД: {meta, players, order, ...}}
homeFilter:'',       // фильтр по коду

// комната и игрок
roomCode:null,
myPid:null,
room:null,
isMember:false,

// служебные флаги
animLock:false,
advTimer:null,
lastToastTs:0,
lastLogCount:0,
soundOn:true,
joinedAt:Date.now(),
};

// Слоты для функций из других модулей. Заполняются в main.js.
export const ui={
onSnapshot:null,    // (prev)=>void — обновление комнаты из Firebase
renderActions:null, // ()=>void     — перерисовать панель действий
renderHome:null,    // ()=>void     — перерисовать список комнат
};

export const isMyTurn=()=>!!(state.room&&state.room.game&&state.room.game.current===state.myPid);
