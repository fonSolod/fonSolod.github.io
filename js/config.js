// Firebase-конфиг, база данных и авторизация
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
export let ref=null,update=null,set=null,get=null,onValue=null,onDisconnect=null;
export let onAuthStateChanged=null,createUserWithEmailAndPassword=null,signInWithEmailAndPassword=null,signOut=null,sendPasswordResetEmail=null;
if(configured){
const {initializeApp}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
const FDB=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
const FA=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
const app=initializeApp(firebaseConfig);
({ref,update,set,get,onValue,onDisconnect}=FDB);
db=FDB.getDatabase(app);
({onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail}=FA);
auth=FA.getAuth(app);
}
