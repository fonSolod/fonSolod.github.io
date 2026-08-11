// Чистая игровая логика: ни DOM, ни сети. Можно тестировать отдельно.
export const OPEN_MIN=50;
export const TARGET=1000, SAMOSVAL=555;
export const DOT_LIMIT=3, BOLT_LIMIT=3, ZERO_STREAK=3;
export const BARRELS=[{lo:195,hi:295},{lo:695,hi:795}]; // границы не входят в бочку
export const PC=['#ffd76a','#ff7a6b','#6bd5ff','#c79bff'];
export const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export const rndFace=()=>1+Math.floor(Math.random()*6);
export const getBarrel=sc=>BARRELS.find(b=>sc>b.lo&&sc<b.hi)||null;
export function facePts(f,c){
if(f===1)return[0,10,20,100,200,1000][c];
if(f===5)return[0,5,10,50,100,500][c];
return[0,0,0,f*10,f*20,f*100][c];
}
export function calcScore(faces){
const cnt={};faces.forEach(f=>cnt[f]=(cnt[f]||0)+1);
let t=0;for(const f in cnt)t+=facePts(+f,cnt[f]);return t;
}
export function scoringFlags(faces){
const cnt={};faces.forEach(f=>cnt[f]=(cnt[f]||0)+1);
return faces.map(f=>f===1||f===5||cnt[f]>=3);
}