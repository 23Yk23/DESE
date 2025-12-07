// 1. Gerekli fonksiyonları import et
import { 
  auth, 
  db,
  storage, 
  doc, 
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc, 
  Timestamp,
  runTransaction, // <-- EKLE
  where,          // <-- EKLE
  limit           // <-- EKLE
} from './auth.js';

import { 
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


function getEventIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Sayfayı yükleyen ana fonksiyon (GÜNCELLENDİ - İptal butonu eklendi)
 */
async function loadPage() {
    const eventId = getEventIdFromURL();
    if (!eventId) {
        document.getElementById('event-detail-container').innerHTML = '<p style="color:red; font-weight:bold;">Hata: Etkinlik ID bulunamadı.</p>';
        return;
    }

    const user = auth.currentUser;
    if (!user) return; 

    try {
        // --- 1. Adım: Kullanıcının Rolünü Öğren (Değişiklik yok) ---
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        let userRole = "user";
        let userDisplayName = user.displayName;
        if (userDocSnap.exists()) {
            userRole = userDocSnap.data().role;
            userDisplayName = userDocSnap.data().displayName;
        }
        const userEmailElement = document.getElementById('user-email');
        if(userEmailElement) {
            userEmailElement.textContent = `Hoş geldin, ${userDisplayName} (${userRole})`;
        }

        // --- 2. Adım: Etkinlik Detaylarını Çek (Değişiklik yok) ---
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) {
            document.getElementById('event-detail-container').innerHTML = '<p style="color:red; font-weight:bold;">Hata: Bu ID\'ye sahip bir etkinlik bulunamadı.</p>';
            return;
        }
        const event = eventSnap.data();

        // --- GÜNCELLENDİ: İptal Kontrolü ---
        if (event.isCancelled) {
            renderCancelledEventDetails(event); // İptal edilmiş etkinlik arayüzünü yükle
            document.getElementById('participant-list-section').style.display = 'none'; // Katılımcıları gizle
            return; // Fonksiyonun geri kalanını çalıştırma (Düzenle/İptal butonları yüklenmesin)
        }
        
        // --- Render fonksiyonunu eventId ile çağır ---
        renderEventDetails(event, eventId); 

     // --- 3. Adım: Rol Kontrolü ve Yönetimsel İşlemler (GÜNCELLENDİ - Manager Yetkisi) ---
        
        const editButton = document.getElementById('edit-event-button'); 
        const cancelButton = document.getElementById('btn-cancel-event-detail');
        const featureButton = document.getElementById('btn-feature-event'); 

        // Öne çıkan butonunun metnini ayarla (Bu kısım aynı kalıyor)
        if (event.isFeatured === true) {
            featureButton.textContent = "Öne Çıkanı Kaldır";
            featureButton.classList.add('featured');
        } else {
            featureButton.textContent = "Öne Çıkan Yap";
            featureButton.classList.remove('featured');
        }

        // --- YENİ YETKİ KONTROLÜ ---
        // Kullanıcı admin mi? VEYA Kullanıcı manager ve etkinliği O MU oluşturdu?
        const canManageEvent = (userRole === 'admin') || (userRole === 'manager' && event.createdBy === user.uid);
        // -------------------------

        if (canManageEvent) {
            // Yetkili ise: Katılımcı listesini ve butonları göster
            document.getElementById('participant-list-section').style.display = 'block';
            loadParticipants(eventId);

            if (editButton) editButton.style.display = 'inline-block'; 
            if (cancelButton) cancelButton.style.display = 'inline-block';
            if (featureButton) featureButton.style.display = 'inline-block'; 
        } else {
             // Yetkili DEĞİLSE: Butonları gizle (Katılımcı listesi zaten gizli kalır)
             if (editButton) editButton.style.display = 'none';
             if (cancelButton) cancelButton.style.display = 'none';
             if (featureButton) featureButton.style.display = 'none'; 
             // Eğer kullanıcı manager ama etkinliği o oluşturmadıysa, katılımcıları da gizleyelim
             if (userRole === 'manager'){
                 document.getElementById('participant-list-section').style.display = 'none';
             }
        }
        // --- Rol Kontrolü Sonu ---

    } catch (error) {
        console.error("Sayfa yüklenirken hata:", error);
        document.getElementById('event-detail-container').innerHTML = '<p style="color:red; font-weight:bold;">Hata: Veriler yüklenemedi.</p>';
    }
}
/**
 * Etkinlik detaylarını HTML'e basar (GÜNCELLENDİ - İptal Butonu Eklendi)
 * @param {object} event - Firestore'dan gelen etkinlik verisi
 * @param {string} eventId - Etkinliğin ID'si
 */
function renderEventDetails(event, eventId) { 
    const container = document.getElementById('event-detail-container');
    
    const eventDate = event.eventDate.toDate();
    const formattedDate = eventDate.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const quotaText = `${event.participantCount || 0} / ${event.capacity} Kişi`;
    const clubHTML = event.club ? `<span><i class="fas fa-users-cog"></i> ${event.club}</span>` : ''; // Kulüp eklendi

     // Etiketler eklendi
    let tagsHTML = '';
    if (event.tags && event.tags.length > 0) {
        tagsHTML += '<div class="event-card-tags" style="margin-bottom: 1.5rem;">'; // (main.css'den stil ödünç aldık)
        event.tags.forEach(tag => {
            tagsHTML += `<span class="event-tag">${tag}</span>`; 
        });
        tagsHTML += '</div>';
    }

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
                    ${clubHTML}
                </div>
                
                 ${tagsHTML} 

                  <div class="event-detail-admin-actions">
                    <button class="btn-edit-event" id="edit-event-button" style="display: none;">
                        <i class="fas fa-edit"></i> Etkinliği Düzenle
                    </button>
                    <button class="btn-cancel-event" id="btn-cancel-event-detail" style="display: none;">
                         <i class="fas fa-ban"></i> Etkinliği İptal Et
                    </button>
                    
                    <button class="btn-feature-event" id="btn-feature-event" style="display: none;">
                         <i class="fas fa-star"></i> Öne Çıkan Yap
                    </button>
                    </div>

                <div class="event-detail-description">
                    ${event.description ? `<p>${event.description.replace(/\\n/g, '<br>')}</p>` : '<p><em>Açıklama girilmemiş.</em></p>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * Katılımcı listesini yükler (Değişiklik yok)
 */
async function loadParticipants(eventId) {
     const listBody = document.getElementById('participant-list-body');
    const status = document.getElementById('participant-list-status');
    listBody.innerHTML = '';
    status.textContent = 'Katılımcılar yükleniyor...';
    try {
        const participantsRef = collection(db, `events/${eventId}/participants`);
        const q = query(participantsRef, orderBy("joinedAt", "asc")); 
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { status.textContent = 'Bu etkinliğe henüz katılan yok.'; return; }
        querySnapshot.forEach(docSnap => {
            const participant = docSnap.data();
            // joinedAt null olabilir, kontrol et
            const joinedDateStr = participant.joinedAt ? participant.joinedAt.toDate().toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : "Bilinmiyor";
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${participant.displayName || 'İsimsiz'}</td><td>${participant.email}</td><td>${joinedDateStr}</td>`;
            listBody.appendChild(tr);
        });
        status.textContent = '';
    } catch (error) { console.error("Katılımcıları yüklerken hata:", error); status.textContent = 'Katılımcılar yüklenirken bir hata oluştu.'; }
}


// --- SAYFA GÜVENLİĞİ VE BAŞLATMA (Değişiklik yok) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('Giriş yapıldı, sayfa yükleniyor...');
        document.body.classList.remove('auth-pending');
        loadPage(); 
    } else {
        console.log('Kullanıcı giriş yapmamış, yönlendiriliyor...');
        window.location.href = 'login.html';
    }
});

// --- DOMContentLoaded (GÜNCELLENDİ - İptal Butonu Eklendi) ---
document.addEventListener('DOMContentLoaded', () => {
    // Çıkış butonu (Değişiklik yok)
    const logoutButton = document.getElementById('btn-logout');
    if(logoutButton) {
        logoutButton.addEventListener('click', async (e) => { e.preventDefault(); try { await signOut(auth); window.location.href = 'login.html'; } catch (error) { console.error('Çıkış yaparken hata oluştu:', error); } });
    }

    // --- Düzenle ve İptal Butonu Olay Dinleyicisi (GÜNCELLENDİ) ---
// --- Olay Dinleyicisi (DÜZELTİLMİŞ YAPI) ---
        document.addEventListener('click', async (event) => {
        
        // 1. Düzenle Butonu mu?
        if (event.target && event.target.id === 'edit-event-button') {
            console.log("Düzenle butonuna tıklandı!");
            openEditModal(); 
            return; // Diğer if'leri kontrol etme
        }
        
        // 2. İptal Et Butonu mu?
        if (event.target && event.target.id === 'btn-cancel-event-detail') {
            console.log("Detay sayfası İptal Et butonuna tıklandı!");
            const eventId = getEventIdFromURL();
            const eventTitleElement = document.querySelector('.event-detail-content h2');
            if (!eventId || !eventTitleElement) return;
            const eventTitle = eventTitleElement.textContent.replace(" (İPTAL EDİLDİ)", ""); 
            
            if (confirm(`'${eventTitle}' etkinliğini İPTAL ETMEK istediğinizden emin misiniz?`)) { // Bildirim mesajı sadeleşti
                const user = auth.currentUser;
                if (user) {
                    await cancelEvent(eventId, user); 
                }
            }
            return; // Diğer if'leri kontrol etme
        }
        
        // 3. Öne Çıkan Yap Butonu mu? (Artık İPTAL'in DIŞINDA)
        if (event.target && event.target.id === 'btn-feature-event') {
            console.log("Öne Çıkan Yap butonuna tıklandı!");
            const eventId = getEventIdFromURL();
            if (!eventId) return; // ID yoksa dur
            // Butonun mevcut durumunu classList'ten kontrol et
            const isCurrentlyFeatured = event.target.classList.contains('featured');
            // Toggle fonksiyonunu çağır
            await toggleFeaturedEvent(eventId, isCurrentlyFeatured, event.target);
            // return; // Gerek yok, zaten son if
        }
        
    }); // <-- click listener sonu
    // --- Olay Dinleyicisi Sonu ---


    // --- Edit Modal Kapanma Olayları (Değişiklik yok) ---
    const editModal = document.getElementById('edit-event-modal');
    const editCloseButton = document.getElementById('edit-modal-close-button');
    const editCancelButton = document.getElementById('edit-modal-cancel-button');
    if(editCloseButton) editCloseButton.addEventListener('click', () => editModal.style.display = 'none');
    if(editCancelButton) editCancelButton.addEventListener('click', () => editModal.style.display = 'none');
    if(editModal) { editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.style.display = 'none'; }); }

    // --- Edit Form Gönderme Olayı (Değişiklik yok) ---
    const editEventForm = document.getElementById('edit-event-form');
    if (editEventForm) { editEventForm.addEventListener('submit', handleEditFormSubmit); }
});
// ===========================================
// --- YENİ EKLENEN VEYA GÜNCELLENEN FONKSİYONLAR ---
// ===========================================

/**
 * Düzenleme modalını açar ve formu mevcut etkinliğin verileriyle doldurur.
 * (GÜNCELLENDİ - Kapasite min değeri düzeltildi)
 */
async function openEditModal() {
    const eventId = getEventIdFromURL();
    if (!eventId) return;

    const modal = document.getElementById('edit-event-modal');
    const form = document.getElementById('edit-event-form');
    const status = document.getElementById('edit-modal-status');
    status.style.display = 'none'; 

    try {
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) { alert("Hata: Düzenlenecek etkinlik bulunamadı."); return; }
        const event = eventSnap.data();

        document.getElementById('edit-event-id').value = eventId; 
        document.getElementById('edit-event-title').value = event.title;
        document.getElementById('edit-event-description').value = event.description;
        
        const eventDate = event.eventDate.toDate();
        // Tarihi ISO formata (YYYY-MM-DDTHH:MM) çevirme (datetime-local için)
        const tzoffset = eventDate.getTimezoneOffset() * 60000; // timeZone offset (milisaniye)
        const localISOTime = (new Date(eventDate.getTime() - tzoffset)).toISOString().slice(0, 16);
        document.getElementById('edit-event-date').value = localISOTime;
        
        document.getElementById('edit-event-capacity').value = event.capacity;
        document.getElementById('edit-event-location').value = event.location;
        document.getElementById('edit-event-club').value = event.club || ""; 
        document.getElementById('edit-event-tags').value = event.tags ? event.tags.join(', ') : ""; 

        // DÜZELTME: min kapasite, mevcut katılımcı sayısı olmalı
        document.getElementById('edit-event-capacity').min = event.participantCount || 0;

        modal.style.display = 'block';

    } catch (error) { console.error("Düzenleme modalı açılırken hata:", error); alert("Etkinlik bilgileri yüklenirken bir hata oluştu."); }
}

/**
 * Düzenleme formunu işler ve Firestore'daki etkinliği günceller.
 * (Değişiklik yok)
 */
async function handleEditFormSubmit(e) {
    e.preventDefault();
    const saveButton = document.getElementById('edit-modal-save-button');
    const status = document.getElementById('edit-modal-status');
    const form = document.getElementById('edit-event-form');
    const eventId = document.getElementById('edit-event-id').value;
    if (!eventId) return;

    const newTitle = document.getElementById('edit-event-title').value;
    const newDescription = document.getElementById('edit-event-description').value;
    const newDateInput = document.getElementById('edit-event-date').value;
    const newCapacity = parseInt(document.getElementById('edit-event-capacity').value);
    const newLocation = document.getElementById('edit-event-location').value;
    const newClub = document.getElementById('edit-event-club').value;
    const newTagsInput = document.getElementById('edit-event-tags').value;
    const newBannerFile = document.getElementById('edit-event-banner').files[0]; 

    const newTags = newTagsInput ? newTagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];

    // Tarih doğrulama
    const newSelectedDate = new Date(newDateInput);
    if (newSelectedDate.getFullYear() < 1970) { showEditModalMessage('Geçersiz bir yıl girdiniz.', 'error'); return; }
    // Not: Tarihin geçmişe dönük olmaması kontrolü eklenebilir.

    saveButton.disabled = true;
    showEditModalMessage('Değişiklikler kaydediliyor...', 'loading');

    try {
        const eventRef = doc(db, "events", eventId);
        
        const eventSnap = await getDoc(eventRef); 
        if(!eventSnap.exists()){ throw new Error("Etkinlik bulunamadı."); }
        const currentData = eventSnap.data(); 
        const currentParticipantCount = currentData.participantCount || 0;
        if (newCapacity < currentParticipantCount) { throw new Error(`Kapasite, mevcut katılımcı sayısından (${currentParticipantCount}) az olamaz.`); }
        
        let finalBannerURL = currentData.bannerURL; 
        
        if (newBannerFile) {
            showEditModalMessage('Yeni afiş yükleniyor...', 'loading');
            
            const newStoragePath = `event_banners/${Date.now()}_${newBannerFile.name}`;
            const newStorageRef = ref(storage, newStoragePath);
            await uploadBytes(newStorageRef, newBannerFile);
            finalBannerURL = await getDownloadURL(newStorageRef); 
            console.log("Yeni afiş yüklendi:", finalBannerURL);

            const oldBannerURL = currentData.bannerURL;
            if (oldBannerURL) {
                try {
                    const oldStorageRef = ref(storage, oldBannerURL);
                    await deleteObject(oldStorageRef);
                    console.log("Eski afiş Storage'dan silindi.");
                } catch (deleteError) {
                    console.warn("Eski afiş silinirken hata (zaten silinmiş olabilir):", deleteError.code);
                }
            }
            showEditModalMessage('Afiş güncellendi, değişiklikler kaydediliyor...', 'loading');
        }

        await updateDoc(eventRef, {
            title: newTitle, 
            description: newDescription, 
            eventDate: Timestamp.fromDate(newSelectedDate), 
            capacity: newCapacity, 
            location: newLocation, 
            club: newClub, 
            tags: newTags,
            bannerURL: finalBannerURL 
        });

        showEditModalMessage('Değişiklikler başarıyla kaydedildi!', 'success');
        setTimeout(() => { 
            document.getElementById('edit-event-modal').style.display = 'none'; 
            showEditModalMessage('', 'loading', true); 
            loadPage(); // Sayfayı yenile
        }, 2000);

    } catch (error) { 
        console.error("Etkinlik güncelleme hatası:", error); 
        showEditModalMessage(`Hata: ${error.message}`, 'error'); 
    } 
    finally { saveButton.disabled = false; }
}

/**
 * Düzenleme modalı içinde durum mesajı gösterir (Değişiklik yok)
 */
function showEditModalMessage(message, type, hide = false) {
    const statusElement = document.getElementById('edit-modal-status');
    if (hide) { statusElement.style.display = 'none'; return; }
    statusElement.textContent = message; statusElement.className = type; statusElement.style.display = 'block';
}

/**
 * İptal edilmiş bir etkinliğin detaylarını (uyarıyla birlikte) HTML'e basar
 * (Değişiklik yok)
 */
function renderCancelledEventDetails(event) {
    const container = document.getElementById('event-detail-container');
    
    const eventDate = event.eventDate.toDate();
    const formattedDate = eventDate.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); 

    container.innerHTML = `
        <div class="event-detail-header" style="opacity: 0.6;">
            <img src="${event.bannerURL}" alt="${event.title}" class="event-detail-banner">
            <div class="event-detail-content">
                <h2>${event.title} <span style="color: red; font-weight: bold;">(İPTAL EDİLDİ)</span></h2>
                
                <div style="background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 8px; margin: 1.5rem 0;">
                    <strong>İptal Nedeni:</strong> ${event.cancellationReason || 'Belirtilmedi'}
                </div>

                <div class="event-detail-info" style="border: none; padding: 0;">
                    <span><i class="fas fa-calendar-alt"></i> Planlanan Tarih: ${formattedDate}</span>
                    <span><i class="fas fa-map-marker-alt"></i> Yer: ${event.location}</span>
                </div>

                <div class="event-detail-description" style="max-height: 200px;"> 
                    <p><strong>Orjinal Açıklama:</strong></p>
                    ${event.description ? `<p>${event.description.replace(/\\n/g, '<br>')}</p>` : '<p><em>Açıklama girilmemişti.</em></p>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * --- YENİ FONKSİYON ---
 * Bir etkinliği "iptal edildi" olarak işaretler (Detay sayfası için)
 * @param {string} eventId - İptal edilecek etkinliğin ID'si
 * @param {object} user - Giriş yapmış admin kullanıcısı
 */
async function cancelEvent(eventId, user) {
    const reason = prompt("Etkinliği iptal etme nedeninizi girin (Katılımcılara e-posta ile bildirilecektir):");
    if (reason === null) { 
        console.log("İptal işlemi kullanıcı tarafından durduruldu.");
        return; 
    }

    console.log(`'${eventId}' ID'li etkinlik iptal ediliyor... Sebep: ${reason}`);
    
    try {
        const eventRef = doc(db, "events", eventId);
        
        await updateDoc(eventRef, {
            isCancelled: true,
            cancellationReason: reason || "Belirtilmedi",
            cancelledAt: Timestamp.now() // İptal zamanı
        });

        console.log("Etkinlik başarıyla iptal edildi olarak işaretlendi.");
        alert("Etkinlik başarıyla iptal edildi. Sayfa yenileniyor...");

        // Sayfayı yenile (iptal edilmiş halini göstermek için)
        loadPage(); // Bu fonksiyon zaten event-detail.js'de tanımlı

    } catch (error) {
        console.error("Etkinlik iptal edilirken hata:", error);
        alert("Etkinlik iptal edilirken bir hata oluştu.");
    }
}

// --- EKLE: YENİ FONKSİYON: ÖNE ÇIKANI AYARLA ---
/**
 * Bir etkinliğin "Öne Çıkan" durumunu ayarlar.
 * Aynı anda sadece bir etkinliğin öne çıkmasını sağlamak için transaction kullanır.
 * @param {string} eventId - Öne çıkarılacak etkinliğin ID'si
 * @param {boolean} isCurrentlyFeatured - Bu etkinlik şu anda öne çıkan mı?
 * @param {HTMLElement} button - Tıklanan buton (metnini güncellemek için)
 */
// --- YENİ FONKSİYON: ÖNE ÇIKANI AYARLA (DÜZELTİLMİŞ) ---
/**
 * Bir etkinliğin "Öne Çıkan" durumunu ayarlar.
 * Aynı anda sadece bir etkinliğin öne çıkmasını sağlamak için transaction kullanır.
 * @param {string} eventId - Öne çıkarılacak/kaldırılacak etkinliğin ID'si
 * @param {boolean} isCurrentlyFeatured - Bu etkinlik şu anda öne çıkan mı?
 * @param {HTMLElement} button - Tıklanan buton (metnini güncellemek için)
 */
async function toggleFeaturedEvent(eventId, isCurrentlyFeatured, button) {
    button.disabled = true;
    button.textContent = "İşleniyor...";

    // --- DÜZELTME: Eski öne çıkanı transaction DIŞINDA bul ---
    let oldFeaturedEventId = null;
    if (!isCurrentlyFeatured) { // Sadece yeni bir tane eklerken eskisini ararız
        console.log("Eski öne çıkan aranıyor (transaction öncesi)...");
        const eventsCollection = collection(db, "events");
        const oldFeaturedQuery = query(eventsCollection, where("isFeatured", "==", true), limit(1));
        try {
            const oldFeaturedSnapshot = await getDocs(oldFeaturedQuery); // Normal getDocs kullan
            if (!oldFeaturedSnapshot.empty) {
                oldFeaturedEventId = oldFeaturedSnapshot.docs[0].id;
                console.log(`Eski öne çıkan bulundu: ${oldFeaturedEventId}`);
            } else {
                 console.log("Eski öne çıkan bulunamadı (ya da hiç yoktu).");
            }
        } catch(queryError){
            console.error("Eski öne çıkanı ararken hata:", queryError);
            alert("İşlem sırasında bir hata oluştu (Önceki öne çıkan bulunamadı).");
            button.disabled = false;
            button.textContent = isCurrentlyFeatured ? "Öne Çıkanı Kaldır" : "Öne Çıkan Yap";
            return; // Hata varsa işlemi durdur
        }
    }
    // --------------------------------------------------------

    try {
        await runTransaction(db, async (transaction) => {
            const eventRef = doc(db, "events", eventId); // İşlem yapılacak (yeni) etkinlik referansı

            if (isCurrentlyFeatured) {
                // --- Durum 1: Etkinlik ZATEN öne çıkan. Sadece bunu kaldır. ---
                console.log(`Öne Çıkan kaldırılıyor: ${eventId}`);
                transaction.update(eventRef, { isFeatured: false });
            
            } else {
                // --- Durum 2: Etkinlik öne çıkan DEĞİL. Bunu ekle, (varsa) eskiyi kaldır. ---
                
                // Eğer transaction DIŞINDA bir eski ID bulduysak:
                if (oldFeaturedEventId) {
                    console.log(`Transaction içinde eski öne çıkan kaldırılıyor: ${oldFeaturedEventId}`);
                    const oldEventRef = doc(db, "events", oldFeaturedEventId);
                    // Eski belgeyi transaction içinde GÜNCELLE
                    transaction.update(oldEventRef, { isFeatured: false }); 
                }

                // Şimdi bu (yeni) etkinliği öne çıkan yap.
                console.log(`Transaction içinde yeni etkinlik öne çıkan yapılıyor: ${eventId}`);
                transaction.update(eventRef, { isFeatured: true });
            }
        });

        // Başarılı: Butonun durumunu güncelle
        if (isCurrentlyFeatured) {
            button.textContent = "Öne Çıkan Yap";
            button.classList.remove('featured');
            alert("Etkinlik başarıyla öne çıkanlardan kaldırıldı.");
        } else {
            button.textContent = "Öne Çıkanı Kaldır";
            button.classList.add('featured');
            alert("Etkinlik başarıyla öne çıkan yapıldı.");
        }

    } catch (error) {
        console.error("Öne çıkan etkinlik ayarlanırken hata:", error);
        alert("Öne çıkan etkinlik ayarlanırken bir hata oluştu.");
        // Hata durumunda butonun metnini eski haline getir (değişiklik yok)
        if (isCurrentlyFeatured) {
            button.textContent = "Öne Çıkanı Kaldır";
        } else {
            button.textContent = "Öne Çıkan Yap";
        }
    } finally {
        button.disabled = false;
    }
}