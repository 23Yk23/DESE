// functions/recommend.flow.js  (CommonJS, Genkit YOK)

const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// (Opsiyonel) OpenAI; yoksa fallback çalışır
let OpenAI = null;
try { OpenAI = require('openai'); } catch (_) {}
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

const AVAILABLE_CLUBS = [
  'Bilişim Kulübü',
  'Mühendislik Kulüpleri',
  'Tasarım Kulüpleri',
  'Sanat Kulüpleri',
  'Spor Kulüpleri',
  'Sosyal Sorumluluk Kulüpleri',
  'Kariyer & Girişimcilik Kulüpleri',
  'Hukuk Kulübü',
  'Psikoloji Kulübü',
  'Edebiyat & Felsefe Kulüpleri',
  'Uluslararası Öğrenci Kulübü',
];

const RULES = [
  { kw: ['yazılım','coding','programlama','web','mobil','ai','ml','robotik','arduino','siber'], club: 'Bilişim Kulübü' },
  { kw: ['makine','elektrik','inşaat','endüstri','mühendis'], club: 'Mühendislik Kulüpleri' },
  { kw: ['tasarım','ui','ux','figma','grafik','illüstrasyon'], club: 'Tasarım Kulüpleri' },
  { kw: ['resim','müzik','tiyatro','fotoğraf','sanat'], club: 'Sanat Kulüpleri' },
  { kw: ['futbol','basket','voleybol','fitness','koşu','spor'], club: 'Spor Kulüpleri' },
  { kw: ['yardım','gönüllü','sosyal','toplum','sorumluluk'], club: 'Sosyal Sorumluluk Kulüpleri' },
  { kw: ['girişim','startup','kariyer','network','cv','iş'], club: 'Kariyer & Girişimcilik Kulüpleri' },
  { kw: ['hukuk','law','adalet','mahkeme'], club: 'Hukuk Kulübü' },
  { kw: ['psikoloji','mindfulness','terapi','davranış','insan'], club: 'Psikoloji Kulübü' },
  { kw: ['edebiyat','şiir','roman','yazar','felsefe'], club: 'Edebiyat & Felsefe Kulüpleri' },
  { kw: ['erasmus','exchange','uluslararası','international','english','yabancı'], club: 'Uluslararası Öğrenci Kulübü' },
];

function scoreClubs(hobbies) {
  const scores = new Map(AVAILABLE_CLUBS.map(c => [c, 0]));
  const tokens = hobbies.map(h => String(h).toLowerCase());
  for (const { kw, club } of RULES) {
    for (const t of tokens) {
      if (kw.some(k => t.includes(k))) {
        scores.set(club, (scores.get(club) || 0) + 1);
      }
    }
  }
  return [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);
}

async function llmRecommendWithOpenAI(hobbies) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sys = `You are a strict selector. Choose at most 3 clubs ONLY from the given list. Return a JSON like {"clubs":["..."]}.`;
  const usr = `Hobbies: ${hobbies.join(', ')}\nClubs: ${AVAILABLE_CLUBS.join(', ')}`;
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
  });
  const text = resp.choices[0]?.message?.content || '{}';
  let clubs = [];
  try { clubs = JSON.parse(text).clubs ?? []; } catch {}
  return clubs.filter(c => AVAILABLE_CLUBS.includes(c)).slice(0, 3);
}

exports.getClubRecommendationsGenkit = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    secrets: [OPENAI_API_KEY],
    enforceAppCheck: false,
  },
  async (req) => {
    const uid = req?.auth?.uid;
    if (!uid) return { recommendations: [] };

    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data() || {};
    const hobbies = Array.isArray(data.hobbies) ? data.hobbies : [];
    if (hobbies.length === 0) return { recommendations: [] };

    try {
      const viaLLM = await llmRecommendWithOpenAI(hobbies);
      if (viaLLM && viaLLM.length) return { recommendations: viaLLM };
    } catch (e) {
      console.error('OpenAI çağrısı hatası:', e);
    }
    return { recommendations: scoreClubs(hobbies) };
  }
);
