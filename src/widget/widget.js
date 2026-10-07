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
      roles: { property_manager: 'I manage properties (property manager, landlord, hotel)', property_owner: 'I own property', service_provider: 'I run a business that takes bookings (salon, barber, clinic...)', resident_guest: "I'm a resident or guest", other: 'Something else' },
      fieldNames: { firstName: 'first name', lastName: 'last name', email: 'email', phone: 'phone number', role: 'role', message: 'message' },
      retry: 'Please press the button once more.', formFail: 'We could not send that.', check: 'Please check:', formRate: 'Too many requests. Please try again later.', formConn: 'Connection problem. Please try again.',
      privacy: 'By sending your details you agree that the Accez team may contact you about your request. Your messages in this chat are stored to help us answer you.',
      thanks: (n) => `Thank you, ${n}. We've received your details and the Accez team will follow up with you.`,
    },
    ar: {
      title: 'مساعد Accez', online: 'متصل', placeholder: 'اكتب رسالتك...', typeMsg: 'اكتب رسالتك', send: 'إرسال الرسالة',
      close: 'إغلاق المحادثة', open: 'فتح المحادثة', dialog: 'محادثة مساعد Accez', typing: 'مساعد Accez يكتب الآن',
      greeting: 'مرحبًا بك! أنا مساعد Accez، ويسعدني مساعدتك اليوم. كيف يمكنني خدمتك؟',
      chips: [
        ['أدير عقارات', 'أدير عقارات وأريد معرفة المزيد عن نظام إدارة العقارات من Accez'],
        ['لدي نشاط يقدم خدمات', 'لدي نشاط يقدم خدمات بالحجز وأريد معرفة كيف يعمل Accez لنشاطي'],
        ['الأسعار والخطط', 'كم تبلغ تكلفة Accez؟'],
        ['تحدث مع الفريق', 'أرغب في التحدث مع فريق Accez'],
      ],
      talkTeam: 'تحدث مع الفريق', rate: 'ترسل الرسائل بسرعة كبيرة. انتظر لحظة ثم حاول مرة أخرى.',
      error: 'حدث خطأ من جهتنا. يُرجى المحاولة بعد قليل.', network: 'تعذّر الوصول إلى الخادم. يُرجى التحقق من اتصالك ثم المحاولة مرة أخرى.',
      f: { first: 'الاسم الأول', last: 'اسم العائلة', email: 'البريد الإلكتروني', phone: 'رقم الجوال', iam: 'أنا', company: 'الشركة', city: 'المدينة', message: 'كيف يمكننا مساعدتك؟ (اختياري)', submit: 'إرسال إلى الفريق' },
      roles: { property_manager: 'أدير عقارات (مدير عقارات، مالك مؤجّر، فندق)', property_owner: 'أملك عقارًا', service_provider: 'لدي نشاط يقدم خدمات بالحجز (صالون، حلاق، عيادة...)', resident_guest: 'مقيم أو ضيف', other: 'غير ذلك' },
      fieldNames: { firstName: 'الاسم الأول', lastName: 'اسم العائلة', email: 'البريد الإلكتروني', phone: 'رقم الجوال', role: 'الصفة', message: 'الرسالة' },
      retry: 'يُرجى الضغط على الزر مرة أخرى.', formFail: 'تعذّر إرسال بياناتك.', check: 'يُرجى مراجعة:', formRate: 'عدد الطلبات كبير. يُرجى المحاولة لاحقًا.', formConn: 'حدثت مشكلة في الاتصال. يُرجى المحاولة مرة أخرى.',
      privacy: 'بإرسال بياناتك فإنك توافق على أن يتواصل معك فريق Accez بخصوص طلبك. تُحفظ رسائلك في هذه المحادثة لمساعدتنا في الرد عليك.',
      thanks: (n) => `شكرًا ${n}. استلمنا بياناتك وسيتواصل معك فريق Accez.`,
    },
  }
  const q = new URLSearchParams(location.search)
  let lang = q.get('lang') === 'ar' ? 'ar' : q.get('lang') === 'en' ? 'en' : (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
  const t = () => STR[lang]

  function applyLang(next) {
    lang = next
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    const s = t()
    document.querySelector('.who strong').textContent = s.title
    document.querySelector('.who span').textContent = s.online
    input.placeholder = s.placeholder
    document.querySelector('label[for=input]').textContent = s.typeMsg
    composer.querySelector('.send').setAttribute('aria-label', s.send)
    closeBtn.setAttribute('aria-label', s.close)
    panel.setAttribute('aria-label', s.dialog)
    toggle.setAttribute('aria-label', open ? s.close : s.open)
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
  try { sid = localStorage.getItem('accez_sid') } catch (e) { /* storage blocked: session lasts for this page view */ }
  if (!sid || !UUID.test(sid)) {
    sid = newId()
    try { localStorage.setItem('accez_sid', sid) } catch (e) { /* ignore */ }
  }

  let open = false, busy = false, started = false, audience = 'general'

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
      if (!started) { started = true; bot(t().greeting); showChips() }
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
        body: JSON.stringify({ sessionId: sid, message: text }),
      })
      const data = await res.json().catch(() => ({}))
      typing(false)
      if (!res.ok) {
        bot(res.status === 429 ? t().rate : t().error)
      } else {
        audience = data.audience || audience
        if ((data.lang === 'ar' || data.lang === 'en') && data.lang !== lang) applyLang(data.lang)
        bot(data.reply)
        if (data.actions?.leadForm) showLeadForm()
        else if (data.actions?.offerTeam) offerTeam()
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
  const ROLE_FOR = { pms: 'property_manager', provider: 'service_provider', resident: 'resident_guest' }
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

  applyLang(lang)
  // Opened straight from a link such as /widget?open=1 (useful for testing).
  if (q.get('open') === '1') setOpen(true)
})()
