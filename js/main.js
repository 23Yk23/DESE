// 1. Gerekli fonksiyonları import et
import { auth } from './auth.js';
import { 
  onAuthStateChanged, // Kullanıcının giriş durumunu dinler
  signOut              // Çıkış yapma fonksiyonu
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// 2. GÜVENLİK KONTROLÜ: Kullanıcı durumunu dinle
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Kullanıcı giriş yapmış VE e-postasını doğrulamış
        if (user.emailVerified) {
            console.log('Giriş yapıldı:', user.email);
            
            const userEmailElement = document.getElementById('user-email');
            if(userEmailElement) {
                userEmailElement.textContent = `Hoş geldin, ${user.displayName}`;
            }

            // --- BURAYI EKLE ---
            // Kimlik doğrulandı, "bekleniyor" sınıfını kaldır ve sayfayı göster
            document.body.classList.remove('auth-pending');
            // ---------------------

        } else {
            // E-posta doğrulanmamışsa -> login'e at
            console.log('E-posta doğrulanmamış, yönlendiriliyor...');
            window.location.href = 'login.html';
        }
    } else {
        // Kullanıcı giriş yapmamışsa -> login'e at
        console.log('Kullanıcı giriş yapmamış, yönlendiriliyor...');
        window.location.href = 'login.html';
    }
});


// 3. ÇIKIŞ YAPMA İŞLEMİ
// DOMContentLoaded: HTML'in yüklenmesini bekle
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('btn-logout');

    if(logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                console.log('Çıkış yapıldı, yönlendiriliyor...');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Çıkış yaparken hata oluştu:', error);
                alert('Çıkış yapılamadı. Lütfen tekrar deneyin.');
            }
        });
    }
});