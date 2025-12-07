// 1. Gerekli fonksiyonları import et
// auth.js'den 'auth' ve 'db' servislerini al
import { auth, db } from './auth.js'; 
// Firebase'den kayıt, giriş ve doğrulama fonksiyonlarını al
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  updateProfile 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// --- YENİ (Firestore) ---
// doc: Belge referansı oluşturur
// setDoc: Belgeye veri yazar
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
// ----------------------


// 2. HTML elemanlarını seç (Değişiklik yok)
const loginFormWrapper = document.getElementById('login-form');
const registerFormWrapper = document.getElementById('register-form');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');
const authMessage = document.getElementById('auth-message');

// 3. Form Değiştirme Linkleri (Değişiklik yok)
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault(); 
    loginFormWrapper.style.display = 'block';
    registerFormWrapper.style.display = 'none';
    authMessage.style.display = 'none'; 
});

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault(); 
    loginFormWrapper.style.display = 'none';
    registerFormWrapper.style.display = 'block';
    authMessage.style.display = 'none'; 
});


// 4. KAYIT OLMA İŞLEMİ (GÜNCELLENDİ)
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const name = document.getElementById('register-name').value;
    const surname = document.getElementById('register-surname').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const displayName = `${name} ${surname}`;

    if (!email.endsWith('@dogus.edu.tr')) {
        showMessage('Kayıt olmak için @dogus.edu.tr uzantılı bir e-posta adresi kullanmalısınız.', 'error');
        return;
    }

    try {
        // 1. Kullanıcı oluştur (Authentication)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. displayname (isim soyisim) kaydet (Authentication)
        await updateProfile(user, {
            displayName: displayName
        });

        // --- YENİ: 3. KULLANICI ROLÜNÜ OLUŞTUR (Firestore) ---
        // 'users' koleksiyonunda, kullanıcının UID'si ile eşleşen bir belge oluştur
        const userDocRef = doc(db, "users", user.uid);
        
        // Bu belgeye verileri yaz
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            role: "user" // Varsayılan rol
            // ileride buraya hobiler vs. eklenebilir
        });
        // --------------------------------------------------

        // 4. Doğrulama e-postası gönder
        await sendEmailVerification(user);
        
        showMessage('Kayıt başarılı! Lütfen e-postanızı kontrol ederek hesabınızı doğrulayın.', 'success');
        formRegister.reset(); 

    } catch (error) {
        showMessage(getFirebaseErrorMessage(error.code), 'error');
    }
});


// 5. GİRİŞ YAPMA İŞLEMİ (GÜNCELLENDİ - E-POSTA KONTROLÜ GEÇİCİ OLARAK KALDIRILDI)
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // --- KONTROL KALDIRILDI ---
        // Artık e-posta doğrulaması sorma, doğrudan giriş yap.
        showMessage('Giriş başarılı! Ana sayfaya yönlendiriliyorsunuz...', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000); 
        // -------------------------

    } catch (error) {
        showMessage(getFirebaseErrorMessage(error.code), 'error');
    }
});

// 6. Yardımcı Fonksiyonlar (Değişiklik yok)
function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = type; 
    authMessage.style.display = 'block'; 
}

function getFirebaseErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'Bu e-posta adresi zaten kullanımda.';
        case 'auth/weak-password':
            return 'Şifre çok zayıf. En az 6 karakter olmalı.';
        case 'auth/invalid-email':
            return 'Geçersiz e-posta adresi.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'E-posta veya şifre hatalı.';
        default:
            return 'Bir hata oluştu, lütfen tekrar deneyin.';
    }
}