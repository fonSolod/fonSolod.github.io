import {state} from './state.js';
export const ROLL_SOUNDS=['dice1.wav','dice2.wav','dice3.wav'];
let rollAudios=null;
export function playRollSound(){
if(!state.soundOn)return;
try{
if(!rollAudios){rollAudios=ROLL_SOUNDS.map(u=>{const a=new Audio(u);a.volume=.85;return a;});}
const a=rollAudios[Math.floor(Math.random()*rollAudios.length)];
a.currentTime=0;a.play().catch(()=>{});
}catch(e){}
}
let audioCtx=null;
export function tone(f,dur,type,vol,when){
if(!state.soundOn)return;
try{
audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
if(audioCtx.state==='suspended')audioCtx.resume();
const t=audioCtx.currentTime+(when||0);
const o=audioCtx.createOscillator();o.type=type||'triangle';o.frequency.value=f;
const g=audioCtx.createGain();g.gain.setValueAtTime(vol||.12,t);
g.gain.exponentialRampToValueAtTime(.0001,t+dur);
o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.03);
}catch(e){}
}
export function soundTurn(){tone(880,.15,'triangle',.12);tone(1174,.22,'triangle',.12,.16);}