// Звук. AudioContext создаётся только после первого жеста пользователя.
import {state} from './state.js';

/* ---------- звук броска ---------- */
export const ROLL_SOUNDS=['dice1.wav','dice2.wav','dice3.wav'];
let rollAudios=null;
export function playRollSound(){
if(!state.soundOn)return;
try{
if(!rollAudios){
rollAudios=ROLL_SOUNDS.map(u=>{const a=new Audio(u);a.volume=.85;return a;});
}
const a=rollAudios[Math.floor(Math.random()*rollAudios.length)];
a.currentTime=0;
a.play().catch(()=>{});
}catch(e){}
}

/* ---------- тональный движок ---------- */
let audioCtx=null;
let gestureReady=false; // первый жест уже был?

// Создаёт или пробуждает контекст. Возвращает AudioContext или null,
// если вызвана до первого жеста (тогда звук тихо пропускается).
function ensureAudio(){
if(!gestureReady)return null;
try{
audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
return audioCtx;
}catch(e){return null;}
}

// Публично — вешается на первый pointerdown в main.js
export function initAudioOnGesture(){
if(gestureReady)return;
gestureReady=true;
ensureAudio();
}

export function tone(f,dur,type,vol,when){
if(!state.soundOn)return;
const ctx=ensureAudio();
if(!ctx)return; // тихо пропускаем, пока не было жеста
try{
const t=ctx.currentTime+(when||0);
const o=ctx.createOscillator();o.type=type||'triangle';o.frequency.value=f;
const g=ctx.createGain();g.gain.setValueAtTime(vol||.12,t);
g.gain.exponentialRampToValueAtTime(.0001,t+dur);
o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+dur+.03);
}catch(e){}
}

export function soundTurn(){tone(880,.15,'triangle',.12);tone(1174,.22,'triangle',.12,.16);}
