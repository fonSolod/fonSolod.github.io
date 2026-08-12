// js/state.js — общее изменяемое состояние.
// Все модули читают и пишут через этот объект. Сам объект НЕ заменяется —
// только его поля, чтобы живые ссылки в других модулях оставались валидными.

export const state={
// аккаунт (Firebase Auth)
uid:null,            // uid текущего аккаунта; null — не залогинен
profile:null,        // профиль из users/{uid}: {name, login, email, createdAt}

// комната и игрок
roomCode:null,       // код текущей комнаты
myPid:null,          // мой игрок в комнате (uid для новых комнат, pid для старых)
room:null,           // последний снапшот комнаты из Firebase
isMember:false,      // true — я игрок, false — наблюдатель

// служебные флаги
animLock:false,      // идёт анимация броска (кнопки блокируются)
advTimer:null,       // таймер автопередачи хода
lastToastTs:0,       // ts последнего показанного тоста (чтобы не дублировать)
lastLogCount:0,      // счётчик записей журнала (для автоскролла)
soundOn:true,        // включён ли звук
joinedAt:Date.now(), // момент подключения (фильтр «своих» тостов)
};

// Слоты для функций из других модулей. Заполняются в main.js.
// Это разрывает циклические импорты: actions не импортирует render напрямую,
// а вызывает ui.renderActions(), который main подставил из render.
export const ui={
onSnapshot:null,    // (prev)=>void — реакция на обновление комнаты из Firebase
renderActions:null, // ()=>void     — перерисовать панель действий
};

// Мой ли сейчас ход?
export const isMyTurn=()=>!!(state.room&&state.room.game&&state.room.game.current===state.myPid);
