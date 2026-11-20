// Instagram izoh va DM'larga avtomatik javob beruvchi webhook.
// Meta shu manzilga xabar yuboradi: https://<sayt>/api/ig-webhook
//
// Vercel sozlamalaridagi o'zgaruvchilar (Settings → Environment Variables):
//   IG_VERIFY_TOKEN  - o'zingiz o'ylab topgan maxfiy so'z, Meta'dagi "Verify token" bilan bir xil
//   IG_APP_SECRET    - Meta ilovasining App Secret'i: Настройки приложения → Основное (imzoni tekshirish uchun)
//   IG_ACCESS_TOKEN  - konfiguratsiyadan olingan tizim tokeni (muddati tugamaydi)
//   IG_API_HOST      - ixtiyoriy, standart: graph.facebook.com
//   IG_API_VERSION   - ixtiyoriy, standart: v25.0

import crypto from 'node:crypto';
import { matchRule, pick, ruleByName, isReadyWord, defaultGatedRule } from './_lib/rules.js';

// Yangi Meta ilovalari "Unified login" ishlatadi: tizim tokeni faqat graph.facebook.com'da ishlaydi.
// Eski "Instagram login" tokenlari uchun IG_API_HOST=graph.instagram.com qo'yiladi.
const API = () =>
  `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/${process.env.IG_API_VERSION || 'v25.0'}`;

function log(event, data = {}) {
  console.log(JSON.stringify({ event, ...data }));
}

async function igPost(path, body) {
  const res = await fetch(`${API()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) log('ig_api_error', { path, status: res.status, error: json.error?.message });
  return { ok: res.ok, json };
}

async function igGet(path) {
  const res = await fetch(`${API()}${path}`, {
    headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) log('ig_api_error', { path: path.split('?')[0], status: res.status, error: json.error?.message });
  return { ok: res.ok, json };
}

// Xabar yuborish: avval akkaunt ID orqali, ishlamasa /me orqali (login turiga qarab biri ishlaydi).
async function sendRaw(igId, recipient, message) {
  const body = { recipient, message };
  const first = await igPost(`/${igId}/messages`, body);
  if (first.ok) return first;
  return igPost('/me/messages', body);
}

const sendMessage = (igId, recipient, text) => sendRaw(igId, recipient, { text });

// "Obuna bo'ldim" tugmasi bilan xabar. Tugma ishlamasa, oddiy matn yuboriladi.
async function sendGate(igId, recipient, rule) {
  const withButton = await sendRaw(igId, recipient, {
    text: rule.gateText,
    quick_replies: [{ content_type: 'text', title: rule.gateButton, payload: `CHECK:${rule.name}` }],
  });
  if (withButton.ok) return withButton;
  return sendMessage(igId, recipient, `${rule.gateText}\n\nObuna bo'lgach, shu yerga "tayyor" deb yozing.`);
}

// Obunachimi? Bilib bo'lmasa (API xatosi) null qaytaradi.
async function isFollower(igsid) {
  const r = await igGet(`/${igsid}?fields=is_user_follow_business`);
  if (!r.ok || typeof r.json.is_user_follow_business !== 'boolean') return null;
  return r.json.is_user_follow_business;
}

// Obunachiga linkni beradi, obuna bo'lmaganga avval obuna bo'lishni so'raydi.
async function deliver(igId, igsid, rule) {
  if (!rule.followersOnly) return sendMessage(igId, { id: igsid }, rule.dm);
  const follows = await isFollower(igsid);
  log('follow_check', { rule: rule.name, follows });
  // Instagram javob bermasa, odamni bloklamaymiz: linkni beramiz.
  if (follows === false) return sendGate(igId, { id: igsid }, rule);
  return sendMessage(igId, { id: igsid }, rule.dm);
}

function validSignature(raw, header) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Izoh: ochiq javob + shaxsiy xabar (har bir izohga Instagram faqat bitta shaxsiy javob ruxsat beradi).
async function handleComment(igId, c) {
  if (!c?.id || !c.text) return;
  if (c.from?.id === igId) return; // o'zimizning javoblarimiz
  const rule = matchRule(c.text);
  log('comment', { user: c.from?.username, rule: rule?.name ?? null });
  if (!rule) return;
  // Izohga shaxsiy javobda obunani tekshirib bo'lmaydi: odam hali yozishmagan.
  // Shuning uchun obuna sharti bo'lsa, avval tugma yuboramiz; tugmani bosganda tekshiramiz.
  if (rule.followersOnly) await sendGate(igId, { comment_id: c.id }, { ...rule, gateText: rule.commentText });
  else await sendMessage(igId, { comment_id: c.id }, rule.dm);
  await igPost(`/${c.id}/replies`, { message: pick(rule.publicReplies) });
}

// DM: kalit so'z bo'lsa tayyor javob, bo'lmasa jim turamiz (odamga o'zingiz javob berasiz).
async function handleMessage(igId, m) {
  const msg = m.message;
  if (!msg || msg.is_echo) return;
  if (m.sender?.id === igId) return;
  const payload = msg.quick_reply?.payload || m.postback?.payload || '';
  let rule = null;
  if (payload.startsWith('CHECK:')) rule = ruleByName(payload.slice(6));
  else if (msg.text) rule = matchRule(msg.text) || (isReadyWord(msg.text) ? defaultGatedRule() : null);
  log('dm', { rule: rule?.name ?? null, button: Boolean(payload) });
  if (!rule) return;
  await deliver(igId, m.sender.id, rule);
}

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  if (mode === 'subscribe') {
    const ok = url.searchParams.get('hub.verify_token') === process.env.IG_VERIFY_TOKEN;
    log('verify', { ok });
    return ok
      ? new Response(url.searchParams.get('hub.challenge'), { status: 200 })
      : new Response('Forbidden', { status: 403 });
  }
  // Holat tekshiruvi: maxfiy qiymatlarni ko'rsatmaydi, faqat bor-yo'qligini.
  return Response.json({
    ok: true,
    verifyToken: Boolean(process.env.IG_VERIFY_TOKEN),
    appSecret: Boolean(process.env.IG_APP_SECRET),
    accessToken: Boolean(process.env.IG_ACCESS_TOKEN),
  });
}

export async function POST(request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) {
    log('bad_signature');
    return new Response('Bad signature', { status: 401 });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const entries = Array.isArray(body) ? body.flatMap((b) => b.entry || []) : body.entry || [];
  for (const entry of entries) {
    const igId = entry.id;
    try {
      for (const ch of entry.changes || []) if (ch.field === 'comments') await handleComment(igId, ch.value);
      if (entry.field === 'comments') await handleComment(igId, entry.value);
      for (const m of entry.messaging || []) await handleMessage(igId, m);
    } catch (e) {
      log('handler_error', { message: e.message });
    }
  }
  // Meta 200 olmasa qayta-qayta yuboradi, shuning uchun har doim 200 qaytaramiz.
  return new Response('EVENT_RECEIVED', { status: 200 });
}
