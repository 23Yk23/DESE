// firebase veritabanından çekiyor
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
// --- BURASI DOĞRU, EKLEMİŞSİN ---
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";
// ---------------------------------
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    addDoc,
    getDocs,
    collection,
    query,
    orderBy,
    deleteDoc,
    updateDoc,
    where,          // Burası da doğru
    limit,          // Burası da doğru
    runTransaction,
    increment,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Firebase config bilgileirm (Değişiklik yok)
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
export const storage = getStorage(app);
export const db = getFirestore(app);
// --- 1. YENİ SATIR: Functions servisini başlat ---
export const functions = getFunctions(app, 'europe-west1'); // <-- BU SATIRI EKLE
// ------------------------------------------------

// --- TÜM FONKSİYONLARI EXPORT ET ---
export {
    doc,
    getDoc,
    setDoc,
    addDoc,
    getDocs,
    collection,
    query,
    orderBy,
    deleteDoc,
    updateDoc,
    where,
    limit,
    runTransaction,
    increment,
    serverTimestamp,
    Timestamp,
    // --- 2. YENİ EKLEME: httpsCallable'ı export et ---
    httpsCallable // <-- BU SATIRI EKLE (Virgülüne dikkat et)
    // ------------------------------------------------
};
// --------------------------------------------------