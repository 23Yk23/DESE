// 1. Gerekli fonksiyonları import et
// --- GÜNCELLENDİ: 'deleteDoc' eklendi ---
import { 
  auth, 
  db,
  doc, 
  getDoc,
  collection,
  getDocs,
  updateDoc,
  query,
  orderBy,
  deleteDoc  // <-- SİLMEK İÇİN EKLENDİ
} from './auth.js'; 
// ----------------------------------------------------

import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// 2. GÜVENLİK KONTROLÜ (Değişiklik yok)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
            console.log('Admin giriş yaptı (Doğrulama atlandı):', user.email);
            
            const userEmailElement = document.getElementById('user-email');
            if(userEmailElement && userDocSnap.exists()) {
                userEmailElement.textContent = `Hoş geldin, ${userDocSnap.data().displayName} (admin)`;
            } else if(userEmailElement) {
                 userEmailElement.textContent = `Hoş geldin, ${user.displayName || 'İsimsiz'} (admin)`;
            }

            document.body.classList.remove('auth-pending');
            loadUsers(user.uid); 
            loadFeedback();      
        } else {
            console.log('Yetkisiz erişim denemesi, ana sayfaya yönlendiriliyor...');
            window.location.href = 'index.html';
        }
    } else {
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
// --- KULLANICI YÖNETİMİ FONKSİYONLARI ---
// ===========================================

/**
 * Firestore'dan tüm kullanıcıları çeker ve tabloya doldurur.
 * (Değişiklik yok)
 */
async function loadUsers(currentAdminId) {
    const userListBody = document.getElementById('user-list-body');
    const statusElement = document.getElementById('user-table-status');
    
    userListBody.innerHTML = '';
    statusElement.textContent = 'Kullanıcılar yükleniyor...';
    statusElement.className = 'user-table-status'; 

    try {
        const usersCollectionRef = collection(db, "users");
        const querySnapshot = await getDocs(usersCollectionRef);
        
        if (querySnapshot.empty) {
            statusElement.textContent = 'Hiç kullanıcı bulunamadı.';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${userData.displayName || 'İsimsiz'}</td>
                <td>${userData.email}</td>
                <td><strong>${userData.role}</strong></td>
            `;

            const roleSelectCell = document.createElement('td');
            const roleSelect = document.createElement('select');
            roleSelect.className = 'role-select';
            
            roleSelect.innerHTML = `
                <option value="user">user</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
            `;
            
            roleSelect.value = userData.role;

            if (userData.role === 'admin' || userId === currentAdminId) {
                roleSelect.disabled = true;
            }

            roleSelect.addEventListener('change', async (e) => {
                const newRole = e.target.value;
                if (confirm(`'${userData.email}' kullanıcısının rolünü '${newRole}' olarak değiştirmek istediğinizden emin misiniz?`)) {
                    await updateUserRole(userId, newRole, statusElement);
                    loadUsers(currentAdminId); 
                } else {
                    e.target.value = userData.role;
                }
            });

            roleSelectCell.appendChild(roleSelect);
            tr.appendChild(roleSelectCell);
            userListBody.appendChild(tr);
        });

        statusElement.textContent = '';

    } catch (error) {
        console.error("Kullanıcıları yüklerken hata oluştu:", error);
        statusElement.textContent = 'Kullanıcılar yüklenirken bir hata oluştu.';
        statusElement.className = 'user-table-status error'; 
    }
}

/**
 * Bir kullanıcının rolünü Firestore'da günceller.
 * (Değişiklik yok)
 */
async function updateUserRole(userId, newRole, statusElement) {
    statusElement.textContent = 'Rol güncelleniyor...';
    statusElement.className = 'user-table-status';

    try {
        const userDocRef = doc(db, "users", userId);
        
        await updateDoc(userDocRef, {
            role: newRole
        });

        statusElement.textContent = 'Rol başarıyla güncellendi!';
        statusElement.className = 'user-table-status success'; 

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


// ===========================================
// --- GERİ BİLDİRİM FONKSİYONLARI (SİLME EKLENDİ) ---
// ===========================================

/**
 * Firestore'dan gelen geri bildirimleri çeker ve tabloya doldurur.
 * (GÜNCELLENDİ - Sil butonu eklendi)
 */
async function loadFeedback() {
    const feedbackListBody = document.getElementById('feedback-list-body');
    const statusElement = document.getElementById('feedback-table-status');
    
    feedbackListBody.innerHTML = '';
    statusElement.textContent = 'Geri bildirimler yükleniyor...';
    statusElement.className = 'user-table-status';

    try {
        const feedbackCollectionRef = collection(db, "feedback");
        const q = query(feedbackCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            statusElement.textContent = 'Hiç geri bildirim bulunamadı.';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const feedback = docSnap.data();
            const feedbackId = docSnap.id;

            const tr = document.createElement('tr');
            
            const formattedDate = feedback.createdAt 
                ? feedback.createdAt.toDate().toLocaleString('tr-TR', { 
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                  }) 
                : 'Bilinmiyor';
            
            const senderInfo = `${feedback.userDisplayName || 'İsimsiz'} <br>(${feedback.userEmail})`;

            // --- Durum (Statü) Select (Değişiklik yok) ---
            const statusSelect = document.createElement('select');
            statusSelect.className = 'feedback-status-select';
            statusSelect.dataset.id = feedbackId;
            statusSelect.innerHTML = `
                <option value="new">Yeni</option>
                <option value="Okundu">Okundu</option>
                <option value="Cozuldu">Çözüldü</option>
            `;
            statusSelect.value = feedback.status || 'new'; 
            statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                await updateFeedbackStatus(feedbackId, newStatus, statusElement);
            });
            // --- Durum Select Sonu ---

            // --- YENİ: Sil Butonu Oluşturma ---
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-delete-feedback'; // CSS için
            deleteButton.textContent = 'Sil';
            deleteButton.addEventListener('click', async () => {
                if (confirm(`'${feedback.message.substring(0, 20)}...' mesajlı geri bildirimi silmek istediğinizden emin misiniz?`)) {
                    // 'tr' (tablo satırı) elementini fonksiyona yolla ki,
                    // silinince listeden de anında kaybolsun.
                    await deleteFeedback(feedbackId, tr, statusElement);
                }
            });
            // --- Sil Butonu Sonu ---

            // Hücreleri (td) oluştur
            const dateCell = document.createElement('td');
            dateCell.textContent = formattedDate;

            const senderCell = document.createElement('td');
            senderCell.innerHTML = senderInfo;

            const typeCell = document.createElement('td');
            typeCell.textContent = feedback.type;

            const messageCell = document.createElement('td');
            messageCell.className = 'feedback-message-cell'; 
            messageCell.textContent = feedback.message;

            const statusCell = document.createElement('td');
            statusCell.appendChild(statusSelect);

            // YENİ: Eylem (Sil) hücresi
            const actionCell = document.createElement('td');
            actionCell.appendChild(deleteButton);

            // Hücreleri satıra (tr) ekle
            tr.appendChild(dateCell);
            tr.appendChild(senderCell);
            tr.appendChild(typeCell);
            tr.appendChild(messageCell);
            tr.appendChild(statusCell);
            tr.appendChild(actionCell); // <-- YENİ HÜCRE EKLENDİ
            
            feedbackListBody.appendChild(tr);
        });

        statusElement.textContent = ''; 

    } catch (error) {
        console.error("Geri bildirimleri yüklerken hata oluştu:", error);
        statusElement.textContent = 'Geri bildirimler yüklenirken bir hata oluştu.';
        statusElement.className = 'user-table-status error'; 
    }
}

/**
 * Bir geri bildirimin durumunu (status) Firestore'da günceller.
 * (Değişiklik yok)
 */
async function updateFeedbackStatus(feedbackId, newStatus, statusElement) {
    statusElement.textContent = 'Durum güncelleniyor...';
    statusElement.className = 'user-table-status';

    try {
        const feedbackDocRef = doc(db, "feedback", feedbackId);
        
        await updateDoc(feedbackDocRef, {
            status: newStatus
        });

        statusElement.textContent = 'Durum başarıyla güncellendi!';
        statusElement.className = 'user-table-status success';

        setTimeout(() => {
            if (statusElement.textContent === 'Durum başarıyla güncellendi!') {
                statusElement.textContent = '';
            }
        }, 3000);

    } catch (error) {
        console.error("Durum güncellenirken hata:", error);
        statusElement.textContent = 'Durum güncellenirken bir hata oluştu.';
        statusElement.className = 'user-table-status error';
    }
}

/**
 * YENİ FONKSİYON: Bir geri bildirimi Firestore'dan siler.
 * @param {string} feedbackId - Silinecek geri bildirimin ID'si
 * @param {HTMLElement} tr - Silinecek tablo satırı (UI'dan kaldırmak için)
 * @param {HTMLElement} statusElement - Geri bildirim verilecek HTML elementi
 */
async function deleteFeedback(feedbackId, tr, statusElement) {
    statusElement.textContent = 'Geri bildirim siliniyor...';
    statusElement.className = 'user-table-status';

    try {
        const feedbackDocRef = doc(db, "feedback", feedbackId);
        
        // 1. Veritabanından sil
        await deleteDoc(feedbackDocRef);

        // 2. Arayüzden (tablodan) sil
        tr.remove();

        statusElement.textContent = 'Geri bildirim başarıyla silindi.';
        statusElement.className = 'user-table-status success';
        
        setTimeout(() => {
            if (statusElement.textContent === 'Geri bildirim başarıyla silindi.') {
                statusElement.textContent = '';
            }
        }, 3000);

    } catch (error) {
        console.error("Geri bildirim silinirken hata:", error);
        statusElement.textContent = 'Geri bildirim silinirken bir hata oluştu.';
        statusElement.className = 'user-table-status error';
    }
}