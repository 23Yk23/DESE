import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";

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
  where,
  limit,
  runTransaction,
  increment,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxff_YlIeBvsMNTqdmKvHRYGfMmho-5eA",
  authDomain: "dese-etkinlik-yonetimi.firebaseapp.com",
  projectId: "dese-etkinlik-yonetimi",
  storageBucket: "dese-etkinlik-yonetimi.firebasestorage.app",
  messagingSenderId: "333877775357",
  appId: "1:333877775357:web:d118e2d7e1a43cde5e2794",
  measurementId: "G-F441J8P40D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");

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
  httpsCallable
};