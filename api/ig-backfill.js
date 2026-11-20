// Eski izohlarni tekshirib, javob berilmaganlariga javob beradi.
//
// Ishlatish (brauzerda oching):
//   .../api/ig-backfill?key=<IG_VERIFY_TOKEN>          -> faqat ro'yxat, hech narsa yuborilmaydi
//   .../api/ig-backfill?key=<IG_VERIFY_TOKEN>&run=1    -> javoblarni haqiqatan yuboradi
// Bundan tashqari Vercel Cron har kuni 11:00 da (Toshkent) o'zi ishga tushiradi.
// Qo'shimcha: &posts=25 (nechta oxirgi post), &limit=20 (bir martada nechta javob)
//
// Instagram qoidasi: izohga shaxsiy xabarni faqat 7 kun ichida yuborish mumkin.
// Eskiroq izohlarga faqat ochiq javob yoziladi: "DM'ga osmon deb yozing".

import { log, igPost, igGet, sendMessage, sendGate } from './_lib/ig.js';
import { matchRule, pick } from './_lib/rules.js';

export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function all(path, pages = 3) {
  const out = [];
  let r = await igGet(path).catch((e) => ({ ok: false, json: { error: { message: e.message } } }));
  for (let i = 0; i < pages && r.ok; i++) {
    out.push(...(r.json.data || []));
    const next = r.json.paging?.next;
    if (!next) break;
    const res = await fetch(next, {
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` },
    }).catch(() => null);
    if (!res) break;
    r = { ok: res.ok, json: await res.json().catch(() => ({})) };
  }
  return { ok: r.ok, data: out, error: r.json?.error?.message };
}

export async function GET(request) {
  const url = new URL(request.url);
  const expected = (process.env.IG_VERIFY_TOKEN || '').trim();
  const given = (url.searchParams.get('key') || '').trim();
  // Vercel Cron har kuni o'zi chaqiradi (vercel.json). Bu so'rov faqat javobsiz izohlarga javob beradi.
  const fromCron = (request.headers.get('user-agent') || '').startsWith('vercel-cron');
  if (!fromCron && (!expected || given !== expected)) {
    return new Response(
      "Forbidden: kalit mos kelmadi. Vercel'dagi IG_VERIFY_TOKEN qiymatini aynan o'zini yozing " +
        `(siz ${given.length} ta belgi yozdingiz).`,
      { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
  const run = fromCron || url.searchParams.get('run') === '1';
  // Faqat DM'ni qayta urinish (ochiq javob allaqachon yozilgan izohlar uchun). Instagram bir izohga bitta DM'ga ruxsat beradi,
  // shuning uchun avval yetib borgan bo'lsa, qayta urinish shunchaki xato qaytaradi.
  // Xavfsizlik uchun faqat ko'rsatilgan foydalanuvchilarga: &retrydm=1&users=ali,vali
  const retryUsers = new Set(
    (url.searchParams.get('users') || '').toLowerCase().split(',').map((u) => u.trim()).filter(Boolean)
  );
  const retryDm = url.searchParams.get('retrydm') === '1' && retryUsers.size > 0;
  const started = Date.now();
  const posts = Math.min(Number(url.searchParams.get('posts')) || 15, 50);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 40);
  const igId = process.env.IG_USER_ID || '17841439662462785';
  const me = (process.env.IG_USERNAME || 'vaybbloger').toLowerCase();

  const media = await all(`/${igId}/media?fields=id,caption,timestamp,permalink&limit=${posts}`, 1);
  if (!media.ok) return Response.json({ ok: false, step: 'media', error: media.error }, { status: 502 });

  const results = [];
  let sent = 0;
  // Izohlarni hamma postlardan bir vaqtda olamiz (ketma-ket olish 60 soniyaga sig'maydi).
  const list = media.data.slice(0, posts);
  const allComments = await Promise.all(
    list.map((m) =>
      all(`/${m.id}/comments?fields=id,text,timestamp,username,from{id,username},replies{username,from{id}}&limit=50`, 2)
    )
  );
  for (const [i, m] of list.entries()) {
    const comments = allComments[i];
    if (!comments.ok) {
      results.push({ post: m.permalink, error: comments.error });
      continue;
    }
    for (const c of comments.data) {
      const author = (c.from?.username || c.username || '').toLowerCase();
      if (c.from?.id === igId || author === me) continue;
      const rule = matchRule(c.text);
      if (!rule) continue;
      const replied = (c.replies?.data || []).some(
        (r) => r.from?.id === igId || (r.username || '').toLowerCase() === me
      );
      const fresh = Date.now() - new Date(c.timestamp).getTime() < 7 * DAY;
      if (replied && retryDm && fresh && retryUsers.has(author)) {
        const dm = rule.followersOnly
          ? await sendGate(igId, { comment_id: c.id }, { ...rule, gateText: rule.commentText })
          : await sendMessage(igId, { comment_id: c.id }, rule.dm);
        results.push({ post: m.permalink, user: author, action: 'retry-dm', dm: dm.ok, error: dm.json?.error?.message });
        await sleep(250);
        continue;
      }
      if (replied) continue;

      const item = { post: m.permalink, user: author, text: c.text, action: fresh ? 'dm+reply' : 'reply-only' };
      if (sent >= limit || Date.now() - started > 45000) {
        item.action = 'keyingi safar';
        results.push(item);
        continue;
      }
      if (run) {
        if (fresh) {
          const dm = rule.followersOnly
            ? await sendGate(igId, { comment_id: c.id }, { ...rule, gateText: rule.commentText })
            : await sendMessage(igId, { comment_id: c.id }, rule.dm);
          item.dm = dm.ok;
          if (!dm.ok) item.dmError = dm.json?.error?.message;
          const pub = await igPost(`/${c.id}/replies`, { message: pick(rule.publicReplies) });
          item.reply = pub.ok;
        } else {
          const pub = await igPost(`/${c.id}/replies`, { message: rule.lateReply || "DM'ga yozing, linkni yuboraman 📩" });
          item.reply = pub.ok;
        }
        await sleep(250);
      }
      sent++;
      results.push(item);
    }
  }

  log('backfill', { run, found: results.length, sent: run ? sent : 0 });
  return Response.json({
    ok: true,
    mode: run ? 'YUBORILDI' : "SINOV (hech narsa yuborilmadi; yuborish uchun &run=1 qo'shing)",
    postsChecked: media.data.length,
    unanswered: results.length,
    results,
  });
}
