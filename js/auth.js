// Авторизация: e-mail или ник. Ник детерминированно превращается в техническую почту.
import {auth,db,ref,set,get,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from './config.js';

export const TECH_DOMAIN='tyscha.local'; // «хвост» технической почты
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_RE=/^[\p{L}\p{N}_-]{3,16}$/u;
const LAT_RE=/^[a-z0-9._-]{3,30}$/;

export const isEmailLike=s=>EMAIL_RE.test(String(s||'').trim());
export const isValidNick=s=>NICK_RE.test(String(s||'').trim());

// Ник → техническая почта. Одинаково при регистрации и при входе.
export async function nickToTechEmail(nick){
const n=String(nick).trim().toLowerCase();
if(LAT_RE.test(n))return n+'@'+TECH_DOMAIN;
// Кириллица и прочие символы: хеш — гарантированно валидный адрес
const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('tyscha:'+n));
const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
return 'n'+hex.slice(0,20)+'@'+TECH_DOMAIN;
}

export async function register({login,password,name}){
const isEmail=isEmailLike(login);
const email=isEmail?login.trim():await nickToTechEmail(login);
const cred=await createUserWithEmailAndPassword(auth,email,password);
const profile={
name:(name||'').trim()||(isEmail?login.trim().split('@')[0]:login.trim()),
login:isEmail?null:login.trim(),
email:isEmail?login.trim():null,
createdAt:Date.now()
};
await set(ref(db,`users/${cred.user.uid}`),profile);
return profile;
}

export async function login({login,password}){
const isEmail=isEmailLike(login);
const email=isEmail?login.trim():await nickToTechEmail(login);
await signInWithEmailAndPassword(auth,email,password);
}

export async function resetPassword(login){await sendPasswordResetEmail(auth,login.trim());}
export function logout(){return signOut(auth);}
export function watchAuth(cb){onAuthStateChanged(auth,cb);}

export async function loadProfile(uid){
const snap=await get(ref(db,`users/${uid}`));
return snap.val()||null;
}

export function authErrorMsg(e){
const c=(e&&e.code)||'';
if(c.includes('email-already-in-use'))return 'Этот логин уже занят';
if(c.includes('weak-password'))return 'Пароль слишком короткий (минимум 6 символов)';
if(c.includes('invalid-email'))return 'Некорректный e-mail';
if(c.includes('user-not-found')||c.includes('wrong-password')||c.includes('invalid-credential'))return 'Неверный логин или пароль';
if(c.includes('too-many-requests'))return 'Слишком много попыток подряд — попробуйте позже';
if(c.includes('network-request-failed'))return 'Ошибка сети';
return (e&&e.message)||('Ошибка '+c);
}
