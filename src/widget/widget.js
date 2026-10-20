(() => {
  const $ = (id) => document.getElementById(id)
  const app = $('app'), panel = $('panel'), log = $('log'), chips = $('chips')
  const input = $('input'), composer = $('composer'), toggle = $('toggle'), closeBtn = $('close')

  /* ---------- language ---------- */
  const STR = {
    en: {
      title: 'Accez Assistant', online: 'Online', placeholder: 'Type a message...', typeMsg: 'Type a message', send: 'Send message',
      close: 'Close chat', open: 'Open chat', dialog: 'Accez Assistant chat', typing: 'Accez Assistant is typing',
      greeting: app.dataset.greeting,
      chips: [
        ['I manage properties', 'I manage properties and want to learn about the Accez property management system'],
        ['I run a service business', 'I run a business that takes bookings for services and want to learn how Accez works for me'],
        ['Pricing and plans', 'How much does Accez cost?'],
        ['Talk to the team', "I'd like to talk to the Accez team"],
      ],
      talkTeam: 'Talk to the team', rate: "You're sending messages quickly. Give me a moment and try again.",
      error: 'Something went wrong on my side. Please try again in a moment.', network: "I couldn't reach the server. Please check your connection and try again.",
      f: { first: 'First name', last: 'Last name', email: 'Email', phone: 'Phone number', iam: 'I am a', company: 'Company', city: 'City', message: 'How can we help? (optional)', submit: 'Send to the team' },
      roles: { property_manager: 'I manage properties (property manager, landlord, hotel)', property_owner: 'I own property', service_provider: 'I run a business that takes bookings (salon, barber, clinic...)', other: 'Something else' },
      fieldNames: { firstName: 'first name', lastName: 'last name', email: 'email', phone: 'phone number', role: 'role', message: 'message' },
      retry: 'Please press the button once more.', formFail: 'We could not send that.', check: 'Please check:', formRate: 'Too many requests. Please try again later.', formConn: 'Connection problem. Please try again.',
      privacy: 'By sending your details you agree that the Accez team may contact you about your request. Your messages in this chat are stored to help us answer you.',
      thanks: (n) => `Thank you, ${n}. We've received your details and the Accez team will follow up with you.`,
    },
    ar: {
      title: 'مساعد أكسيز', online: 'متصل', placeholder: 'اكتب رسالتك...', typeMsg: 'اكتب رسالتك', send: 'إرسال الرسالة',
      close: 'إغلاق المحادثة', open: 'فتح المحادثة', dialog: 'محادثة مساعد أكسيز', typing: 'مساعد أكسيز يكتب الآن',
      greeting: 'مرحبًا بك! أنا مساعد أكسيز، ويسعدني مساعدتك اليوم. كيف يمكنني خدمتك؟',
      chips: [
        ['أدير عقارات', 'أدير عقارات وأريد معرفة المزيد عن نظام إدارة العقارات من أكسيز'],
        ['لدي نشاط يقدم خدمات', 'لدي نشاط يقدم خدمات بالحجز وأريد معرفة كيف يعمل أكسيز لنشاطي'],
        ['الأسعار والخطط', 'كم تبلغ تكلفة أكسيز؟'],
        ['تحدث مع الفريق', 'أرغب في التحدث مع فريق أكسيز'],
      ],
      talkTeam: 'تحدث مع الفريق', rate: 'ترسل الرسائل بسرعة كبيرة. انتظر لحظة ثم حاول مرة أخرى.',
      error: 'حدث خطأ من جهتنا. يُرجى المحاولة بعد قليل.', network: 'تعذّر الوصول إلى الخادم. يُرجى التحقق من اتصالك ثم المحاولة مرة أخرى.',
      f: { first: 'الاسم الأول', last: 'اسم العائلة', email: 'البريد الإلكتروني', phone: 'رقم الجوال', iam: 'أنا', company: 'الشركة', city: 'المدينة', message: 'كيف يمكننا مساعدتك؟ (اختياري)', submit: 'إرسال إلى الفريق' },
      roles: { property_manager: 'أدير عقارات (مدير عقارات، مالك مؤجّر، فندق)', property_owner: 'أملك عقارًا', service_provider: 'لدي نشاط يقدم خدمات بالحجز (صالون، حلاق، عيادة...)', other: 'غير ذلك' },
      fieldNames: { firstName: 'الاسم الأول', lastName: 'اسم العائلة', email: 'البريد الإلكتروني', phone: 'رقم الجوال', role: 'الصفة', message: 'الرسالة' },
      retry: 'يُرجى الضغط على الزر مرة أخرى.', formFail: 'تعذّر إرسال بياناتك.', check: 'يُرجى مراجعة:', formRate: 'عدد الطلبات كبير. يُرجى المحاولة لاحقًا.', formConn: 'حدثت مشكلة في الاتصال. يُرجى المحاولة مرة أخرى.',
      privacy: 'بإرسال بياناتك فإنك توافق على أن يتواصل معك فريق أكسيز بخصوص طلبك. تُحفظ رسائلك في هذه المحادثة لمساعدتنا في الرد عليك.',
      thanks: (n) => `شكرًا ${n}. استلمنا بياناتك وسيتواصل معك فريق أكسيز.`,
    },
  }
  const q = new URLSearchParams(location.search)
  let lang = q.get('lang') === 'ar' ? 'ar' : q.get('lang') === 'en' ? 'en' : (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
  const t = () => STR[lang]

  // The website tells the widget which theme it is showing ({ type: 'accez-theme', theme: 'light' | 'dark' }). Until then the device setting decides.
  const isTheme = (v) => v === 'light' || v === 'dark'
  const applyTheme = (v) => { if (isTheme(v)) document.documentElement.dataset.theme = v }
  // Embedded, it starts light unless the address says otherwise and waits for the website's message (the website also sets the frame's colour scheme to match,
  // otherwise the browser paints a solid box behind the widget). Opened on its own, the device setting decides.
  const embedded = window.parent !== window
  applyTheme(isTheme(q.get('theme')) ? q.get('theme') : (!embedded && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))

  // Inside a customer portal the same chat raises support tickets (the portal sends them) instead of collecting sales leads.
  const SUPPORT = app.dataset.mode === 'support'
  const userName = (q.get('name') || '').trim().slice(0, 80)
  const userEmail = (q.get('email') || '').trim().slice(0, 120)
  if (SUPPORT) {
    STR.en.greeting = userName ? `Hi ${userName}, I'm your Accez Assistant. How can I help you today?` : "Hi, I'm your Accez Assistant. How can I help you today?"
    STR.ar.greeting = userName ? `مرحبًا ${userName}، أنا مساعد أكسيز. كيف يمكنني مساعدتك اليوم؟` : 'مرحبًا، أنا مساعد أكسيز. كيف يمكنني مساعدتك اليوم؟'
    STR.en.chips = []
    STR.ar.chips = []
    Object.assign(STR.en, {
      ticketYes: 'Yes, raise a ticket', ticketNo: 'No, thanks', ticketNoReply: 'No problem. Ask me anything else, or tell me if you change your mind.',
      ticketRaising: "I'm raising a support ticket now. The Accez team will follow up with you shortly.",
      ticketCreated: 'Your support ticket has been created. Our team will follow up shortly.',
      ticketFailed: "I couldn't create the ticket automatically. Please visit the Support page.",
      ticketSent: 'Your ticket has been submitted. Our team will follow up shortly.',
    })
    Object.assign(STR.ar, {
      ticketYes: 'نعم، افتح تذكرة', ticketNo: 'لا، شكرًا', ticketNoReply: 'لا مشكلة. اسألني عن أي شيء آخر، أو أخبرني إن غيّرت رأيك.',
      ticketRaising: 'جارٍ فتح تذكرة دعم الآن، وسيتابع معك فريق أكسيز قريبًا.',
      ticketCreated: 'تم إنشاء تذكرة الدعم. سيتواصل معك فريقنا قريبًا.',
      ticketFailed: 'تعذّر إنشاء التذكرة تلقائيًا. يُرجى زيارة صفحة الدعم.',
      ticketSent: 'تم إرسال تذكرتك. سيتواصل معك فريقنا قريبًا.',
    })
  }
  let ticketPending = false, awaitingTicket = null
  const YES = /^\s*(yes|yeah|yep|ok|okay|sure|please|go ahead|raise it|نعم|ايوه|أيوه|اي|تمام|أكيد)/i

  function applyLang(next) {
    lang = next
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    const s = t()
    document.querySelector('.who strong').textContent = s.title
    document.querySelector('.who span b').textContent = s.online
    input.placeholder = s.placeholder
    document.querySelector('label[for=input]').textContent = s.typeMsg
    composer.querySelector('.send').setAttribute('aria-label', s.send)
    closeBtn.setAttribute('aria-label', s.close)
    panel.setAttribute('aria-label', s.dialog)
    toggle.setAttribute('aria-label', open ? s.close : s.open)
    // The welcome bubble and the starter buttons are interface text, so they follow the language. Real conversation stays as written.
    if (greetEl) greetEl.innerHTML = format(s.greeting)
    if (chips.children.length) showChips()
  }

  /* ---------- session ---------- */
  const newId = () => {
    if (crypto.randomUUID) return crypto.randomUUID()
    const b = crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  let sid = null
  const SID_KEY = SUPPORT ? 'accez_sid_support' : 'accez_sid'
  try { sid = localStorage.getItem(SID_KEY) } catch (e) { /* storage blocked: session lasts for this page view */ }
  if (!sid || !UUID.test(sid)) {
    sid = newId()
    try { localStorage.setItem(SID_KEY, sid) } catch (e) { /* ignore */ }
  }

  let open = false, busy = false, started = false, audience = 'general', greetEl = null, teamOffered = false

  /* ---------- rendering ---------- */
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)،؛]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`)
  // Text is escaped first, so only the markup built here can reach the page.
  function format(text) {
    let html = '', inList = false
    for (const l of esc(text).split('\n')) {
      const m = l.match(/^\s*[-*]\s+(.*)/)
      if (m) {
        if (!inList) { html += '<ul>'; inList = true }
        html += `<li>${inline(m[1])}</li>`
      } else {
        if (inList) { html += '</ul>'; inList = false }
        if (l.trim()) html += `<p>${inline(l)}</p>`
      }
    }
    return inList ? html + '</ul>' : html
  }

  const scroll = () => { log.scrollTop = log.scrollHeight }
  function add(cls, html) {
    const el = document.createElement('div')
    el.className = `msg ${cls}`
    el.dir = 'auto'
    el.innerHTML = html
    log.appendChild(el)
    scroll()
    return el
  }
  const bot = (text) => add('msg-bot', format(text))
  const user = (text) => add('msg-user', `<p>${esc(text)}</p>`)

  function typing(on) {
    const existing = log.querySelector('.typing')
    if (!on) { existing?.remove(); return }
    if (existing) return
    const el = document.createElement('div')
    el.className = 'typing'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-label', t().typing)
    el.innerHTML = '<i></i><i></i><i></i>'
    log.appendChild(el)
    scroll()
  }

  function setOpen(v) {
    open = v
    panel.hidden = !v
    app.classList.toggle('is-open', v)
    toggle.setAttribute('aria-expanded', String(v))
    toggle.setAttribute('aria-label', v ? t().close : t().open)
    // The host page resizes the iframe from this message. It carries no data beyond the open state.
    parent.postMessage({ type: 'accez-assistant', isOpen: v }, '*')
    if (v) {
      if (!started) { started = true; greetEl = bot(t().greeting); showChips() }
      input.focus()
    }
  }

  function showChips() {
    chips.replaceChildren(...t().chips.map(([label, text]) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.textContent = label
      b.addEventListener('click', () => send(text))
      return b
    }))
  }

  /* ---------- chat ---------- */
  async function send(text) {
    text = text.trim()
    if (!text || busy) return
    if (SUPPORT && ticketPending && YES.test(text)) { input.value = ''; user(text); raiseTicket(); return }
    busy = true
    chips.replaceChildren()
    if (/[؀-ۿ]/.test(text) && lang !== 'ar') applyLang('ar')
    user(text)
    input.value = ''
    composer.querySelector('.send').disabled = true
    typing(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, message: text, ...(SUPPORT ? { mode: 'support' } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      typing(false)
      if (!res.ok) {
        bot(res.status === 429 ? t().rate : t().error)
      } else {
        audience = data.audience || audience
        if ((data.lang === 'ar' || data.lang === 'en') && data.lang !== lang) applyLang(data.lang)
        bot(data.reply)
        if (SUPPORT) { ticketPending = Boolean(data.actions?.ticket); if (ticketPending) showTicketChoices() }
        else if (data.actions?.leadForm) showLeadForm()
        else if (data.actions?.askSide) showSideChoices()
        else if (data.actions?.offerTeam || teamOffered) { teamOffered = true; offerTeam() }
      }
    } catch (e) {
      typing(false)
      bot(t().network)
    } finally {
      busy = false
      composer.querySelector('.send').disabled = false
      input.focus()
    }
  }

  // Under a "which best describes you" question: the two sides as buttons (the first two starter buttons), shorter wording for the reply.
  function showSideChoices() {
    chips.replaceChildren(...t().chips.slice(0, 2).map(([label]) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.textContent = label
      b.addEventListener('click', () => send(label))
      return b
    }))
  }

  function showTicketChoices() {
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label; b.addEventListener('click', fn); return b }
    chips.replaceChildren(
      mk(t().ticketYes, () => { user(t().ticketYes); raiseTicket() }),
      mk(t().ticketNo, () => { ticketPending = false; chips.replaceChildren(); user(t().ticketNo); bot(t().ticketNoReply) }),
    )
  }

  // The portal that embeds this chat sends the ticket to Salesforce; this page only asks it to and shows the outcome.
  const parentOrigin = (() => { try { return (location.ancestorOrigins && location.ancestorOrigins[0]) || new URL(document.referrer).origin } catch (e) { return '*' } })()
  async function raiseTicket() {
    ticketPending = false
    chips.replaceChildren()
    typing(true)
    let draft = { subject: 'Support request from chatbot', description: '' }
    try {
      const res = await fetch('/api/ticket-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })
      if (res.ok) draft = await res.json()
    } catch (e) { /* the team still gets a ticket, with a generic subject */ }
    typing(false)
    bot(t().ticketRaising)
    awaitingTicket = setTimeout(() => { awaitingTicket = null; bot(t().ticketSent) }, 10000)
    parent.postMessage({ type: 'create-support-ticket', data: { name: userName, email: userEmail, subject: draft.subject, description: draft.description } }, parentOrigin)
  }
  window.addEventListener('message', (e) => {
    if (!SUPPORT || e.source !== parent || !e.data || e.data.type !== 'support-ticket-result' || !awaitingTicket) return
    clearTimeout(awaitingTicket)
    awaitingTicket = null
    bot(e.data.success ? t().ticketCreated : t().ticketFailed)
  })

  function offerTeam() {
    chips.replaceChildren()
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = t().talkTeam
    b.addEventListener('click', () => { chips.replaceChildren(); showLeadForm() })
    chips.appendChild(b)
  }

  /* ---------- lead form ---------- */
  const ROLE_FOR = { pms: 'property_manager', provider: 'service_provider' }
  function field(label, name, attrs = {}, required = false) {
    const wrap = document.createElement('label')
    const text = document.createElement('span')
    text.append(label)
    if (required) { const r = document.createElement('b'); r.className = 'req'; r.textContent = ' *'; text.append(r) }
    wrap.append(text)
    const el = document.createElement(attrs.tag || 'input')
    el.name = name
    for (const [k, v] of Object.entries(attrs)) if (k !== 'tag') el.setAttribute(k, v)
    if (required) el.required = true
    wrap.append(el)
    return wrap
  }

  function showLeadForm() {
    if (log.querySelector('form.lead')) return
    const s = t()
    const form = document.createElement('form')
    form.className = 'lead'
    const role = field(s.f.iam, 'role', { tag: 'select' }, true)
    for (const [v, l] of Object.entries(s.roles)) {
      const o = document.createElement('option'); o.value = v; o.textContent = l; role.querySelector('select').append(o)
    }
    role.querySelector('select').value = ROLE_FOR[audience] || 'property_manager'
    const row1 = document.createElement('div'); row1.className = 'row'
    row1.append(field(s.f.first, 'firstName', { autocomplete: 'given-name', maxlength: 60 }, true), field(s.f.last, 'lastName', { autocomplete: 'family-name', maxlength: 60 }, true))
    const row2 = document.createElement('div'); row2.className = 'row'
    row2.append(field(s.f.company, 'company', { autocomplete: 'organization', maxlength: 100 }), field(s.f.city, 'city', { autocomplete: 'address-level2', maxlength: 60 }))
    const hp = field('Website', 'website', { tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' })
    hp.className = 'hp'
    const error = document.createElement('p'); error.className = 'err'; error.setAttribute('role', 'alert'); error.hidden = true
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'submit'; submit.textContent = s.f.submit
    const email = field(s.f.email, 'email', { type: 'email', autocomplete: 'email', maxlength: 120, dir: 'ltr' }, true)
    const phone = field(s.f.phone, 'phone', { type: 'tel', autocomplete: 'tel', maxlength: 30, inputmode: 'tel', dir: 'ltr' }, true)
    const note = document.createElement('p'); note.className = 'note'; note.textContent = s.privacy
    form.append(row1, email, phone, role, row2, field(s.f.message, 'message', { tag: 'textarea', maxlength: 1000 }), hp, note, error, submit)
    // A signed token proves the form was really opened. It is requested now and must be a few seconds old when sent.
    let formToken = ''
    const getToken = () => fetch('/api/lead-token').then((r) => r.json()).then((d) => { formToken = d.token || '' }).catch(() => {})
    getToken()
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      error.hidden = true
      submit.disabled = true
      const body = Object.fromEntries(new FormData(form).entries())
      body.sessionId = sid
      body.formToken = formToken
      try {
        const res = await fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.ok) {
          form.remove()
          bot(t().thanks(body.firstName))
        } else {
          if (data.reason === 'retry') { await getToken(); error.textContent = t().retry; error.hidden = false; submit.disabled = false; return }
          const names = Array.isArray(data.fields) ? data.fields.map((k) => t().fieldNames[k] || k) : []
          error.textContent = res.status === 429 ? t().formRate : `${t().formFail}${names.length ? ` ${t().check} ${names.join(lang === 'ar' ? '، ' : ', ')}.` : ''}`
          error.hidden = false
          submit.disabled = false
        }
      } catch (err) {
        error.textContent = t().formConn
        error.hidden = false
        submit.disabled = false
      }
    })
    log.appendChild(form)
    scroll()
    form.querySelector('input').focus()
  }

  composer.addEventListener('submit', (e) => { e.preventDefault(); send(input.value) })
  toggle.addEventListener('click', () => setOpen(!open))
  closeBtn.addEventListener('click', () => { setOpen(false); toggle.focus() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setOpen(false); toggle.focus() } })

  // The host page tells the widget which language the website is showing.
  window.addEventListener('message', (e) => {
    if (e.source !== parent || !e.data) return
    if (e.data.type === 'accez-theme') applyTheme(e.data.theme)
    if (e.data.type === 'accez-lang' && (e.data.lang === 'ar' || e.data.lang === 'en') && e.data.lang !== lang) applyLang(e.data.lang)
  })

  applyLang(lang)
  // Opened straight from a link such as /widget?open=1 (useful for testing).
  if (q.get('open') === '1') setOpen(true)
})()
