
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const nodemailer = require('nodemailer');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

// Genkit callable'ı içeri al ve export et
const { getClubRecommendationsGenkit } = require('./recommend.flow.js');
exports.getClubRecommendationsGenkit = getClubRecommendationsGenkit;

// --- E-POSTA GÖNDERME FONKSİYONU ---
exports.sendCancellationEmail = onDocumentUpdated(
  {
    region: 'europe-west1',
    document: 'events/{eventId}',
  },
  async (event) => {
    if (!event.data || !event.data.before || !event.data.after) {
      console.log('E-posta: Event verisi yok, fonksiyon atlanıyor.');
      return;
    }

    const eventData = event.data.after.data();
    const previousData = event.data.before.data();
    const eventId = event.params.eventId;
    const db = admin.firestore();

    if (eventData.isCancelled === true && previousData.isCancelled === false) {
      console.log(`E-posta: Etkinlik iptal edildi: ${eventId}. E-postalar hazırlanıyor...`);

      const gmailEmail = process.env.GMAIL_USER;
      const gmailPassword = process.env.GMAIL_PASS;
      if (!gmailEmail || !gmailPassword) {
        console.error('E-posta HATA: GMAIL_USER veya GMAIL_PASS tanımlı değil!');
        return;
      }

      const mailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailEmail, pass: gmailPassword },
      });

      const eventTitle = eventData.title;
      const reason = eventData.cancellationReason || 'Belirtilmedi';

      const participantsSnapshot = await db.collection(`events/${eventId}/participants`).get();
      if (participantsSnapshot.empty) {
        console.log('E-posta: Katılımcı yok, e-posta gönderilmedi.');
        return;
      }

      const participantEmails = [];
      participantsSnapshot.forEach((doc) => {
        participantEmails.push(doc.data().email);
      });

      const mailOptions = {
        from: `"DESE Etkinlik Sistemi" <${gmailEmail}>`,
        bcc: participantEmails.join(','),
        subject: `İPTAL: "${eventTitle}" Etkinliği İptal Edildi`,
        html: `<h1>Merhaba,</h1><p>Katılmış olduğunuz <strong>"${eventTitle}"</strong> etkinliği maalesef iptal edilmiştir.</p><hr><p><strong>İptal Nedeni:</strong></p><p><em>${reason}</em></p><hr><p>Anlayışınız için teşekkür ederiz.</p><p>DESE Yönetimi</p>`,
      };

      try {
        await mailTransport.sendMail(mailOptions);
        console.log(`E-posta: ${participantEmails.length} kişiye gönderildi.`);
      } catch (error) {
        console.error('E-posta: Gönderim hatası:', error);
      }
    }
  }
);