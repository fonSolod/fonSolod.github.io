// js/bot.js — драйвер ходов ботов. Работает на устройстве организатора:
// когда очередь хода у бота, бросает кубики, решает «хватит/переброс» и передаёт ход.
import {state} from './state.js';
import {rndFace,getBarrel,TARGET} from './rules.js';
import {canBank} from './ledger.js';
import {applyRoll,applyBank,advanceTurn} from './actions.js';

const BOT_DELAY=700; // мс на «раздумье» (быстрый темп)
let botTimer=null,botKey='';

// Вызывается на каждый снапшот (из ui.onSnapshot в main.js)
export function maybeDriveBot(){
const r=state.room;
if(!r||!r.game||!r.meta||r.meta.status!=='playing'){clearBot();return;}
if(r.meta.createdBy!==state.myPid){clearBot();return;} // ботов ведёт только организатор
const g=r.game,cp=r.players[g.current];
if(!cp||!cp.isBot){clearBot();return;}
if(g.phase!=='roll'&&g.phase!=='choose'&&g.phase!=='wait'){clearBot();return;}
const key=g.seq+':'+g.phase+':'+g.current;
if(key===botKey&&botTimer)return; // на это состояние уже запланировано
clearTimeout(botTimer);
botKey=key;
botTimer=setTimeout(()=>{botTimer=null;act(key);},BOT_DELAY);
}

export function clearBot(){if(botTimer){clearTimeout(botTimer);botTimer=null;}botKey='';}

function act(key){
const r=state.room;
if(!r||!r.game||r.meta.status!=='playing')return;
const g=r.game;
if((g.seq+':'+g.phase+':'+g.current)!==key)return; // состояние уже изменилось
if(r.meta.createdBy!==state.myPid)return;
const cp=r.players[g.current];
if(!cp||!cp.isBot)return;
if(g.phase==='wait'){advanceTurn();return;}
const n=(g.dice||[]).length||5;
if(g.phase==='roll'){applyRoll(Array.from({length:n},rndFace),g.current);return;}
if(g.phase==='choose'){
if(shouldBank(cp,g))applyBank(g.current);
else applyRoll(Array.from({length:n},rndFace),g.current);
}
}

/* ---------- стратегия ---------- */
function shouldBank(p,g){
const T=g.turnTotal;
if(!canBank().ok)return false; // нельзя банк — перебрасываем
const lvl=p.botLevel||'mid';
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
// порог «хватит» зависит от уровня и слегка случайный
const thr=lvl==='easy'?R(20,45):lvl==='hard'?R(80,120):R(55,85);
const pot=p.score+T;
// банк приведёт в бочку — умные боты перебрасывают, чтобы перепрыгнуть
if(getBarrel(pot)&&lvl!=='easy')return false;
// эндшпиль: около 1000 не жадничаем
if(p.opened){
const left=TARGET-pot;
if(lvl==='hard'&&left<=40)return true;
if(lvl==='mid'&&left<=20)return true;
}
return T>=thr;
}
