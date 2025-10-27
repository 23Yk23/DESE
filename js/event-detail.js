// 1. Gerekli fonksiyonları import et
// (Tüm fonksiyonları auth.js'den alıyoruz)
import { 
  auth, 
  db,
  doc, 
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from './auth.js'; 

import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


/**
 * URL'den etkinlik ID'sini alır (örn: ?id=ABC...)
 * @returns {string|null} Etkinlik ID'si veya bulunamazsa null
 */
function getEventIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Sayfayı yükleyen ana fonksiyon
 */
async function loadPage() {
    const eventId = getEventIdFromURL();
    if (!eventId) {
        document.getElementById('event-detail-container').innerHTML = 
            '<p style="color:red; font-weight:bold;">Hata: Etkinlik ID bulunamadı.</p>';
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        // Bu durum onAuthStateChanged'de zaten yakalanır ama ekstra güvenlik
        return; 
    }

    try {
        // --- 1. Adım: Kullanıcının Rolünü Öğren ---
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userRole = "user";
        let userDisplayName = user.displayName;

        if (userDocSnap.exists()) {
            userRole = userDocSnap.data().role;
            userDisplayName = userDocSnap.data().displayName;
        }
        
        // Navbar'a "Hoş geldin..." mesajını ekle
        const userEmailElement = document.getElementById('user-email');
        if(userEmailElement) {
            userEmailElement.textContent = `Hoş geldin, ${userDisplayName} (${userRole})`;
        }


        // --- 2. Adım: Etkinlik Detaylarını Firestore'dan Çek ---
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            document.getElementById('event-detail-container').innerHTML = 
                '<p style="color:red; font-weight:bold;">Hata: Bu ID\'ye sahip bir etkinlik bulunamadı.</p>';
            return;
        }

        const event = eventSnap.data();
        renderEventDetails(event); // Detayları HTML'e bas


        // --- 3. Adım: Rol Kontrolü ve Katılımcı Listesi ---
        if (userRole === 'admin' || userRole === 'manager') {
            // Eğer admin veya manager ise, katılımcı listesi bölümünü göster
            document.getElementById('participant-list-section').style.display = 'block';
            // Listeyi doldur
            loadParticipants(eventId);
        }

    } catch (error) {
        console.error("Sayfa yüklenirken hata:", error);
        document.getElementById('event-detail-container').innerHTML = 
            '<p style="color:red; font-weight:bold;">Hata: Veriler yüklenemedi.</p>';
    }
}

/**
 * Etkinlik detaylarını HTML'e basar
 * @param {object} event - Firestore'dan gelen etkinlik verisi
 */
function renderEventDetails(event) {
    const container = document.getElementById('event-detail-container');
    
    // Tarihi formatla
    const eventDate = event.eventDate.toDate();
    const formattedDate = eventDate.toLocaleString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    // Kontenjan
    const quotaText = `${event.participantCount || 0} / ${event.capacity} Kişi`;

    container.innerHTML = `
        <div class="event-detail-header">
            <img src="${event.bannerURL}" alt="${event.title}" class="event-detail-banner">
            <div class="event-detail-content">
                <h2>${event.title}</h2>
                
                <div class="event-detail-info">
                    <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                    <span><i class="fas fa-users"></i> ${quotaText}</span>
                    <span><i class="fas fa-user-tie"></i> ${event.createdByName}</span>
                </div>

                <div class="event-detail-description">
                    <p>${event.description.replace(/\\n/g, '<br>')}</p> </div>
            </div>
        </div>
    `;
}

/**
 * Etkinliğin katılımcı listesini Firestore'dan çeker ve tabloya basar
 * @param {string} eventId - Etkinliğin ID'si
 */
async function loadParticipants(eventId) {
    const listBody = document.getElementById('participant-list-body');
    const status = document.getElementById('participant-list-status');
    listBody.innerHTML = '';
    status.textContent = 'Katılımcılar yükleniyor...';

    try {
        // events/{eventId}/participants koleksiyonunu sorgula
        const participantsRef = collection(db, `events/${eventId}/participants`);
        const q = query(participantsRef, orderBy("joinedAt", "asc")); // İlk katılan en üstte
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            status.textContent = 'Bu etkinliğe henüz katılan yok.';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const participant = docSnap.data();
            
            // Katılma tarihini formatla
            const joinedDate = participant.joinedAt.toDate();
            const formattedJoinedDate = joinedDate.toLocaleString('tr-TR', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${participant.displayName || 'İsimsiz'}</td>
                <td>${participant.email}</td>
                <td>${formattedJoinedDate}</td>
            `;
            listBody.appendChild(tr);
        });

        status.textContent = ''; // Yükleme başarılı, mesajı temizle

    } catch (error) {
        console.error("Katılımcıları yüklerken hata:", error);
        status.textContent = 'Katılımcılar yüklenirken bir hata oluştu.';
    }
}


// --- SAYFA GÜVENLİĞİ VE BAŞLATMA ---

// Güvenlik Kontrolü (Giriş yapılmış mı?)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- TEST İÇİN DOĞRULAMA ATLANDI (admin.js'deki gibi) ---
        // if (user.emailVerified) {
            console.log('Giriş yapıldı, sayfa yükleniyor...');
            document.body.classList.remove('auth-pending');
            loadPage(); // Ana fonksiyonu çalıştır
        // } else {
        //     console.log('E-posta doğrulanmamış, yönlendiriliyor...');
        //     window.location.href = 'login.html';
        // }
    } else {
        console.log('Kullanıcı giriş yapmamış, yönlendiriliyor...');
        window.location.href = 'login.html';
    }
});

// Çıkış Yapma Butonu (Her sayfada standart)
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('btn-logout');
    if(logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Çıkış yaparken hata oluştu:', error);
            }
        });
    }
});