// 1. Gerekli fonksiyonları import et
import {
  auth,
  db,
  storage,
  doc,
  getDoc,
  setDoc, // handleHobbyUpdate için eklendi (veya updateDoc)
  addDoc,
  getDocs,
  collection,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  runTransaction,
  increment,
  Timestamp,
  serverTimestamp,
  where,
  limit,
  functions,      // AI çağırmak için
  httpsCallable   // AI çağırmak için
} from './auth.js';
import { 
  onAuthStateChanged, 
  signOut              
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
// Hobi dinleyicisi için onSnapshot'u import et
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


// 2. ROL KONTROL FONKSİYONU
async function setupUIForUser(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    let userRole = "user"; 
    let userDisplayName = user.displayName; 
    if (userDocSnap.exists()) {
        userRole = userDocSnap.data().role;
        userDisplayName = userDocSnap.data().displayName; 
    } else { console.warn("Kullanıcı rol bilgisi Firestore'da bulunamadı!"); }
    const createEventButton = document.getElementById('btn-create-event');
    const adminPanelButton = document.getElementById('btn-admin-panel'); 
    const userEmailElement = document.getElementById('user-email');
    if(userEmailElement) { userEmailElement.textContent = `Hoş geldin, ${userDisplayName}`; }
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
    return userRole; 
}


// 3. GÜVENLİK KONTROLÜ (GÜNCELLENDİ - Hobi dinleyicisi eklendi)
let _hobbyUnsub = null; // Hobi dinleyicisini tutmak için

onAuthStateChanged(auth, async (user) => {
  // Eski hobi dinleyicisini kapat (eğer varsa)
  if (_hobbyUnsub) { try { _hobbyUnsub(); } catch (_) {} _hobbyUnsub = null; }
  
  if (user) {
    console.log(`Giriş yapıldı: ${user.email}`);
    document.body.classList.remove('auth-pending'); // Sayfayı göster
    
    const userRole = await setupUIForUser(user);
    loadEvents(user, userRole);
    
    // AI Önerilerini yükle
    try { 
      await loadClubRecommendations(); 
    } catch (e) { 
      console.error("İlk AI öneri yüklemesinde hata:", e); 
    }

    // --- YENİ: Hobiler değişirse öneriyi F5’siz yenile ---
    const userDocRef = doc(db, "users", user.uid);
    let _lastHobbiesJSON = null;
    let _debounceTimer;
    
    _hobbyUnsub = onSnapshot(userDocRef, (snap) => {
      const hobbies = snap.data()?.hobbies || [];
      const nowJSON = JSON.stringify(hobbies);
      
      if (_lastHobbiesJSON === null) { // İlk yüklemede (null)
         _lastHobbiesJSON = nowJSON; // Sadece ata, çalıştırma (zaten üstte çalıştı)
         return;
      }
      if (nowJSON === _lastHobbiesJSON) return; // Hobiler değişmedi
      
      console.log("Hobiler değişti, öneriler 1sn sonra yenilenecek...");
      _lastHobbiesJSON = nowJSON;
      
      // Değişiklik olduğunda AI'ı tekrar çağırmak için debounce
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
          console.log("Debounce süresi doldu, AI önerileri yenileniyor...");
          loadClubRecommendations();
      }, 1000); // 1 saniye bekle
      
    }, (error) => {
        console.error("Hobi dinleme (onSnapshot) hatası:", error);
    });
    // --------------------------------------------------

  } else {
    // Çıkış yapıldı
    console.log('Kullanıcı giriş yapmamış, yönlendiriliyor...');
    document.body.classList.add('auth-pending'); // Sayfayı gizle
    window.location.href = 'login.html';
  }
});


// 4. ÇIKIŞ YAPMA, MODAL VE YENİ ETKİNLİK BUTONLARI
document.addEventListener('DOMContentLoaded', () => {
    
    // Çıkış Butonu
    const logoutButton = document.getElementById('btn-logout');
    if(logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await signOut(auth); window.location.href = 'login.html'; } 
            catch (error) { console.error('Çıkış yaparken hata oluştu:', error); }
        });
    }

    // Etkinlik Oluşturma Modal
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
    
    // Geri Bildirim Modal
    const feedbackModal = document.getElementById('feedback-modal');
    const openFeedbackButton = document.getElementById('btn-open-feedback');
    const closeFeedbackButton = document.getElementById('feedback-modal-close-button');
    const cancelFeedbackButton = document.getElementById('feedback-modal-cancel-button');
    const feedbackForm = document.getElementById('form-feedback');
    if(openFeedbackButton) openFeedbackButton.addEventListener('click', (e) => { e.preventDefault(); feedbackModal.style.display = 'block'; });
    if(closeFeedbackButton) closeFeedbackButton.addEventListener('click', () => feedbackModal.style.display = 'none');
    if(cancelFeedbackButton) cancelFeedbackButton.addEventListener('click', () => feedbackModal.style.display = 'none');
    if(feedbackModal) feedbackModal.addEventListener('click', (e) => { if (e.target === feedbackModal) feedbackModal.style.display = 'none'; });
    if(feedbackForm) feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    
    // Hobi Sohbet Modalı
    const hobbyChatModal = document.getElementById('hobby-chat-modal');
    const openHobbyChatButton = document.getElementById('btn-update-hobbies');
    const closeHobbyChatButton = document.getElementById('hobby-chat-modal-close-button');
    const hobbyChatForm = document.getElementById('form-hobby-chat');
    if(openHobbyChatButton) openHobbyChatButton.addEventListener('click', (e) => { 
        e.preventDefault(); 
        loadCurrentUserHobbies(); 
        hobbyChatModal.style.display = 'block'; 
    });
    if(closeHobbyChatButton) closeHobbyChatButton.addEventListener('click', () => hobbyChatModal.style.display = 'none');
    if(hobbyChatModal) hobbyChatModal.addEventListener('click', (e) => { if (e.target === hobbyChatModal) hobbyChatModal.style.display = 'none'; }); 
    if(hobbyChatForm) hobbyChatForm.addEventListener('submit', handleHobbyUpdate);
    
    // EVENT DELEGATION (İptal Et, Katıl, Vazgeç)
    const mainContent = document.querySelector('.main-content');

if (mainContent) {
  mainContent.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    if (!user) return;

    if (e.target.classList.contains('btn-cancel-event')) {
      e.preventDefault();
      const eventCard = e.target.closest('.event-card');
      if (!eventCard) return;
      const eventId = eventCard.dataset.id;
      const eventTitle = eventCard.querySelector('h2')?.textContent || '';
      if (confirm(`'${eventTitle}' etkinliğini İPTAL ETMEK istediğinizden emin misiniz?`)) {
        await cancelEvent(eventId, user);
      }
    }

    if (e.target.classList.contains('btn-join')) {
      e.preventDefault();
      e.target.disabled = true;
      e.target.textContent = "İşleniyor...";
      const card = e.target.closest('.event-card');
      if (!card) return;
      const eventId = card.dataset.id;
      await joinEvent(eventId, user);
    }

    if (e.target.classList.contains('btn-leave')) {
      e.preventDefault();
      e.target.disabled = true;
      e.target.textContent = "İşleniyor...";
      const card = e.target.closest('.event-card');
      if (!card) return;
      const eventId = card.dataset.id;
      await leaveEvent(eventId, user);
    }
  });
}

    });



// 5. ETKİNLİK FORMU GÖNDERME
async function handleEventFormSubmit(e) {
    e.preventDefault();
    const submitButton = document.getElementById('modal-submit-button');
    const eventDateInput = document.getElementById('event-date').value;
    const selectedDate = new Date(eventDateInput);
    if (selectedDate.getFullYear() < 1970) { showModalMessage('Geçersiz bir yıl girdiniz.', 'error'); return; }
    const today = new Date(); const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    if (selectedDate < tomorrow) { showModalMessage('Etkinlik tarihi en az 1 gün ileride olmalıdır.', 'error'); return; }
    const user = auth.currentUser;
    if (!user) { showModalMessage('Etkinlik oluşturmak için giriş yapmış olmalısınız.', 'error'); return; }
    submitButton.disabled = true; showModalMessage('Etkinlik oluşturuluyor...', 'loading');
    try {
        const title = document.getElementById('event-title').value;
        const description = document.getElementById('event-description').value;
        const capacity = document.getElementById('event-capacity').value;
        const location = document.getElementById('event-location').value;
        const bannerFile = document.getElementById('event-banner').files[0];
        const club = document.getElementById('event-club').value; 
        const tagsInput = document.getElementById('event-tags').value; 
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
        const storagePath = `event_banners/${Date.now()}_${bannerFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, bannerFile);
        const bannerURL = await getDownloadURL(storageRef);
        const eventsCollection = collection(db, "events");
        await addDoc(eventsCollection, {
            title: title, description: description, eventDate: Timestamp.fromDate(selectedDate), 
            capacity: parseInt(capacity), location: location, bannerURL: bannerURL,
            createdBy: user.uid, createdByName: user.displayName, createdAt: serverTimestamp(), 
            participantCount: 0, club: club, tags: tags,
            isCancelled: false, cancellationReason: "", cancelledAt: null,
            isFeatured: false 
        });
        showModalMessage('Etkinlik başarıyla oluşturuldu!', 'success');
        document.getElementById('create-event-form').reset();
        setTimeout(async () => {
            document.getElementById('create-event-modal').style.display = 'none';
            showModalMessage('', 'loading', true);
            const userRole = await setupUIForUser(user);
            loadEvents(user, userRole);
        }, 2000);
    } catch (error) { console.error("Etkinlik oluşturma hatası:", error); showModalMessage(`Hata: ${error.message}`, 'error'); } 
    finally { submitButton.disabled = false; }
}
function showModalMessage(message, type, hide = false) {
    const statusElement = document.getElementById('modal-status');
    if (hide) { statusElement.style.display = 'none'; return; }
    statusElement.textContent = message; statusElement.className = type;
    statusElement.style.display = 'block';
}


// 6. ETKİNLİKLERİ YÜKLEME
async function loadEvents(user, userRole) {
    const eventsFeed = document.getElementById('events-feed');
    const featuredEventSection = document.getElementById('featured-event');
    const pastEventsSection = document.getElementById('past-events');
    eventsFeed.innerHTML = '<h2>Yaklaşan Etkinlikler</h2>';
    featuredEventSection.innerHTML = '<h2>Öne Çıkan Etkinlik</h2>';
    pastEventsSection.innerHTML = '<h2>Geçmiş Etkinlikler</h2>';
    const now = Timestamp.now();
    let featuredEventRendered = false; 
    let featuredEventId = null; 
    let joinedEventIds = new Set();
    if (userRole === 'user') {
        try {
            const userEventsQuery = query(collection(db, `users/${user.uid}/joinedEvents`));
            const userEventsSnapshot = await getDocs(userEventsQuery);
            userEventsSnapshot.forEach(doc => { joinedEventIds.add(doc.id); });
        } catch (error) { console.error("Katıldığı etkinlikler alınırken hata:", error); }
    }
    try {
        const featuredQuery = query(collection(db, "events"), where("isFeatured", "==", true), limit(1));
        const featuredSnapshot = await getDocs(featuredQuery);
        if (!featuredSnapshot.empty) {
            const docSnap = featuredSnapshot.docs[0];
            let event = docSnap.data(); 
            event.id = docSnap.id;
            if (event.isCancelled === true || !isValidDate(event)) {
                 console.warn("Manuel öne çıkan etkinlik iptal edilmiş/bozuk, atlanıyor.");
            } else {
                console.log("Manuel öne çıkan bulundu:", event.title);
                featuredEventId = event.id;
                const isPast = event.eventDate.seconds < now.seconds;
                featuredEventSection.innerHTML += renderEventCardHTML(event, userRole, user, isPast, joinedEventIds.has(event.id)); 
                featuredEventRendered = true;
            }
        } else { console.log("Manuel öne çıkan etkinlik bulunamadı."); }
        const eventsCollectionRef = collection(db, "events");
        const querySnapshot = await getDocs(eventsCollectionRef); 
        let upcomingEvents = [];
        let pastEvents = [];
        querySnapshot.forEach(docSnap => {
            let event = docSnap.data();
            event.id = docSnap.id;
            if (event.isCancelled === true || event.id === featuredEventId || !isValidDate(event)) {
                return;
            }
            if (event.eventDate.seconds < now.seconds) {
                pastEvents.push(event);
            } else {
                upcomingEvents.push(event);
            }
        });
        upcomingEvents.sort((a, b) => a.eventDate.seconds - b.eventDate.seconds);
        pastEvents.sort((a, b) => b.eventDate.seconds - a.eventDate.seconds);
        if (!featuredEventRendered) {
            console.log("Manuel öne çıkan yok, otomatik seçiliyor...");
            if (upcomingEvents.length > 0) {
                const featuredEvent = upcomingEvents.shift(); 
                console.log("Otomatik öne çıkan (yaklaşan):", featuredEvent.title);
                featuredEventSection.innerHTML += renderEventCardHTML(featuredEvent, userRole, user, false, joinedEventIds.has(featuredEvent.id));
                featuredEventRendered = true;
            } else if (pastEvents.length > 0) {
                const featuredEvent = pastEvents.shift(); 
                console.log("Otomatik öne çıkan (geçmiş):", featuredEvent.title);
               featuredEventSection.innerHTML += renderEventCardHTML(featuredEvent, userRole, user, true, joinedEventIds.has(featuredEvent.id));
                featuredEventRendered = true;
            }
        }
        upcomingEvents.forEach(event => {
            eventsFeed.innerHTML += renderEventCardHTML(event, userRole, user, false, joinedEventIds.has(event.id));
        });
        pastEvents.forEach(event => {
          pastEventsSection.innerHTML += renderEventCardHTML(event, userRole, user, true, joinedEventIds.has(event.id));
        });
        if (!featuredEventRendered && featuredEventSection.children.length === 1) {
            featuredEventSection.innerHTML += '<p>Gösterilecek öne çıkan etkinlik bulunmuyor.</p>';
        }
        if (upcomingEvents.length === 0 && eventsFeed.children.length === 1) { 
             eventsFeed.innerHTML += '<p>Gösterilecek başka yaklaşan etkinlik bulunmuyor.</p>';
        }
        if (pastEvents.length === 0 && pastEventsSection.children.length === 1) {
             pastEventsSection.innerHTML += '<p>Gösterilecek geçmiş etkinlik bulunmuyor.</p>';
        }
    } catch (error) {
        console.error("Etkinlikleri yüklerken hata:", error);
        featuredEventSection.innerHTML += '<p style="color:red;">Etkinlikler yüklenirken bir hata oluştu.</p>';
        eventsFeed.innerHTML += '<p style="color:red;">Etkinlikler yüklenirken bir hata oluştu.</p>';
        pastEventsSection.innerHTML += '<p style="color:red;">Etkinlikler yüklenirken bir hata oluştu.</p>';
    }
}

// 7. RENDER EVENT CARD
function renderEventCardHTML(event, userRole, user, isPast = false, isJoined = false) {
    const eventDate = event.eventDate.toDate();
    const formattedDate = eventDate.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const participantCount = event.participantCount || 0;
    const capacity = event.capacity;
    const isFull = participantCount >= capacity;
    const quotaText = `${participantCount} / ${capacity} Kişi`;
    let actionButtonHTML = '';
    if (isPast) {
        actionButtonHTML = `<span style="font-weight: 600; color: #555;">GEÇMİŞ ETKİNLİK</span>`;
    } else if (userRole === 'admin' || userRole === 'manager') {
        actionButtonHTML = `<span style="font-weight: 600; color: #17a2b8;">YÖNETİCİ</span>`;
    } else if (isFull && !isJoined) {
        actionButtonHTML = `<a href="#" class="btn-join" disabled style="background-color:#dc3545; cursor:not-allowed;">KONTENJAN DOLU</a>`;
    } else if (isJoined) {
        actionButtonHTML = `<a href="#" class="btn-leave">Katılmaktan Vazgeç</a>`;
    } else {
        actionButtonHTML = `<a href="#" class="btn-join">Katıl</a>`;
    }
    const canManageEvent = (userRole === 'admin') || (userRole === 'manager' && event.createdBy === user.uid);
    const adminActionButtonHTML = canManageEvent
        ? `<button class="btn-cancel-event" data-id="${event.id}"><i class="fas fa-ban"></i> İptal Et</button>`
        : ''; 
    const clubHTML = event.club ? `<span><i class="fas fa-users-cog"></i> ${event.club}</span>` : '';
    let tagsHTML = '';
    if (event.tags && event.tags.length > 0) {
        tagsHTML += '<div class="event-card-tags">'; 
        event.tags.forEach(tag => { tagsHTML += `<span class="event-tag">${tag}</span>`; });
        tagsHTML += '</div>';
    }
    return `
        <div class="event-card" data-id="${event.id}">
            <img src="${event.bannerURL}" alt="${event.title}" class="event-card-banner">
            <div class="event-card-content">
                <a href="event-detail.html?id=${event.id}" class="event-title-link">
                    <h2>${event.title}</h2>
                </a>
                <div class="event-card-info">
                    <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>
                    <span><i class="fas fa-users"></i> ${quotaText}</span>
                    ${clubHTML}
                </div>
                ${tagsHTML} 
                <p>${event.description.substring(0, 100)}...</p>
                <div class="event-card-actions">
                    <span><i class="fas fa-user-tie"></i> ${event.createdByName}</span>
                    ${adminActionButtonHTML}
                    ${actionButtonHTML}
                </div>
            </div>
        </div>
    `;
}

// 8. DİĞER FONKSİYONLAR (İPTAL, KATIL, VAZGEÇ)
async function cancelEvent(eventId, user) {
    const reason = prompt("Etkinliği iptal etme nedeninizi girin (Katılımcılara e-posta ile bildirilecektir):");
    if (reason === null) { console.log("İptal işlemi durduruldu."); return; }
    console.log(`'${eventId}' ID'li etkinlik iptal ediliyor... Sebep: ${reason}`);
    try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
            isCancelled: true,
            cancellationReason: reason || "Belirtilmedi",
            cancelledAt: Timestamp.now()
        });
        console.log("Etkinlik başarıyla iptal edildi.");
        alert("Etkinlik başarıyla iptal edildi. Ana akıştan kaldırılıyor...");
        const userRole = await setupUIForUser(user);
        loadEvents(user, userRole);
    } catch (error) { console.error("Etkinlik iptal edilirken hata:", error); alert("Etkinlik iptal edilirken bir hata oluştu."); }
}
async function joinEvent(eventId, user) {
    const eventRef = doc(db, "events", eventId);
    const userEventRef = doc(db, `users/${user.uid}/joinedEvents`, eventId);
    const eventParticipantRef = doc(db, `events/${eventId}/participants`, user.uid);
    let userDisplayName = user.displayName; 
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().displayName) {
            userDisplayName = userDocSnap.data().displayName; 
        }
    } catch (e) { console.warn("Katılımcı ismi alınırken hata oluştu.", e); }
    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) { throw "Etkinlik bulunamadı!"; }
            const eventData = eventDoc.data();
            if (eventData.isCancelled) { throw "Bu etkinlik iptal edilmiş, katılamazsınız."; }
            const participantCount = eventData.participantCount || 0;
            if (participantCount >= eventData.capacity) { throw "Kontenjan dolu!"; }
            transaction.update(eventRef, { participantCount: increment(1) });
            transaction.set(userEventRef, {
                eventId: eventId, title: eventData.title, eventDate: eventData.eventDate, joinedAt: serverTimestamp()
            });
            transaction.set(eventParticipantRef, {
                uid: user.uid, displayName: userDisplayName, email: user.email, joinedAt: serverTimestamp()
            });
        });
        console.log("Kullanıcı etkinliğe katıldı!");
    } catch (error) {
        console.error("Katılma hatası:", error);
        if (error === "Kontenjan dolu!") { alert("Maalesef kontenjan dolmuş."); }
        else if (error === "Bu etkinlik iptal edilmiş, katılamazsınız.") { alert(error); }
        else { alert("Katılırken bir hata oluştu."); }
    } finally { const userRole = await setupUIForUser(user); loadEvents(user, userRole); }
}
async function leaveEvent(eventId, user) {
    const eventRef = doc(db, "events", eventId);
    const userEventRef = doc(db, `users/${user.uid}/joinedEvents`, eventId);
    const eventParticipantRef = doc(db, `events/${eventId}/participants`, user.uid);
    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (eventDoc.exists() && !eventDoc.data().isCancelled) {
                 transaction.update(eventRef, { participantCount: increment(-1) });
            }
            transaction.delete(userEventRef);
            transaction.delete(eventParticipantRef);
        });
        console.log("Kullanıcı etkinlikten ayrıldı!");
    } catch (error) { console.error("Ayrılma hatası:", error); alert("Ayrılırken bir hata oluştu."); }
    finally { const userRole = await setupUIForUser(user); loadEvents(user, userRole); }
}

// 9. YARDIMCI FONKSİYONLAR (GERİ BİLDİRİM, HOBİ, TARİH)
async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) { showFeedbackModalMessage('Giriş yapmalısınız.', 'error'); return; }
    const submitButton = document.getElementById('feedback-modal-submit-button');
    const feedbackType = document.getElementById('feedback-type').value;
    const feedbackMessage = document.getElementById('feedback-message').value;
    submitButton.disabled = true; showFeedbackModalMessage('Gönderiliyor...', 'loading');
    try {
        const feedbackCollection = collection(db, "feedback");
        await addDoc(feedbackCollection, {
            type: feedbackType, message: feedbackMessage, userId: user.uid,
            userEmail: user.email, userDisplayName: user.displayName || 'İsimsiz',
            createdAt: serverTimestamp(), status: "new"
        });
        showFeedbackModalMessage('Geri bildiriminiz için teşekkür ederiz!', 'success');
        document.getElementById('form-feedback').reset();
        setTimeout(() => {
            document.getElementById('feedback-modal').style.display = 'none';
            showFeedbackModalMessage('', 'loading', true);
        }, 2500);
    } catch (error) { console.error("Geri bildirim hatası:", error); showFeedbackModalMessage(`Hata: ${error.message}`, 'error'); } 
    finally { submitButton.disabled = false; }
}
function showFeedbackModalMessage(message, type, hide = false) {
    const statusElement = document.getElementById('feedback-modal-status');
    if (hide) { statusElement.style.display = 'none'; return; }
    statusElement.textContent = message; statusElement.className = type;
    statusElement.style.display = 'block';
}
function isValidDate(event) {
    if (event.eventDate && typeof event.eventDate.toDate === 'function') { return true; }
    if (!event.eventDate) { console.warn(`GEÇERSİZ TARİH (Boş): ID: ${event.id}. Atlanıyor.`); return false; }
    const dateObj = new Date(event.eventDate); 
    if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900) {
        event.eventDate = Timestamp.fromDate(dateObj); 
        return true;
    }
    console.warn(`BOZUK TARİH VERİSİ: ID: ${event.id}, Tarih: "${event.eventDate}". Atlanıyor.`);
    return false;
}
async function loadCurrentUserHobbies() {
    const user = auth.currentUser;
    const hobbyInput = document.getElementById('hobby-input');
    if (!user || !hobbyInput) return;
    hobbyInput.value = ''; 
    showHobbyChatMessage('', 'loading', true);
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().hobbies && userDocSnap.data().hobbies.length > 0) {
            hobbyInput.value = userDocSnap.data().hobbies.join(', ');
        } else { console.log("Kullanıcının kayıtlı hobisi bulunamadı."); }
    } catch (error) { console.error("Mevcut hobiler yüklenirken hata:", error); }
}
async function handleHobbyUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) { showHobbyChatMessage('Giriş yapmalısınız.', 'error'); return; }
    const submitButton = document.getElementById('hobby-chat-modal-submit-button');
    const hobbyInput = document.getElementById('hobby-input').value;
    submitButton.disabled = true; showHobbyChatMessage('Kaydediliyor...', 'loading');
    const hobbies = hobbyInput 
        ? hobbyInput.split(',')              
             .map(hobby => hobby.trim().toLowerCase()) 
             .filter(hobby => hobby !== '')     
        : []; 
    try {
        const userDocRef = doc(db, "users", user.uid);
        // setDoc + merge: Hobi alanı yoksa oluşturur, varsa üstüne yazar.
        await setDoc(userDocRef, { hobbies: hobbies }, { merge: true }); 
        // Not: onSnapshot dinleyicisi AI önerilerini otomatik tetikleyecek.
        showHobbyChatMessage('Hobileriniz başarıyla kaydedildi!', 'success');
        setTimeout(() => {
            document.getElementById('hobby-chat-modal').style.display = 'none';
            showHobbyChatMessage('', 'loading', true);
        }, 2000);
    } catch (error) { console.error("Hobiler güncellenirken hata:", error); showHobbyChatMessage(`Hata: ${error.message}`, 'error'); } 
    finally { submitButton.disabled = false; }
}
function showHobbyChatMessage(message, type, hide = false) {
    const statusElement = document.getElementById('hobby-chat-modal-status');
    if (hide || !statusElement) { 
        if(statusElement) statusElement.style.display = 'none';
        return; 
    }
    statusElement.textContent = message; statusElement.className = type;
    statusElement.style.display = 'block';
}

// 10. AI KULÜP ÖNERİ FONKSİYONU ÇAĞIRMA
// Timeout yardımcıları
function withTimeout(promise, ms, label = 'Promise') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
    );
  });
}
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// Kural tabanlı (Rule-based) hızlı yedek sistem
async function quickRuleBasedFallback() {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const hobbies = (snap.data()?.hobbies || []).map(h => String(h).toLowerCase());
    if (hobbies.length === 0) return []; // Hobisi yoksa boş dön

    const map = [
      { key: /yazılım|kod|program|bilgisayar|siber|ai|ml|robotik|arduino/, club: 'Bilişim Kulübü' },
      { key: /mekanik|elektrik|inşaat|endüstri|mühendis/, club: 'Mühendislik Kulüpleri' },
      { key: /tasarım|ui|ux|figma|grafik|illüstrasyon/, club: 'Tasarım Kulüpleri' },
      { key: /resim|müzik|tiyatro|fotoğraf|sanat/, club: 'Sanat Kulüpleri' },
      { key: /futbol|basket|voley|spor|fitness|koşu/, club: 'Spor Kulüpleri' },
      { key: /gönüllü|yardım|sosyal|toplum|sorumluluk/, club: 'Sosyal Sorumluluk Kulüpleri' },
      { key: /girişim|startup|kariyer|iş|network|cv/, club: 'Kariyer & Girişimcilik Kulüpleri' },
      { key: /hukuk|law|adalet/, club: 'Hukuk Kulübü' },
      { key: /psikoloji|psych|terapi|davranış/, club: 'Psikoloji Kulübü' },
      { key: /edebiyat|şiir|felsefe|philo|roman/, club: 'Edebiyat & Felsefe Kulüpleri' },
      { key: /erasmus|intl|uluslararası|yabancı|exchange/, club: 'Uluslararası Öğrenci Kulübü' },
    ];
    
    const scores = new Map();
    for (const m of map) {
        for (const h of hobbies) {
            if (m.key.test(h)) {
                scores.set(m.club, (scores.get(m.club) || 0) + 1);
            }
        }
    }
    // Skorlara göre sırala ve en iyi 3'ü al
    const sortedClubs = Array.from(scores.entries())
                             .sort((a, b) => b[1] - a[1]) // Skora göre büyükten küçüğe
                             .map(entry => entry[0])      // Sadece kulüp adını al
                             .slice(0, 3);                // İlk 3'ü al
    return sortedClubs;

  } catch (e) { 
      console.error("Kural tabanlı fallback hatası:", e);
      return []; // Hata olursa boş dön
  }
}

// AI Çağrısını yöneten ana fonksiyon
let _aiInFlight = false; // Aynı anda tek istek
async function loadClubRecommendations() {
  const recommendationsWidget = document.getElementById('club-recommendations');
  if (!recommendationsWidget) return; // Element yoksa çık
  const listElement = recommendationsWidget.querySelector('ul');
  const initialParagraph = recommendationsWidget.querySelector('p');
  if (!listElement || !initialParagraph) return; // Element yoksa çık

  // Aynı anda ikinci çağrıyı engelle
  if (_aiInFlight) {
      console.log("AI çağrısı zaten yapılıyor, bu istek atlandı.");
      return;
  }
  _aiInFlight = true; // Kilidi ayarla

  // UI'ı güncelle
  listElement.innerHTML = '<li>Yükleniyor...</li>';
  initialParagraph.textContent = 'Hobilerinize göre kulüp önerileri getiriliyor... (AI)';

  try {
    const getRecommendationsFunction = httpsCallable(functions, 'getClubRecommendationsGenkit');
    
   // Kullanıcının hobilerini al
const user = auth.currentUser;
let hobbies = [];

if (user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    hobbies = snap.data()?.hobbies || [];
  } catch (e) {
    console.warn("Hobiler okunamadı:", e);
  }
}

const result = await withTimeout(
  getRecommendationsFunction({ hobbies }),
  8000,
  'AI_Call'
);


    const recommendations = result?.data?.recommendations || [];
    listElement.innerHTML = ''; // Listeyi temizle

    if (recommendations.length > 0) {
      initialParagraph.textContent = 'İşte hobilerinize göre önerilen kulüpler:';
      recommendations.forEach(clubName => {
        const li = document.createElement('li');
        li.textContent = clubName;
        listElement.appendChild(li);
      });
    } else {
      // AI'dan boş döndü VEYA kural tabanlı fallback çalıştı ama bir şey bulamadı
      initialParagraph.textContent = 'Size özel kulüp önerisi bulunamadı. Hobilerinizi güncellediniz mi?';
      listElement.innerHTML = '<li>Öneri yok</li>';
    }

  } catch (error) {
    console.error("AI kulüp önerileri alınırken hata:", error);
    
    // Hata timeout ise veya başka bir "INTERNAL" hataysa
    if (
  String(error?.code || '').includes('internal') ||
  String(error?.message || '').includes('AI_Call_TIMEOUT')
) {
        console.warn("AI hatası veya timeout. Kural tabanlı yedek sisteme geçiliyor...");
        initialParagraph.textContent = 'AI yanıt vermedi. Basit öneriler getiriliyor:';
        listElement.innerHTML = '';
        const quickRecs = await quickRuleBasedFallback(); // Hızlı önerileri çağır
        
        if (quickRecs.length > 0) {
            quickRecs.forEach(c => {
                const li = document.createElement('li'); 
                li.textContent = c; 
                listElement.appendChild(li);
            });
        } else {
            initialParagraph.textContent = 'Size özel kulüp önerisi bulunamadı. Hobilerinizi güncellediniz mi?';
            listElement.innerHTML = '<li>Öneri yok</li>';
        }
    } else {
        // Diğer hatalar (örn: 'unauthenticated')
        initialParagraph.textContent = 'Öneriler getirilirken bir hata oluştu.';
        listElement.innerHTML = `<li>Hata: ${error.message}</li>`;
    }
  } finally {
      _aiInFlight = false; // Kilidi kaldır
  }
}