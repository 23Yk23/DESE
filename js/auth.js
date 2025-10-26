// firebase veritabanından çekiyor
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
// TODO: İleride veritabanı (Firestore) eklersek, buraya onun da import'u gelecek.

// Firebase config bilgileirm
const firebaseConfig = {
  apiKey: "AIzaSyBxff_YlIeBvsMNTqdmKvHRYGfMmho-5eA",
  authDomain: "dese-etkinlik-yonetimi.firebaseapp.com",
  projectId: "dese-etkinlik-yonetimi",
  storageBucket: "dese-etkinlik-yonetimi.firebasestorage.app",
  messagingSenderId: "333877775357",
  appId: "1:333877775357:web:d118e2d7e1a43cde5e2794",
  measurementId: "G-F441J8P40D"
};

// Başlat komutu.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);