// 1. Gerekli fonksiyonları import et
// --- GÜNCELLENDİ: Her şey './auth.js' dosyasından geliyor ---
import { 
  auth, 
  db, 
  storage,
  doc, 
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  runTransaction,
  increment,
  setDoc,
  Timestamp,
  serverTimestamp // Hata veren fonksiyon artık burada
} from './auth.js';
// ----------------------------------------------------

import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
//  (Firebase Auth importları kalabilir, sorun değil)

import { 
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
// (Firebase Storage importları kalabilir, sorun değil)


// 2. ROL KONTROL FONKSİYONU (GÜNCELLENDİ - İsim hatası düzeltildi)
async function setupUIForUser(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    let userRole = "user"; 
    let userDisplayName = user.displayName; // Auth'dan gelen ismi varsay (örn: kayıt olanlar için)

    if (userDocSnap.exists()) {
        // Rolü Firestore'dan al
        userRole = userDocSnap.data().role;
        
        // --- HATA DÜZELTMESİ ---
        // İsmi, Auth'dan değil, Firestore'daki kayıttan al.
        // Bu, manuel eklediğin "Enes" ismini çekecektir.
        userDisplayName = userDocSnap.data().displayName; 
        // -------------------------

    } else {
        console.warn("Kullanıcı rol bilgisi Firestore'da bulunamadı!");
        // Firestore'da kaydı yoksa, Auth'daki ismi (null olabilir) kullanmaya devam et
    }

    const createEventButton = document.getElementById('btn-create-event');
    const adminPanelButton = document.getElementById('btn-admin-panel'); 
    const userEmailElement = document.getElementById('user-email');

    if(userEmailElement) {
        // Artık doğru ismi (userDisplayName) kullan
        userEmailElement.textContent = `Hoş geldin, ${userDisplayName}`;
    }

    // Rol kontrolleri (Değişiklik yok)
    if (userRole === "admin" || userRole === "manager") {
        if(createEventButton) createEventButton.style.display = "inline-block";
    } else {
        if(createEventButton) createEventButton.style.display = "none";
    }
    if (userRole === "admin") {
        if(adminPanelButton) adminPanelButton.style.display = "inline-block";
    } else {
        if(adminPanelButton) adminPanelButton.style.display = "none";
    }
    
    return userRole; // Fonksiyonun sonunda rolü döndür
}


/// 3. GÜVENLİK KONTROLÜ (GÜNCELLENDİ - E-POSTA KONTROLÜ GEÇİCİ OLARAK KALDIRILDI)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- KONTROL KALDIRILDI (Test için) ---
        // if (user.emailVerified) {
            console.log('Giriş yapıldı (Doğrulama atlandı):', user.email);

            const userRole = await setupUIForUser(user);
            loadEvents(user, userRole); 

            document.body.classList.remove('auth-pending');
        // } else {
        //     console.log('E-posta doğrulanmamış, yönlendiriliyor...');
        //     window.location.href = 'login.html';
        // }
        // -------------------------
    } else {
        console.log('Kullanıcı giriş yapmamış, yönlendiriliyor...');
        window.location.href = 'login.html';
    }
});


// 4. ÇIKIŞ YAPMA, MODAL VE YENİ ETKİNLİK BUTONLARI (GÜNCELLENDİ)
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Çıkış Butonu (Değişiklik yok) ---
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

    // --- Modal Kontrolleri (Değişiklik yok) ---
    const modal = document.getElementById('create-event-modal');
    const createEventButton = document.getElementById('btn-create-event');
    const closeModalButton = document.getElementById('modal-close-button');
    const cancelModalButton = document.getElementById('modal-cancel-button');
    const eventForm = document.getElementById('create-event-form');

    if(createEventButton) createEventButton.addEventListener('click', (e) => { e.preventDefault(); modal.style.display = 'block'; });
    if(closeModalButton) closeModalButton.addEventListener('click', () => modal.style.display = 'none');
    if(cancelModalButton) cancelModalButton.addEventListener('click', () => modal.style.display = 'none');
    if(modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    if(eventForm) eventForm.addEventListener('submit', handleEventFormSubmit);
    
    
    // --- GÜNCELLENDİ: EVENT DELEGATION (Sil, Katıl, Vazgeç) ---
    const mainContent = document.querySelector('.main-content');
    
    mainContent.addEventListener('click', async (e) => {
        const user = auth.currentUser;
        if (!user) return; // Giriş yapmamışsa hiçbir şey yapma

        // Tıklanan eleman 'Sil' butonu mu?
        if (e.target.classList.contains('btn-delete-event')) {
            e.preventDefault();
            const eventCard = e.target.closest('.event-card');
            const eventId = eventCard.dataset.id;
            const eventTitle = eventCard.querySelector('h2').textContent;
            if (confirm(`'${eventTitle}' etkinliğini silmek istediğinizden emin misiniz?`)) {
                await deleteEvent(eventId, user); // 'user' objesini yolla
            }
        }

        // --- YENİ: Tıklanan eleman 'Katıl' butonu mu? ---
        if (e.target.classList.contains('btn-join')) {
            e.preventDefault();
            e.target.disabled = true; // Butonu kilitle
            e.target.textContent = "İşleniyor...";
            const eventId = e.target.closest('.event-card').dataset.id;
            await joinEvent(eventId, user);
        }

        // --- YENİ: Tıklanan eleman 'Vazgeç' butonu mu? ---
        if (e.target.classList.contains('btn-leave')) {
            e.preventDefault();
            e.target.disabled = true; // Butonu kilitle
            e.target.textContent = "İşleniyor...";
            const eventId = e.target.closest('.event-card').dataset.id;
            await leaveEvent(eventId, user);
        }
    });
    // ---------------------------------------------
});


// 5. ETKİNLİK FORMU GÖNDERME (Değişiklik yok)
async function handleEventFormSubmit(e) {
    e.preventDefault();
    const submitButton = document.getElementById('modal-submit-button');
    const eventForm = document.getElementById('create-event-form');
    const eventDateInput = document.getElementById('event-date').value;

    // --- Tarih Doğrulaması (Değişiklik yok) ---
    const selectedDate = new Date(eventDateInput);
    if (selectedDate.getFullYear() < 1970) {
        showModalMessage('Geçersiz bir yıl girdiniz.', 'error');
        return;
    }
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (selectedDate < tomorrow) {
        showModalMessage('Etkinlik tarihi en az 1 gün ileride olmalıdır.', 'error');
        return;
    }
    // --- Tarih Doğrulaması Sonu ---

    const user = auth.currentUser;
    if (!user) {
        showModalMessage('Etkinlik oluşturmak için giriş yapmış olmalısınız.', 'error');
        return;
    }
    
    submitButton.disabled = true;
    showModalMessage('Etkinlik oluşturuluyor...', 'loading');

    try {
        const title = document.getElementById('event-title').value;
        const description = document.getElementById('event-description').value;
        const capacity = document.getElementById('event-capacity').value;
        const location = document.getElementById('event-location').value;
        const bannerFile = document.getElementById('event-banner').files[0];

        // 1. Resmi Yükle
        const storagePath = `event_banners/${Date.now()}_${bannerFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, bannerFile);
        const bannerURL = await getDownloadURL(storageRef);

        // 2. Veritabanına Kaydet
        const eventsCollection = collection(db, "events");
        await addDoc(eventsCollection, {
            title: title,
            description: description,
            eventDate: Timestamp.fromDate(selectedDate), // Firestore Timestamp olarak kaydet
            capacity: parseInt(capacity),
            location: location,
            bannerURL: bannerURL,
            createdBy: user.uid,
            createdByName: user.displayName,
            createdAt: serverTimestamp(), // Sunucu zamanı
            participantCount: 0 // Kontenjan takibi için
        });

        // 3. Başarı
        showModalMessage('Etkinlik başarıyla oluşturuldu!', 'success');
        eventForm.reset();
        
        setTimeout(async () => {
            document.getElementById('create-event-modal').style.display = 'none';
            showModalMessage('', 'loading', true);
            
            // Listeyi yenile (user ve role bilgisiyle)
            const userRole = await setupUIForUser(user);
            loadEvents(user, userRole);
        }, 2000);

    } catch (error) {
        console.error("Etkinlik oluşturma hatası:", error);
        showModalMessage(`Hata: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
    }
}
// Modal mesaj fonksiyonu (Değişiklik yok)
function showModalMessage(message, type, hide = false) {
    const statusElement = document.getElementById('modal-status');
    if (hide) {
        statusElement.style.display = 'none';
        return;
    }
    statusElement.textContent = message;
    statusElement.className = type;
    statusElement.style.display = 'block';
}


// 6. ETKİNLİKLERİ YÜKLEME (SON HATA DÜZELTMESİ EKLENDİ)
/**
 * @param {object} user - Giriş yapan kullanıcının tam 'auth' objesi
 * @param {string} userRole - Giriş yapan kullanıcının rolü ('admin', 'manager', 'user')
 */
async function loadEvents(user, userRole) {
    const eventsFeed = document.getElementById('events-feed');
    const featuredEventSection = document.getElementById('featured-event');
    const pastEventsSection = document.getElementById('past-events');
    
    eventsFeed.innerHTML = '<h2>Yaklaşan Etkinlikler</h2>';
    featuredEventSection.innerHTML = '<h2>Öne Çıkan Etkinlik</h2>';
    pastEventsSection.innerHTML = '<h2>Geçmiş Etkinlikler</h2>';

    let allEvents = [];
    const now = Timestamp.now(); // Firestore zamanı

    try {
        const eventsCollection = collection(db, "events");
        const querySnapshot = await getDocs(eventsCollection);

        if (querySnapshot.empty) {
            eventsFeed.innerHTML += '<p>Gösterilecek etkinlik bulunmuyor.</p>';
            return;
        }

        // Katılım Durumu Kontrolü (Değişiklik yok)
        let joinedEventIds = new Set();
        if (userRole === 'user') {
            const userEventsQuery = query(collection(db, `users/${user.uid}/joinedEvents`));
            const userEventsSnapshot = await getDocs(userEventsQuery);
            userEventsSnapshot.forEach(doc => {
                joinedEventIds.add(doc.id);
            });
        }
        // -----------------------------------------------------

        let upcomingEvents = [];
        let pastEvents = [];

        // --- GÜNCELLENDİ: TARİH DOĞRULAMASI (Bozuk Veri Filtresi) ---
        querySnapshot.forEach(docSnap => {
            const event = docSnap.data();
            event.id = docSnap.id;
            
            let eventTimestamp;

            if (event.eventDate && typeof event.eventDate.toDate === 'function') {
                // Bu yeni format (Timestamp), sorun yok.
                eventTimestamp = event.eventDate;
            
            } else {
                // Bu eski format (String), GÜVENLİ BİR ŞEKİLDE KONTROL ET
                const dateObj = new Date(event.eventDate); // String'i Date objesine çevir

                // getTime() (NaN) VE getFullYear() (Yıl 1 hatası) kontrolü
                if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900) {
                    
                    // Tarih geçerli, Timestamp'e çevir
                    eventTimestamp = Timestamp.fromDate(dateObj);
                    
                    // Render fonksiyonunun da işini kolaylaştırmak için ana objeyi de güncelle
                    event.eventDate = eventTimestamp;
                
                } else {
                    // BU, BOZUK VERİNİZ
                    console.warn(`
                        BOZUK VERİ TESPİT EDİLDİ: 
                        Etkinlik ID: ${event.id}
                        Geçersiz Tarih: "${event.eventDate}"
                        Bu etkinlik atlanıyor.
                        Lütfen bu etkinliği Firestore veritabanından manuel olarak silin.
                    `);
                    return; // Bu etkinliği atla
                }
            }
            // --- DÜZELTME SONU ---
            
            // Buraya gelindiyse 'eventTimestamp' mutlaka geçerlidir.
            if (eventTimestamp < now) {
                pastEvents.push(event);
            } else {
                upcomingEvents.push(event);
            }
        });

        // Sıralama (Değişiklik yok)
        upcomingEvents.sort((a, b) => a.eventDate - b.eventDate); // En yakın tarih
        pastEvents.sort((a, b) => b.eventDate - a.eventDate); // En yeni geçmiş

        // HTML'e dökme (Değişiklik yok)
        if (upcomingEvents.length > 0) {
            const featuredEvent = upcomingEvents.shift();
            featuredEventSection.innerHTML += renderEventCardHTML(featuredEvent, userRole, false, joinedEventIds.has(featuredEvent.id));
        } else if (pastEvents.length > 0) {
            const featuredEvent = pastEvents.shift();
            featuredEventSection.innerHTML += renderEventCardHTML(featuredEvent, userRole, true, joinedEventIds.has(featuredEvent.id));
        }

        upcomingEvents.forEach(event => {
            eventsFeed.innerHTML += renderEventCardHTML(event, userRole, false, joinedEventIds.has(event.id));
        });
        pastEvents.forEach(event => {
            pastEventsSection.innerHTML += renderEventCardHTML(event, userRole, true, joinedEventIds.has(event.id));
        });
        
        // Bölümleri boşsa mesaj ekle (İyileştirildi)
        if (upcomingEvents.length === 0 && featuredEventSection.children.length === 1) { // Sadece h2 varsa
             eventsFeed.innerHTML += '<p>Gösterilecek yaklaşan etkinlik bulunmuyor.</p>';
        }
        if (pastEvents.length === 0 && pastEventsSection.children.length === 1) {
             pastEventsSection.innerHTML += '<p>Gösterilecek geçmiş etkinlik bulunmuyor.</p>';
        }

    } catch (error) {
        console.error("Etkinlikleri yüklerken hata:", error);
        eventsFeed.innerHTML += '<p>Etkinlikler yüklenirken bir hata oluştu.</p>';
    }
}


// 7. RENDER EVENT CARD (SON HATA DÜZELTMESİ EKLENDİ)
/**
 * @param {boolean} isJoined - Kullanıcı bu etkinliğe katılmış mı?
 */
function renderEventCardHTML(event, userRole, isPast = false, isJoined = false) {
    
    // --- GÜNCELLENDİ: Artık 'event.eventDate'in bir Timestamp olduğundan eminiz.
    const eventDate = event.eventDate.toDate(); // Timestamp'i Date objesine çevir
    // --- DÜZELTME SONU ---

    const formattedDate = eventDate.toLocaleString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Kontenjan Sayacı (Değişiklik yok)
    const participantCount = event.participantCount || 0;
    const capacity = event.capacity;
    const isFull = participantCount >= capacity;
    const quotaText = `${participantCount} / ${capacity} Kişi`;

    // Eylem Butonu Mantığı (Kırmızı buton güncellemesi dahil)
    let actionButtonHTML = '';
    if (isPast) {
        actionButtonHTML = `<span style="font-weight: 600; color: #555;">GEÇMİŞ ETKİNLİK</span>`;
    } else if (userRole === 'admin' || userRole === 'manager') {
        actionButtonHTML = `<span style="font-weight: 600; color: #17a2b8;">YÖNETİCİ</span>`;
    } else if (isFull && !isJoined) {
        // Kırmızı 'KONTENJAN DOLU' butonu
        actionButtonHTML = `<a href="#" class="btn-join" disabled style="background-color:#dc3545; cursor:not-allowed;">KONTENJAN DOLU</a>`;
    } else if (isJoined) {
        actionButtonHTML = `<a href="#" class="btn-leave">Katılmaktan Vazgeç</a>`;
    } else {
        actionButtonHTML = `<a href="#" class="btn-join">Katıl</a>`;
    }
    // ---------------------------------

    const deleteButtonHTML = userRole === 'admin'
        ? `<button class="btn-delete-event" data-id="${event.id}"><i class="fas fa-trash-alt"></i> Sil</button>`
        : '';

    return `
        <div class="event-card" data-id="${event.id}">
            <img src="${event.bannerURL}" alt="${event.title}" class="event-card-banner">
            <div class="event-card-content">
                
                <a href="event-detail.html?id=${event.id}" class="event-title-link">
                    <h2>${event.title}</h2>
                </a>
                <div class="event-card-info">
                    ...
                    <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                    <span><i class="fas fa-users"></i> ${quotaText}</span>
                </div>
                <p>${event.description.substring(0, 100)}...</p>
                <div class="event-card-actions">
                    <span><i class="fas fa-user-tie"></i> ${event.createdByName}</span>
                    ${deleteButtonHTML}
                    ${actionButtonHTML}
                </div>
            </div>
        </div>
    `;
}


// 8. ETKİNLİK SİLME (Değişiklik yok)
async function deleteEvent(eventId, user) { // 'user' parametresi eklendi
    console.log(`'${eventId}' ID'li etkinlik siliniyor...`);
    try {
        const eventDocRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventDocRef);
        if (!eventSnap.exists()) {
            console.error("Silinecek belge bulunamadı."); return;
        }
        const eventData = eventSnap.data();
        const bannerURL = eventData.bannerURL;
        if (bannerURL) {
            try {
                const storageRef = ref(storage, bannerURL);
                await deleteObject(storageRef);
                console.log("Etkinlik afişi Storage'dan silindi.");
            } catch (storageError) {
                console.warn("Storage'dan afiş silinirken hata:", storageError.code);
            }
        }
        
        await deleteDoc(eventDocRef);
        console.log("Etkinlik belgesi Firestore'dan silindi.");
        
        // Listeyi yenile
        const userRole = await setupUIForUser(user);
        loadEvents(user, userRole);

    } catch (error) {
        console.error("Etkinlik silinirken ana hata:", error);
        alert("Etkinlik silinirken bir hata oluştu.");
    }
}


/**
 * Kullanıcıyı bir etkinliğe kaydeder (Transaction kullanarak)
 * (İSİMSİZ HATASI DÜZELTİLDİ)
 */
async function joinEvent(eventId, user) {
    const eventRef = doc(db, "events", eventId);
    const userEventRef = doc(db, `users/${user.uid}/joinedEvents`, eventId);
    const eventParticipantRef = doc(db, `events/${eventId}/participants`, user.uid);
    
    // --- YENİ: Kullanıcının gerçek ismini Firestore'dan al ---
    let userDisplayName = user.displayName; // Auth'dan gelen adı varsay (örn: e demir)
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        // Firestore'da kaydı varsa ve displayName doluysa, onu kullan
        if (userDocSnap.exists() && userDocSnap.data().displayName) {
            userDisplayName = userDocSnap.data().displayName; // Firestore'daki "gerçek" adı al
        }
    } catch (e) {
        console.warn("Katılımcı ismi Firestore'dan alınırken hata oluştu, Auth'daki isim kullanılacak.", e);
    }
    // ----------------------------------------------------

    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) {
                throw "Etkinlik bulunamadı!";
            }
            const eventData = eventDoc.data();
            const participantCount = eventData.participantCount || 0;
            
            if (participantCount >= eventData.capacity) {
                throw "Kontenjan dolu!";
            }
            
            // 1. Etkinliğin sayacını artır
            transaction.update(eventRef, {
                participantCount: increment(1)
            });
            
            // 2. Kullanıcının kendi katıldığı etkinlikler listesine ekle
            transaction.set(userEventRef, {
                eventId: eventId,
                title: eventData.title,
                eventDate: eventData.eventDate,
                joinedAt: serverTimestamp()
            });

            // --- GÜNCELLENDİ: 3. Etkinliğin katılımcı listesine DÜZGÜN İSMİ ekle ---
            transaction.set(eventParticipantRef, {
                uid: user.uid,
                displayName: userDisplayName, // <-- KULLANICININ GERÇEK ADI
                email: user.email,
                joinedAt: serverTimestamp()
            });
            // ---------------------------------------------------------
        });
        
        console.log("Kullanıcı etkinliğe katıldı!");
        
    } catch (error) {
        console.error("Katılma hatası:", error);
        alert(error === "Kontenjan dolu!" ? "Maalesef kontenjan dolmuş." : "Katılırken bir hata oluştu.");
    } finally {
        const userRole = await setupUIForUser(user);
        loadEvents(user, userRole);
    }
}

/**
 * Kullanıcının etkinlik kaydını siler (Transaction kullanarak)
 */
async function leaveEvent(eventId, user) {
    const eventRef = doc(db, "events", eventId);
    const userEventRef = doc(db, `users/${user.uid}/joinedEvents`, eventId);
    
    // --- YENİ: Etkinliğin katılımcı listesine referans ---
    const eventParticipantRef = doc(db, `events/${eventId}/participants`, user.uid);
    // --------------------------------------------------

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Etkinliğin sayacını azalt
            transaction.update(eventRef, {
                participantCount: increment(-1)
            });
            
            // 2. Kullanıcının kendi kaydını sil
            transaction.delete(userEventRef);

            // --- YENİ: 3. Etkinliğin katılımcı listesinden kullanıcıyı sil ---
            transaction.delete(eventParticipantRef);
            // -----------------------------------------------------------
        });
        
        console.log("Kullanıcı etkinlikten ayrıldı!");
        
    } catch (error) {
        console.error("Ayrılma hatası:", error);
        alert("Ayrılırken bir hata oluştu.");
    } finally {
        const userRole = await setupUIForUser(user);
        loadEvents(user, userRole);
    }
}