// Общее изменяемое состояние. Все модули читают/пишут через этот объект.
export const state={
roomCode:null, myPid:null, room:null, isMember:false,
animLock:false, advTimer:null, lastToastTs:0, lastLogCount:0,
soundOn:true, joinedAt:Date.now(),
};
// Слоты для функций из других модулей — чтобы избежать циклических импортов.
// Заполняются в main.js.
export const ui={
onSnapshot:null,    // (prev)=>void  — реакция на обновление из Firebase
renderActions:null, // ()=>void      — перерисовать панель действий
};
export const isMyTurn=()=>!!(state.room&&state.room.game&&state.room.game.current===state.myPid);