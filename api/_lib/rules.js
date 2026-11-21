// Kalit so'zlar va javoblar. Yangi kalit so'z qo'shish uchun shu faylni tahrirlash kifoya.
//
// keywords      - izoh yoki DM'da shu so'zlardan biri bo'lsa, qoida ishlaydi (katta-kichik harf, lotin/kirill farqi yo'q)
// publicReplies - izoh ostiga ochiq javob (har safar tasodifiy biri tanlanadi, bir xil bo'lib ko'rinmasin)
// dm            - shaxsiy xabar (izoh yozganga ham, DM yozganga ham shu boradi)
// enabled       - false bo'lsa, qoida o'chiq
// followersOnly - true bo'lsa, link faqat obunachilarga beriladi
// commentText   - izoh yozganga birinchi xabar ("Obuna bo'ldim" tugmasi bilan)
// gateText      - obuna bo'lmagan odamga xabar

const SITE = 'https://portfolio-nine-tau-3q07doew23.vercel.app';

export const RULES = [
  {
    name: 'osmon',
    enabled: true,
    // Faqat aniq kalit so'z: "link" kabi umumiy so'zlar boshqa reelslarda ham yozilsa, noto'g'ri link ketib qoladi.
    keywords: ['osmon', 'осмон', 'qor', 'қор'],
    // Izoh faqat "+" belgisidan iborat bo'lsa ham ishlaydi ("+", "++", "+ +").
    plus: true,
    followersOnly: true,
    gateButton: "Obuna bo'ldim ✅",
    commentText:
      "Salom! Osmon linkini obunachilarimga yuboraman 🙂\n\n" +
      "@vaybbloger'ga obuna bo'ling va pastdagi \"Obuna bo'ldim ✅\" tugmasini bosing.",
    gateText:
      "Hali obuna bo'lmagansiz 🙂 @vaybbloger'ga obuna bo'ling, keyin \"Obuna bo'ldim ✅\" tugmasini qayta bosing.",
    // DM yetib bormasa (yopiq akkaunt, cheklov va h.k.) izoh ostiga shu yoziladi
    dmFailedReply: "Sizga DM yoza olmadik 🙏 Iltimos, o'zingiz DM'ga \"osmon\" deb yozing, linkni darhol yuboraman 📩",
    // 7 kundan eski izohlar uchun (Instagram ularga shaxsiy xabar yuborishga ruxsat bermaydi)
    lateReply: "Kech qoldim 🙏 DM'ga \"osmon\" deb yozing, linkni darhol yuboraman 📩",
    publicReplies: [
      "DM'ga yubordim 📩",
      "Yubordim, DM'ni tekshiring 🙌",
      "Linkni DM'ga tashladim ❄️",
      "DM'da kutyapti 📩",
    ],
    dm:
      `Salom! Mana Osmon 👇\n${SITE}\n\n` +
      `"Bepul yuklab olish" tugmasini bosing. Windows ogohlantirish chiqarsa, ` +
      `"Подробнее" → "Выполнить в любом случае" ni bosing.\n\n` +
      `Yoqsa, do'stlaringizga ham ulashing 🙌`,
  },
  {
    name: 'qollanma',
    enabled: true,
    keywords: ["qo'llanma", 'qollanma', 'қўлланма', 'кулланма'],
    followersOnly: true,
    gateButton: "Obuna bo'ldim ✅",
    commentText:
      "Salom! Instagram skillari qo'llanmasini obunachilarimga yuboraman 🙂\n\n" +
      "@vaybbloger'ga obuna bo'ling va pastdagi \"Obuna bo'ldim ✅\" tugmasini bosing.",
    gateText:
      "Hali obuna bo'lmagansiz 🙂 @vaybbloger'ga obuna bo'ling, keyin \"Obuna bo'ldim ✅\" tugmasini qayta bosing.",
    dmFailedReply: "Sizga DM yoza olmadik 🙏 Iltimos, o'zingiz DM'ga \"qo'llanma\" deb yozing, darhol yuboraman 📩",
    lateReply: "Kech qoldim 🙏 DM'ga \"qo'llanma\" deb yozing, darhol yuboraman 📩",
    publicReplies: ["DM'ga yubordim 📩", "Yubordim, DM'ni tekshiring 🙌", "Qo'llanma DM'da 📩"],
    dm:
      "Mana Claude uchun 13 ta Instagram skill (bepul) 👇\n" +
      "https://github.com/Jakeschincariol/instagram-agent-skill\n\n" +
      "O'rnatish (eng osoni):\n" +
      "1. claude.ai yoki Claude ilovasini oching\n" +
      "2. Shu linkni yuboring va yozing: \"Install this skill, then confirm /ig-reel works.\"\n" +
      "3. Tayyor! /ig-profile, /ig-reel, /ig-plan deb yozib ishlating.\n\n" +
      "Claude Code'da: /plugin marketplace add Jakeschincariol/instagram-agent-skill\n\n" +
      "Savol bo'lsa shu yerga yozing 🙌",
  },
  {
    // Kurs tayyor bo'lganda: enabled: true qiling va dm matnini almashtiring.
    name: 'kurs',
    enabled: false,
    keywords: ['kurs', 'курс'],
    publicReplies: ["DM'ga yozdim 📩"],
    dm: "Salom! Kurs haqida ma'lumot: ...",
  },
  {
    // Promptlar tayyor bo'lganda yoqiladi.
    name: 'prompt',
    enabled: false,
    keywords: ['prompt', 'промпт'],
    publicReplies: ["DM'ga yubordim 📩"],
    dm: 'Salom! Mana promptlar: ...',
  },
];

// Kirillni lotinga yaqinlashtiramiz, shunda "ОСМОН" ham "osmon" bo'ladi.
const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h',
};

export function normalize(text = '') {
  // O'zbekcha apostrof variantlari (ʻ ’ ` ‘) bitta oddiy ' ga keltiriladi
  return [...String(text).toLowerCase().replace(/[ʻʼ’‘`´]/g, "'")].map((c) => CYR[c] ?? c).join('');
}

function words(text) {
  return normalize(text).split(/[^a-z0-9']+/).filter(Boolean);
}

export function matchRule(text) {
  const ws = new Set(words(text));
  const onlyPlus = /^[\s+]*\+[\s+]*$/.test(String(text));
  for (const rule of RULES) {
    if (!rule.enabled) continue;
    if (onlyPlus && rule.plus) return rule;
    if (rule.keywords.some((k) => ws.has(normalize(k)))) return rule;
  }
  return null;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function ruleByName(name) {
  return RULES.find((r) => r.enabled && r.name === name) || null;
}

// "Obuna bo'ldim" tugmasi ishlamagan holatda odam shunday yozishi mumkin.
const READY = ['tayyor', "bo'ldim", 'boldim', 'obuna', 'готово'];
export function isReadyWord(text) {
  const ws = words(text);
  return ws.length <= 4 && ws.some((w) => READY.map(normalize).includes(w));
}

export function defaultGatedRule() {
  return RULES.find((r) => r.enabled && r.followersOnly) || null;
}
