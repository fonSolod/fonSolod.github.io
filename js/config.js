// Firebase-конфиг, база данных и авторизация.
// Инициализация идемпотентна: при повторном вызове модуль использует существующее приложение.
import {initializeApp, getApps, getApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as FDB from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import * as FA from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig={
apiKey:"AIzaSyB_GNnhKBop_koWOLjBjyVmfVoWJ_tvF40",
authDomain:"game-95c86.firebaseapp.com",
databaseURL:"https://game-95c86-default-rtdb.firebaseio.com",
projectId:"game-95c86",
storageBucket:"game-95c86.firebasestorage.app",
messagingSenderId:"485164734552",
appId:"1:485164734552:web:95a1258519498719d4122d",
measurementId:"G-F9PW364YX8"
};

export const configured=!String(firebaseConfig.apiKey).includes('ВСТАВЬТЕ');
export let db=null,auth=null;
export let ref=null,update=null,set=null,get=null,onValue=null,onDisconnect=null,remove=null;
export let onAuthStateChanged=null,createUserWithEmailAndPassword=null,signInWithEmailAndPassword=null,signOut=null,sendPasswordResetEmail=null;
export let updatePassword=null,updateEmail=null,deleteUser=null,reauthenticateWithCredential=null,EmailAuthProvider=null;

if(configured){
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
({ref,update,set,get,onValue,onDisconnect,remove}=FDB);
db=FDB.getDatabase(app);
({onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,updatePassword,updateEmail,deleteUser,reauthenticateWithCredential,EmailAuthProvider}=FA);
auth=FA.getAuth(app);
}
