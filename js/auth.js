// js/auth.js — авторизация: ник (обязательно) + e-mail (опционально) + пароль,
// а также управление аккаунтом (имя, ник, пароль, почта, удаление).
import {auth,db,ref,set,get,update,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,updatePassword,updateEmail,deleteUser,reauthenticateWithCredential,EmailAuthProvider} from './config.js';

export const TECH_DOMAIN='tyscha.local';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_RE=/^[\p{L}\p{N}_-]{3,16}$/u;
const LAT_RE=/^[a-z0-9._-]{3,30}$/;

export const isEmailLike=s=>EMAIL_RE.test(String(s||'').trim());
export const isValidNick=s=>NICK_RE.test(String(s||'').trim());
const normNick=s=>String(s).trim().toLowerCase();

// Ник → техническая почта (детерминированно)
export async function nickToTechEmail(nick){
const n=normNick(nick);
if(LAT_RE.test(n))return n+'@'+TECH_DOMAIN;
const data=new TextEncoder().encode('tyscha:'+n);
const buf=await crypto.subtle.digest('SHA-256',data);
const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
return 'n'+hex.slice(0,20)+'@'+TECH_DOMAIN;
}

/* ---------- регистрация и вход ---------- */
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
const profile={name:n,nick:n,email:em||null,createdAt:Date.now()};
await set(ref(db,`users/${cred.user.uid}`),profile);
await set(ref(db,`nicks/${norm}`),authEmail);
return profile;
}

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

/* ---------- настройки аккаунта ---------- */
// Подтверждение операции паролем (Firebase требует для чувствительных действий)
async function reauth(password){
const user=auth.currentUser;
const cred=EmailAuthProvider.credential(user.email,password);
await reauthenticateWithCredential(user,cred);
}

// Имя в игре
export async function updateGameName(name){
const n=String(name||'').trim();
if(!n)throw new Error('Имя не может быть пустым');
if(n.length>14)throw new Error('Максимум 14 символов');
await update(ref(db,`users/${auth.currentUser.uid}`),{name:n});
}

// Смена пароля
export async function changePassword(currentPass,newPass){
await reauth(currentPass);
await updatePassword(auth.currentUser,newPass);
}

// Привязка/смена e-mail (обновляет и индекс ника, если он есть)
export async function changeEmail(newEmail,password){
const user=auth.currentUser;
const em=String(newEmail||'').trim();
if(!isEmailLike(em))throw new Error('Некорректный e-mail');
await reauth(password);
await updateEmail(user,em);
await update(ref(db,`users/${user.uid}`),{email:em});
const prof=(await get(ref(db,`users/${user.uid}`))).val();
if(prof&&prof.nick)await set(ref(db,`nicks/${normNick(prof.nick)}`),em);
}

// Смена ника. Для аккаунтов без почты меняется и технический адрес (нужен пароль),
// для аккаунтов с почтой — только база данных.
export async function changeNick(newNick,password){
const user=auth.currentUser;
const n=String(newNick||'').trim();
if(!isValidNick(n))throw new Error('Ник: 3–16 символов — буквы, цифры, «_» или «-»');
const norm=normNick(n);
const nickSnap=await get(ref(db,`nicks/${norm}`));
if(nickSnap.exists())throw new Error('Этот ник уже занят');
const prof=(await get(ref(db,`users/${user.uid}`))).val()||{};
let authEmail=user.email;
if(!prof.email){
await reauth(password);
authEmail=await nickToTechEmail(n);
await updateEmail(user,authEmail);
}
if(prof.nick)await set(ref(db,`nicks/${normNick(prof.nick)}`),null);
await set(ref(db,`nicks/${norm}`),authEmail);
await update(ref(db,`users/${user.uid}`),{nick:n});
}

// Удаление аккаунта
export async function deleteAccount(password){
const user=auth.currentUser;
await reauth(password);
const prof=(await get(ref(db,`users/${user.uid}`))).val()||{};
if(prof.nick)await set(ref(db,`nicks/${normNick(prof.nick)}`),null);
await set(ref(db,`users/${user.uid}`),null);
await deleteUser(user);
}

export function authErrorMsg(e){
const c=(e&&e.code)||'';
if(c.includes('email-already-in-use'))return 'Этот ник или e-mail уже занят';
if(c.includes('weak-password'))return 'Пароль слишком короткий (минимум 6 символов)';
if(c.includes('invalid-email'))return 'Некорректный e-mail';
if(c.includes('requires-recent-login'))return 'Операция требует подтверждения — введите пароль ещё раз';
if(c.includes('user-not-found')||c.includes('wrong-password')||c.includes('invalid-credential'))return 'Неверный логин или пароль';
if(c.includes('too-many-requests'))return 'Слишком много попыток подряд — попробуйте позже';
if(c.includes('network-request-failed'))return 'Ошибка сети';
return (e&&e.message)||('Ошибка '+c);
}
