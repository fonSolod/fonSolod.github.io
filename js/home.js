// js/home.js — главная страница: список комнат с фильтрами и секциями.
import {state} from './state.js';
import {$,esc} from './util.js';
import * as net from './net.js';

const DAY=24*3600*1000;
const STATUS_TXT={lobby:'лобби',playing:'в игре',finished:'завершена'};

export function renderHome(){
const wrap=$('homeSections');if(!wrap)return;
wrap.innerHTML='';
const rooms=Object.entries(state.homeRooms||{}).map(([code,r])=>({code,r})).filter(x=>x.r&&x.r.meta);
const filt=(state.homeFilter||'').trim().toUpperCase();
const now=Date.now();
const mine=x=>!!(x.r.players&&x.r.players[state.uid]&&!x.r.players[state.uid].left);
const isActive=x=>(x.r.meta.lastActive||0)>now-DAY;
const visible=rooms.filter(x=>{
if(filt&&!x.code.includes(filt))return false;
// приватные комнаты видят только участники и админы
if(x.r.meta.hidden===true&&!mine(x)&&!state.isAdmin)return false;
return true;
});
const byFresh=(a,b)=>(b.r.meta.lastActive||0)-(a.r.meta.lastActive||0);
const myActive=visible.filter(x=>mine(x)&&isActive(x)).sort(byFresh);
const openActive=visible.filter(x=>!mine(x)&&isActive(x)).sort(byFresh);
const inactive=visible.filter(x=>!isActive(x)).sort(byFresh);
if(!visible.length){
wrap.innerHTML='<p class="emptyNote">Комнат пока нет — создайте первую или введите код!</p>';
return;
}
if(myActive.length)section(wrap,'Мои комнаты',myActive,false);
if(openActive.length)section(wrap,'Открытые комнаты',openActive,false);
if(inactive.length)section(wrap,'Неактивные (больше 24 часов)',inactive,true);
}

function section(wrap,title,list,gray){
const h=document.createElement('div');
h.className='sectionTitle'+(gray?' gray':'');h.textContent=title;
wrap.appendChild(h);
list.forEach(x=>wrap.appendChild(roomCard(x,gray)));
}

function roomCard({code,r},inactive){
const m=r.meta,players=r.players||{};
const iAmIn=!!players[state.uid];
const iAmCreator=m.createdBy===state.uid;
const status=m.status||'lobby';
const cnt=(r.order||[]).length;
const full=cnt>=4;
const specOk=m.allowSpectators!==false;
const chips=[
`<span class="chip st-${status}">${STATUS_TXT[status]||status}</span>`,
`<span class="chip">👥 ${cnt}/4</span>`
];
if(m.hidden)chips.push('<span class="chip lock">🔒 приватная</span>');
chips.push(specOk?'<span class="chip">👁 наблюдатели</span>':'<span class="chip">🚫 без наблюдателей</span>');
if(iAmCreator)chips.push('<span class="chip mine">организатор</span>');
if(iAmIn)chips.push('<span class="chip mine">вы в комнате</span>');
let btnHtml='';
if(iAmIn)btnHtml=`<button class="btn primary" data-act="enter" data-code="${code}">Продолжить</button>`;
else if(status==='lobby'&&!full)btnHtml=`<button class="btn primary" data-act="enter" data-code="${code}">Войти</button>`;
else if(status==='lobby')btnHtml=`<button class="btn ghost blocked" disabled>Заполнена</button>`;
else if(specOk)btnHtml=`<button class="btn ghost" data-act="enter" data-code="${code}">👁 Наблюдать</button>`;
else btnHtml=`<button class="btn ghost blocked" disabled>🚫 Без наблюдателей</button>`;
if(iAmCreator||state.isAdmin)btnHtml+=` <button class="btn ghost rcDel" data-act="delroom" data-code="${code}" title="Удалить комнату">🗑</button>`;
const c=document.createElement('div');
c.className='roomCard'+(inactive?' inactive':'');
c.innerHTML=`<div class="rcTop">
<div><span class="rcCode">${code}</span><span class="rcOrg">организатор: ${esc(players[m.createdBy]?players[m.createdBy].name:'—')}</span></div>
<div class="rcChips">${chips.join('')}</div>
</div>
<div class="rcBtns">${btnHtml}</div>`;
return c;
}
