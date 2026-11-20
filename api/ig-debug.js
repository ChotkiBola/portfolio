// Vaqtinchalik: tokenning qaysi so'rovlarga ruxsati borligini tekshirish. Tekshiruvdan keyin o'chiriladi.
import { igGet, igPost } from './_lib/ig.js';

export const maxDuration = 30;

export async function GET(request) {
  if (!(request.headers.get('user-agent') || '').startsWith('vercel-cron')) return new Response('Forbidden', { status: 403 });
  const ig = process.env.IG_USER_ID || '17841439662462785';
  const probes = {
    me: await igGet('/me?fields=id,name'),
    meAccounts: await igGet('/me/accounts?fields=id,name,instagram_business_account'),
    igUser: await igGet(`/${ig}?fields=id,username`),
    igConversations: await igGet(`/${ig}/conversations?platform=instagram`),
    debugToken: await igGet(`/debug_token?input_token=${process.env.IG_ACCESS_TOKEN}`),
    sendViaIg: await igPost(`/${ig}/messages`, { recipient: { id: '0' }, message: { text: 'test' } }),
  };
  const out = {};
  for (const [k, v] of Object.entries(probes)) {
    const j = v.json || {};
    out[k] = v.ok
      ? k === 'debugToken'
        ? { type: j.data?.type, scopes: j.data?.scopes, granular: j.data?.granular_scopes }
        : j
      : { error: j.error?.message, code: j.error?.code, sub: j.error?.error_subcode };
  }
  return Response.json(out);
}
