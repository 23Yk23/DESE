// 1. Gerekli fonksiyonları import et
// --- GÜNCELLENDİ: Her şey './auth.js' dosyasından geliyor ---
import { 
  auth, 
  db,
  doc, 
  getDoc,
  collection,
  getDocs,
  updateDoc
} from './auth.js'; 
//  ----------------------------------------------------

import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


// 2. GÜVENLİK KONTROLÜ: Kullanıcı durumunu ve ROLÜNÜ dinle
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Kullanıcı giriş yapmış
        if (user.emailVerified) {
            // E-posta doğrulanmış -> Şimdi ROLÜ KONTROL ET
            
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
                // *** ERİŞİM İZNİ VERİLDİ ***
                console.log('Admin giriş yaptı:', user.email);
                
                // Hoş geldin mesajını ayarla
                const userEmailElement = document.getElementById('user-email');
                if(userEmailElement) {
                    userEmailElement.textContent = `Hoş geldin, ${user.displayName} (admin)`;
                }

                // Sayfayı göster
                document.body.classList.remove('auth-pending');

                // --- YENİ EKLENDİ ---
                // Sayfa göründükten sonra kullanıcı listesini yükle
                // user.uid'i gönderiyoruz ki admin kendi rolünü kilitleyebilsin.
                loadUsers(user.uid); 
                // ---------------------

            } else {
                // Rolü 'admin' değil -> Ana sayfaya at
                console.log('Yetkisiz erişim denemesi, ana sayfaya yönlendiriliyor...');
                window.location.href = 'index.html';
            }

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


// 3. ÇIKIŞ YAPMA İŞLEMİ (Değişiklik yok)
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
            }
        });
    }
});


// ===========================================
// --- YENİ EKLENEN FONKSİYONLAR ---
// ===========================================

/**
 * Firestore'dan tüm kullanıcıları çeker ve tabloya doldurur.
 * @param {string} currentAdminId - Giriş yapmış adminin ID'si (kendini değiştiremesin diye)
 */
async function loadUsers(currentAdminId) {
    // HTML elementlerini seç
    const userListBody = document.getElementById('user-list-body');
    const statusElement = document.getElementById('user-table-status');
    
    // Önceki listeyi temizle (varsa) ve yükleniyor mesajı göster
    userListBody.innerHTML = '';
    statusElement.textContent = 'Kullanıcılar yükleniyor...';
    statusElement.className = 'user-table-status'; // stilleri sıfırla

    try {
        // 'users' koleksiyonundaki tüm belgeleri çek
        const usersCollectionRef = collection(db, "users");
        const querySnapshot = await getDocs(usersCollectionRef);
        
        if (querySnapshot.empty) {
            statusElement.textContent = 'Hiç kullanıcı bulunamadı.';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const userId = docSnap.id;

            // 1. Tablo satırı (tr) oluştur
            const tr = document.createElement('tr');
            
            // 2. İsim, Email ve Mevcut Rol hücrelerini (td) oluştur
            tr.innerHTML = `
                <td>${userData.displayName || 'İsimsiz'}</td>
                <td>${userData.email}</td>
                <td><strong>${userData.role}</strong></td>
            `;

            // 3. "Rolü Değiştir" hücresini (td) oluştur
            const roleSelectCell = document.createElement('td');
            
            // 4. Select (dropdown) elementini oluştur
            const roleSelect = document.createElement('select');
            roleSelect.className = 'role-select'; // CSS sınıfı
            
            // Seçenekleri (options) ekle
            roleSelect.innerHTML = `
                <option value="user">user</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
            `;
            
            // Mevcut rolü seçili hale getir
            roleSelect.value = userData.role;

            // --- GÜVENLİK KURALI ---
            // Eğer listelenen kullanıcı 'admin' ise VEYA 
            // listelenen kullanıcı şu anki adminin kendisi ise,
            // rol değiştirme dropdown'ını KİLİTLE (disabled).
            if (userData.role === 'admin' || userId === currentAdminId) {
                roleSelect.disabled = true;
            }

            // 5. Select'e 'change' (değişim) olayı ekle
            roleSelect.addEventListener('change', async (e) => {
                const newRole = e.target.value;
                // Değişikliği onayla
                if (confirm(`'${userData.email}' kullanıcısının rolünü '${newRole}' olarak değiştirmek istediğinizden emin misiniz?`)) {
                    // Rolü güncelle
                    await updateUserRole(userId, newRole, statusElement);
                    // Değişiklik sonrası listeyi yenile (yeni kilit durumları vs. için)
                    loadUsers(currentAdminId); 
                } else {
                    // İptal ederse seçimi eski haline getir
                    e.target.value = userData.role;
                }
            });

            // 6. Elementleri birbirine ekle
            roleSelectCell.appendChild(roleSelect);
            tr.appendChild(roleSelectCell);
            userListBody.appendChild(tr);
        });

        // Yükleme tamamlandı, mesajı gizle
        statusElement.textContent = '';

    } catch (error) {
        console.error("Kullanıcıları yüklerken hata oluştu:", error);
        statusElement.textContent = 'Kullanıcılar yüklenirken bir hata oluştu.';
        statusElement.className = 'user-table-status error'; 
    }
}

/**
 * Bir kullanıcının rolünü Firestore'da günceller.
 * @param {string} userId - Güncellenecek kullanıcının ID'si
 * @param {string} newRole - Atanacak yeni rol ('user' veya 'manager')
 * @param {HTMLElement} statusElement - Geri bildirim verilecek HTML elementi
 */
async function updateUserRole(userId, newRole, statusElement) {
    statusElement.textContent = 'Rol güncelleniyor...';
    statusElement.className = 'user-table-status';

    try {
        // Kullanıcının Firestore belgesine referans al
        const userDocRef = doc(db, "users", userId);
        
        // 'role' alanını güncelle
        await updateDoc(userDocRef, {
            role: newRole
        });

        statusElement.textContent = 'Rol başarıyla güncellendi!';
        statusElement.className = 'user-table-status success'; // CSS'teki yeşil renk

        // Mesajı 3 saniye sonra temizle
        setTimeout(() => {
            if (statusElement.textContent === 'Rol başarıyla güncellendi!') {
                statusElement.textContent = '';
            }
        }, 3000);

    } catch (error) {
        console.error("Rol güncellenirken hata:", error);
        statusElement.textContent = 'Rol güncellenirken bir hata oluştu.';
        statusElement.className = 'user-table-status error';
    }
}