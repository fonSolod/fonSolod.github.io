// js/auth.js — авторизация: ник (обязательно) + e-mail (опционально) + пароль.
import {auth,db,ref,set,get,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from './config.js';

export const TECH_DOMAIN='tyscha.local';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_RE=/^[\p{L}\p{N}_-]{3,16}$/u;
const LAT_RE=/^[a-z0-9._-]{3,30}$/;

export const isEmailLike=s=>EMAIL_RE.test(String(s||'').trim());
export const isValidNick=s=>NICK_RE.test(String(s||'').trim());
const normNick=s=>String(s).trim().toLowerCase();

// Ник → техническая почта (детерминированно, одинаково при регистрации и входе)
export async function nickToTechEmail(nick){
const n=normNick(nick);
if(LAT_RE.test(n))return n+'@'+TECH_DOMAIN;
const data=new TextEncoder().encode('tyscha:'+n);
const buf=await crypto.subtle.digest('SHA-256',data);
const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
return 'n'+hex.slice(0,20)+'@'+TECH_DOMAIN;
}

/* ---------- регистрация ---------- */
// nick обязателен; email опционален (для восстановления доступа).
// Без email создаётся технический адрес из ника.
export async function register({nick,email,password}){
const n=String(nick||'').trim();
if(!isValidNick(n))throw new Error('Ник: 3–16 символов — буквы, цифры, «_» или «-»');
const norm=normNick(n);
const nickSnap=await get(ref(db,`nicks/${norm}`));
if(nickSnap.exists())throw new Error('Этот ник уже занят');
const em=String(email||'').trim();
if(em&&!isEmailLike(em))throw new Error('Некорректный e-mail');
const authEmail=em||await nickToTechEmail(n);
const cred=await createUserWithEmailAndPassword(auth,authEmail,password);
const profile={
name:n,
nick:n,
email:em||null,
createdAt:Date.now()
};
await set(ref(db,`users/${cred.user.uid}`),profile);
await set(ref(db,`nicks/${norm}`),authEmail);
return profile;
}

/* ---------- вход ---------- */
// Логин — e-mail или ник. Для ника адрес берётся из индекса nicks/,
// для старых аккаунтов без индекса — детерминированный технический адрес.
export async function login({login,password}){
const l=String(login||'').trim();
if(isEmailLike(l)){
await signInWithEmailAndPassword(auth,l,password);
return;
}
const norm=normNick(l);
const snap=await get(ref(db,`nicks/${norm}`));
if(snap.exists()){
await signInWithEmailAndPassword(auth,snap.val(),password);
return;
}
const tech=await nickToTechEmail(l);
await signInWithEmailAndPassword(auth,tech,password);
// ленивая миграция: фиксируем ник старого аккаунта в индексе
try{await set(ref(db,`nicks/${norm}`),tech);}catch(e){}
}

export async function resetPassword(login){await sendPasswordResetEmail(auth,String(login).trim());}
export function logout(){return signOut(auth);}
export function watchAuth(cb){onAuthStateChanged(auth,cb);}

export async function loadProfile(uid){
const snap=await get(ref(db,`users/${uid}`));
const p=snap.val();
if(p)return p;
try{
const u=auth.currentUser;
const email=u&&u.email?u.email:null;
const profile={name:(email||'Игрок').split('@')[0],email,createdAt:Date.now()};
await set(ref(db,`users/${uid}`),profile);
return profile;
}catch(e){console.warn('Не удалось создать профиль:',e);return null;}
}

export function authErrorMsg(e){
const c=(e&&e.code)||'';
if(c.includes('email-already-in-use'))return 'Этот ник или e-mail уже занят';
if(c.includes('weak-password'))return 'Пароль слишком короткий (минимум 6 символов)';
if(c.includes('invalid-email'))return 'Некорректный e-mail';
if(c.includes('user-not-found')||c.includes('wrong-password')||c.includes('invalid-credential'))return 'Неверный логин или пароль';
if(c.includes('too-many-requests'))return 'Слишком много попыток подряд — попробуйте позже';
if(c.includes('network-request-failed'))return 'Ошибка сети';
return (e&&e.message)||('Ошибка '+c);
}
