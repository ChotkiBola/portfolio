// Eski izohlarni tekshirib, javob berilmaganlariga javob beradi.
//
// Ishlatish (brauzerda oching):
//   .../api/ig-backfill?key=<IG_VERIFY_TOKEN>          -> faqat ro'yxat, hech narsa yuborilmaydi
//   .../api/ig-backfill?key=<IG_VERIFY_TOKEN>&run=1    -> javoblarni haqiqatan yuboradi
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
  let r = await igGet(path);
  for (let i = 0; i < pages && r.ok; i++) {
    out.push(...(r.json.data || []));
    const next = r.json.paging?.next;
    if (!next) break;
    const res = await fetch(next, { headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` } });
    r = { ok: res.ok, json: await res.json().catch(() => ({})) };
  }
  return { ok: r.ok, data: out, error: r.json?.error?.message };
}

export async function GET(request) {
  const url = new URL(request.url);
  if (!process.env.IG_VERIFY_TOKEN || url.searchParams.get('key') !== process.env.IG_VERIFY_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }
  const run = url.searchParams.get('run') === '1';
  const posts = Math.min(Number(url.searchParams.get('posts')) || 25, 50);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 40);
  const igId = process.env.IG_USER_ID || '17841439662462785';
  const me = (process.env.IG_USERNAME || 'vaybbloger').toLowerCase();

  const media = await all(`/${igId}/media?fields=id,caption,timestamp,permalink&limit=${posts}`, 1);
  if (!media.ok) return Response.json({ ok: false, step: 'media', error: media.error }, { status: 502 });

  const results = [];
  let sent = 0;
  for (const m of media.data.slice(0, posts)) {
    const comments = await all(
      `/${m.id}/comments?fields=id,text,timestamp,username,from{id,username},replies{username,from{id}}&limit=50`
    );
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
      if (replied) continue;

      const fresh = Date.now() - new Date(c.timestamp).getTime() < 7 * DAY;
      const item = { post: m.permalink, user: author, text: c.text, action: fresh ? 'dm+reply' : 'reply-only' };
      if (sent >= limit) {
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
          const pub = await igPost(`/${c.id}/replies`, { message: pick(rule.publicReplies) });
          item.reply = pub.ok;
        } else {
          const pub = await igPost(`/${c.id}/replies`, { message: rule.lateReply || "DM'ga yozing, linkni yuboraman 📩" });
          item.reply = pub.ok;
        }
        await sleep(400);
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
