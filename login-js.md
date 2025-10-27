

login.js
// 5. GİRİŞ YAPMA İŞLEMİ (Değişiklik yok)
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user.emailVerified) { // <-- SORUN BURADA
            showMessage('Giriş başarılı! Ana sayfaya yönlendiriliyorsunuz...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 2000); 
        } else {
            showMessage('Giriş başarısız. Lütfen önce e-posta adresinizi doğrulayın. (Spam kutusunu kontrol edin)', 'error');
        }

    } catch (error) {
        showMessage(getFirebaseErrorMessage(error.code), 'error');
    }
});










bu da main.js de 
// 3. GÜVENLİK KONTROLÜ (GÜNCELLENDİ)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (user.emailVerified) { // <-- PROBLEM BURADA
            console.log('Giriş yapıldı:', user.email);
            // ... (kodun geri kalanı) ...
            loadEvents(user, userRole); 
            document.body.classList.remove('auth-pending');
        } else {
            console.log('E-posta doğrulanmamış, yönlendiriliyor...');
            window.location.href = 'login.html'; // <-- BU KOD ÇALIŞIYOR
        }
    } else {
        // ... (kodun geri kalanı) ...
    }
});