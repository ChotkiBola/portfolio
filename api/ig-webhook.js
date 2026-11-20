// Instagram izoh va DM'larga avtomatik javob beruvchi webhook.
// Meta shu manzilga xabar yuboradi: https://<sayt>/api/ig-webhook
//
// Vercel sozlamalaridagi o'zgaruvchilar (Settings → Environment Variables):
//   IG_VERIFY_TOKEN  - o'zingiz o'ylab topgan maxfiy so'z, Meta'dagi "Verify token" bilan bir xil
//   IG_APP_SECRET    - Meta ilovasining Instagram App Secret'i (imzoni tekshirish uchun)
//   IG_ACCESS_TOKEN  - Instagram akkaunt tokeni (Generate token tugmasi orqali olinadi)
//   IG_API_VERSION   - ixtiyoriy, standart: v25.0

import crypto from 'node:crypto';
import { matchRule, pick } from './_lib/rules.js';

const API = () => `https://graph.instagram.com/${process.env.IG_API_VERSION || 'v25.0'}`;

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
  await igPost(`/${igId}/messages`, { recipient: { comment_id: c.id }, message: { text: rule.dm } });
  await igPost(`/${c.id}/replies`, { message: pick(rule.publicReplies) });
}

// DM: kalit so'z bo'lsa tayyor javob, bo'lmasa jim turamiz (odamga o'zingiz javob berasiz).
async function handleMessage(igId, m) {
  const msg = m.message;
  if (!msg || msg.is_echo || !msg.text) return;
  if (m.sender?.id === igId) return;
  const rule = matchRule(msg.text);
  log('dm', { rule: rule?.name ?? null });
  if (!rule) return;
  await igPost(`/${igId}/messages`, { recipient: { id: m.sender.id }, message: { text: rule.dm } });
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
