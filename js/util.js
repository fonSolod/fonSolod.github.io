// Маленькие помощники без зависимостей.
export const $=id=>document.getElementById(id);
export const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
export const isTouch=window.matchMedia&&matchMedia('(pointer: coarse)').matches;
export function ptsWord(n){const a=Math.abs(n)%100,b=a%10;if(a>=11&&a<=14)return'очков';if(b===1)return'очко';if(b>=2&&b<=4)return'очка';return'очков';}
export function kubWord(n){const b=n%10,a=n%100;if(b===1&&a!==11)return'кубик';if(b>=2&&b<=4&&(a<12||a>14))return'кубика';return'кубиков';}
export function hodWord(n){if(n===1)return'1 ход';return n+' хода';}
export function uniqueName(name,players){
const taken=Object.values(players||{}).map(p=>(p.name||'').toLowerCase());
if(!taken.includes(name.toLowerCase()))return name;
let i=2;while(taken.includes((name+' '+i).toLowerCase()))i++;
return name+' '+i;
}
let toastTimer=null;
export function toast(t,k){const el=$('toast');el.textContent=t;el.className='show '+(k||'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',2400);}
export const BOT_LEVELS={easy:'лёгкий',mid:'средний',hard:'сложный'};
