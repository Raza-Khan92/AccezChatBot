const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g

const EASTERN = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/** Arabic-Indic and Persian digits and separators to plain ASCII, so a number cannot hide in Arabic script. */
export function toAscii(s: string): string {
  return s
    .replace(/[٠-٩۰-۹]/g, (d) => String(Math.max(EASTERN.indexOf(d), PERSIAN.indexOf(d))))
    .replace(/٪/g, '%')
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
}

const ZERO_WIDTH = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad]/g
const ARABIC_MARKS = /[\u064b-\u065f\u0670\u0640]/g
const LOOKALIKE: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ѕ: 's', ј: 'j', һ: 'h', ԁ: 'd', ԛ: 'q', ɡ: 'g',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
  α: 'a', ε: 'e', ι: 'i', ο: 'o', ν: 'v', ρ: 'p', τ: 't', υ: 'u', Α: 'A', Β: 'B', Ε: 'E', Ο: 'O', Ρ: 'P', Τ: 'T',
}

/**
 * Normal form used by every output check: ASCII digits, compatibility forms folded, invisible characters and Arabic
 * diacritics removed, Cyrillic and Greek look-alikes turned into Latin letters. Checks run on this, never on raw text.
 */
export function fold(s: string): string {
  return toAscii(s)
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[\u0370-\u03ff\u0400-\u04ff\u0250-\u02af]/g, (ch) => LOOKALIKE[ch] ?? ch)
}

const norm = (s: string) => s.replace(/,/g, '')

/** Numbers in the reply that appear nowhere in the text the reply was allowed to draw on. */
export function ungroundedNumbers(reply: string, grounding: string): string[] {
  const known = new Set((fold(grounding).match(NUMBER_RE) ?? []).map(norm))
  return [...new Set((fold(reply).match(NUMBER_RE) ?? []).map(norm))].filter((n) => !known.has(n))
}

const NUMBER_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|twenty[- ]five|thirty|forty|fifty|hundred'

/** Phrases the assistant must never say. The owner ruled these out (English and Arabic wordings). */
const BANNED = [
  /\b400\s*(\+|plus)/i,
  /\+\s*400\b/,
  /\b400\s*(channels?|قنا[ةو]ات?|قنوات)/i,
  /(more than|over|أكثر من|اكثر من)\s*400\b/i,
  /\bcheckout\.com\b/i,
  // Which payment gateway applies, and what decides it, is not confirmed (owner ruling D-10).
  /(gateway|stripe|tap payments?)[^.\n]{0,80}\bdepends?\b[^.\n]{0,60}(account|settings?|set ?up|country|plan|region)/i,
  /(بوابة|بوابتي|الدفع)[^.\n]{0,80}(يعتمد|تعتمد|حسب)[^.\n]{0,60}(إعدادات|الحساب|حسابك|البلد|الخطة|الدولة)/,
  // Fee, commission and platform-fee percentages are never stated: the team may change them (owner ruling D-18).
  /(fee|fees|commission)[^.\n]{0,60}\d+(\.\d+)?\s?%|\d+(\.\d+)?\s?%[^.\n]{0,60}(fee|fees|commission)/i,
  new RegExp(`(fee|fees|commission)[^.\\n]{0,60}\\b(${NUMBER_WORDS})\\b[- ]*(per ?cent|percent|%)|\\b(${NUMBER_WORDS})\\b[- ]*(per ?cent|percent)[^.\\n]{0,60}(fee|fees|commission)`, 'i'),
  /\d+(\.\d+)?\s?%\s*(of|on|per|from)\s+(each|every|the|your|a|any)?\s*(booking|transaction|sale|payment|reservation|order)s?/i,
  /(رسوم|عمولة)[^.\n]{0,60}\d+(\.\d+)?\s?%|\d+(\.\d+)?\s?%[^.\n]{0,60}(رسوم|عمولة)/,
  /(رسوم|عمولة)[^.\n]{0,60}(بالمئة|بالمائة|في المئة|في المائة)/,
]

export function bannedPhrase(reply: string): string | null {
  const text = fold(reply)
  return BANNED.find((re) => re.test(text))?.source ?? null
}

/** Signs that internal prompt scaffolding leaked into the reply. */
export function leaksScaffolding(reply: string, boundary: string): boolean {
  const t = fold(reply)
  return t.includes(boundary) || /<\/?(context|user_message)\b/i.test(t) || /\bGUARDRAIL\b/i.test(t)
}

/**
 * Words that only appear when internals leak: code, infrastructure, secrets, the assistant's own makeup.
 * A reply containing any of these is rejected whatever the reason. Customers are told what Accez does, never how it is built.
 */
const INTERNAL = [
  /\bweb-?hooks?\b/i, /\bend-?points?\b/i, /\bcron\b/i, /\bmiddleware\b/i, /\bcontrollers?\b/i,
  /\bback-?end\b/i, /\bfront-?end\b/i, /\bdatabase\b/i, /\bstack ?trace\b/i, /\bsource ?code\b/i, /\bcode ?base\b/i,
  /\brepositor(y|ies)\b/i, /\bapi keys?\b/i, /\bsecret keys?\b/i, /\baccess tokens?\b/i, /\.env\b/i, /\blocalhost\b/i,
  /\bstaging\b/i, /\bsystem prompt\b/i, /\bmy (instructions|prompt|rules)\b/i, /\bknowledge base\b/i, /\bguardrails?\b/i,
  /\bgemini\b/i, /\bchat ?gpt\b/i, /\bopenai\b/i, /\bgoogle ai\b/i, /\blarge language model\b/i, /\bLLM\b/, /\bembeddings?\b/i,
  /\b\w+\.(tsx?|jsx?|mjs|json|sql)\b/i, /\b(controllers|middlewares?|routes)\//i,
  /ويب ?هوك/, /قاعدة (ال)?بيانات/, /الواجهة الخلفية/, /الكود المصدري/, /مفتاح (ال)?API/i, /موجّه النظام|تعليماتي/,
]
/** Same words with every space and separator removed, to catch "w e b h o o k" and "data-base". */
const SQUASHED = ['webhook', 'database', 'apikey', 'secretkey', 'systemprompt', 'sourcecode', 'codebase', 'chatgpt', 'openai', 'gemini', 'knowledgebase']

export function internalLeak(reply: string): string | null {
  const t = fold(reply)
  const hit = INTERNAL.find((re) => re.test(t))
  if (hit) return hit.source
  const squashed = t.toLowerCase().replace(/[\s._\-*|·•]+/g, '')
  return SQUASHED.find((w) => squashed.includes(w)) ?? null
}

/** Strips characters a visitor could use to fake the prompt's own structure or the model's control token. */
export function sanitizeUserText(t: string): string {
  return t.replace(ZERO_WIDTH, '').replace(/[<>]/g, ' ').replace(/\[\[\s*NO_ANSWER\s*\]\]/gi, ' ').replace(/\bGUARDRAIL\b/gi, ' ')
}

function luhnOk(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

/**
 * Removes things that must never be stored or sent to a model: card numbers (Luhn-checked), IBANs, API keys,
 * Saudi national ID or iqama numbers, and the value after "password", "PIN", "OTP" or "CVV".
 */
export function redact(text: string): string {
  return toAscii(text)
    .replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => (luhnOk(m.replace(/\D/g, '')) ? '[card number removed]' : m))
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, '[IBAN removed]')
    .replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\bAQ\.[A-Za-z0-9_.-]{20,}\b|\bAKIA[0-9A-Z]{16}\b/g, '[key removed]')
    .replace(/\b[12]\d{9}\b/g, '[ID removed]')
    .replace(/\b(password|passcode|pin|otp|cvv|cvc)\b(\s*(?:is|=|:)?\s*)\S+/gi, '$1 [removed]')
}

/**
 * True when a message looks like pasted code, a file's contents, a document dump or "read this link" (the assistant never reads
 * those). Checked before any model call, so pasted content is neither processed nor stored.
 */
export function looksLikeCodeOrFile(msg: string): boolean {
  if (/```/.test(msg)) return true
  if (/<\?xml|<!doctype|<html|<script|<\/?(div|body|head)\b/i.test(msg)) return true
  if (/\b(function|const|let|var|import|export|class|def|public|private|SELECT|INSERT|UPDATE|DELETE)\b[^\n]{0,80}[{(;=]/.test(msg) && /[{};]/.test(msg)) return true
  if ((msg.match(/[{};<>]/g) ?? []).length >= 6) return true
  if (/\S{120,}/.test(msg)) return true
  if (/https?:\/\/\S+/i.test(msg) && /\b(read|open|summari[sz]e|review|check|translate|analy[sz]e|look at)\b/i.test(msg)) return true
  return false
}

/**
 * Removes a trailing "are you a property manager or a provider?" question. Used when the facts are the same for everyone, so asking
 * is just friction. Works on a final paragraph or a final sentence, in English and Arabic.
 */
const ROLE_QUESTION = /(manage propert|run a (service )?business|property manager|service provider|salon|barber|clinic|rentals? or hotels?|تدير عقارات|مدير عقارات|مقدم خدمة|يقدم خدمات|صالون|عيادة)/i
export function stripRoleQuestion(reply: string): string {
  const isRoleQuestion = (t: string) => /[?؟]\s*$/.test(t) && ROLE_QUESTION.test(t)
  const paragraphs = reply.trim().split(/\n{2,}/)
  if (paragraphs.length > 1 && isRoleQuestion(paragraphs[paragraphs.length - 1]!)) return paragraphs.slice(0, -1).join('\n\n').trim()
  const sentences = reply.trim().split(/(?<=[.!?؟])\s+/)
  if (sentences.length > 1 && isRoleQuestion(sentences[sentences.length - 1]!)) return sentences.slice(0, -1).join(' ').trim()
  return reply
}

export const NO_ANSWER_TOKEN = '[[NO_ANSWER]]'

/** Removes the model's control token and reports whether it was there. Always call this BEFORE any other check on the reply. */
export function takeNoAnswer(raw: string): { text: string; flagged: boolean } {
  return { text: raw.replaceAll(NO_ANSWER_TOKEN, '').trim(), flagged: raw.includes(NO_ANSWER_TOKEN) }
}
