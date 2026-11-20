// Instagram API yordamchi funksiyalari (webhook va eski izohlarni tekshirish uchun umumiy).
// Yangi Meta ilovalari "Unified login" ishlatadi: tizim tokeni faqat graph.facebook.com'da ishlaydi.
// Eski "Instagram login" tokenlari uchun IG_API_HOST=graph.instagram.com qo'yiladi.
export const API = () =>
  `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/${process.env.IG_API_VERSION || 'v25.0'}`;

export function log(event, data = {}) {
  console.log(JSON.stringify({ event, ...data }));
}

export async function igPost(path, body) {
  const res = await fetch(`${API()}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
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

export async function igGet(path) {
  const res = await fetch(`${API()}${path}`, {
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) log('ig_api_error', { path: path.split('?')[0], status: res.status, error: json.error?.message });
  return { ok: res.ok, json };
}

// Xabar yuborish: avval akkaunt ID orqali, ishlamasa /me orqali (login turiga qarab biri ishlaydi).
export async function sendRaw(igId, recipient, message) {
  const body = { recipient, message };
  const first = await igPost(`/${igId}/messages`, body);
  if (first.ok) return first;
  return igPost('/me/messages', body);
}

export const sendMessage = (igId, recipient, text) => sendRaw(igId, recipient, { text });

// "Obuna bo'ldim" tugmasi bilan xabar. Tugma ishlamasa, oddiy matn yuboriladi.
export async function sendGate(igId, recipient, rule) {
  const withButton = await sendRaw(igId, recipient, {
    text: rule.gateText,
    quick_replies: [{ content_type: 'text', title: rule.gateButton, payload: `CHECK:${rule.name}` }],
  });
  if (withButton.ok) return withButton;
  return sendMessage(igId, recipient, `${rule.gateText}\n\nObuna bo'lgach, shu yerga "tayyor" deb yozing.`);
}

