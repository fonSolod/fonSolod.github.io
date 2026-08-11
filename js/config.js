// Firebase-конфиг и инициализация. Единственное место, где знаем про Firebase.
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
export let db=null;
export let ref=null,update=null,set=null,get=null,onValue=null,onDisconnect=null;
if(configured){
const {initializeApp}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
const FDB=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
ref=FDB.ref;update=FDB.update;set=FDB.set;get=FDB.get;onValue=FDB.onValue;onDisconnect=FDB.onDisconnect;
db=FDB.getDatabase(initializeApp(firebaseConfig));
}