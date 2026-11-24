/*!
 * Jothrah Chat Widget v2 — دردشة جذرة
 * مصدر واحد مقروء. يُحمَّل في متجر سلة بسطر واحد:
 * <script src="https://jothrah-ai-bot.vercel.app/widget.js" defer></script>
 */
(function () {
  "use strict";
  if (window.__JTH_CHAT_V2__) return;
  window.__JTH_CHAT_V2__ = true;

  var VERSION = "2.0.0";
  var API = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) return new URL(s).origin;
    } catch (e) {}
    return "https://jothrah-ai-bot.vercel.app";
  })();
  // data-offset: رفع زر الدردشة فوق الأشرطة الثابتة (مثل صفحات الهبوط)
  var OFFSET = (function () {
    try {
      var cs = document.currentScript;
      var v = cs && cs.getAttribute("data-offset");
      return Math.max(0, Math.min(200, parseInt(v || "0", 10) || 0));
    } catch (e) {
      return 0;
    }
  })();
  var WHATSAPP = "966501211056";
  var LS = {
    visitor: "jth2_visitor_id",
    dismissed: "jth2_dismissed_conv",
    name: "jth2_customer_name",
    email: "jth2_customer_email",
    phone: "jth2_customer_phone",
    open: "jth2_open",
    conv: "jth2_conv_id",
    notif: "jth2_notif_asked",
    nudge: "jth2_nudge_seen",
  };

  /* ------------------------------------------------------------------ */
  /* أدوات عامة                                                          */
  /* ------------------------------------------------------------------ */
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
    } catch (e) {}
    return null;
  }
  function sstore(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      sessionStorage.setItem(k, String(v));
    } catch (e) {}
    return null;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    try {
      var x = new URL(String(u), location.href);
      return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
    } catch (e) {
      return "";
    }
  }
  function linkify(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,،)])/g, function (m) {
        var u = safeUrl(m.replace(/&amp;/g, "&"));
        if (!u) return m;
        var label = /jothrah\.com/.test(u) ? (isAr ? "فتح المنتج ↗" : "Open product ↗") : m;
        return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + label + "</a>";
      })
      .replace(/\n/g, "<br>");
  }
  function uid() {
    return "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString(isAr ? "ar-SA" : "en-GB", { hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }
  function mmss(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function ts(v) {
    var t = Date.parse(v || "");
    return isFinite(t) ? t : 0;
  }

  var isAr = !/^en/i.test(document.documentElement.lang || "") && !/\/en(\/|$)/.test(location.pathname);
  var T = isAr
    ? {
        title: "مساعد جذرة",
        botStatus: "متصل الآن · يرد خلال ثوانٍ",
        humanStatus: "مهندس جذرة الزراعي · متصل",
        waitingStatus: "بانتظار مهندس جذرة الزراعي…",
        talkHuman: "تحدث مع مهندس زراعي",
        placeholder: "اكتب سؤالك هنا…",
        placeholderHuman: "اكتب رسالتك للمهندس…",
        hello: "حيّاك الله",
        intro: "أنا مساعد جذرة الذكي 🌿 أساعدك تختار المبيد أو السماد أو البذور المناسبة، وتقدر ترسل صورة المشكلة وأشخّصها لك مبدئياً.",
        introHuman: "وإذا تحب تكلم مهندس زراعي من فريقنا، اضغط «تحدث مع مهندس زراعي» وبيرد عليك هنا بدون واتساب.",
        chips: [
          ["🪳", "عندي حشرات بالبيت"],
          ["🌱", "مشكلة في نباتاتي أو مزرعتي"],
          ["🧪", "أبغى سماد مناسب"],
          ["🍆", "أبحث عن بذور"],
          ["📷", "أرسل صورة المشكلة"],
          ["📦", "استفسار عن طلبي"],
        ],
        send: "إرسال",
        thinking: "مساعد جذرة يكتب",
        connecting: "جاري تحويلك للمهندس…",
        adminTyping: "مهندس جذرة يكتب الآن",
        products: "منتجات مناسبة من جذرة",
        view: "عرض المنتج",
        add: "أضف للسلة",
        added: "تمت الإضافة ✓",
        advice: "نصائح سريعة",
        needHumanHint: "حالتك تحتاج نظرة مهندس زراعي؟",
        needHumanBtn: "حوّلني لمهندس زراعي",
        supportHint: "فريق جذرة جاهز يخدمك هنا مباشرة",
        supportBtn: "تواصل مع خدمة العملاء",
        ordersTitle: "طلباتك في جذرة",
        orderNo: "طلب رقم",
        orderTotal: "الإجمالي",
        orderShip: "شركة الشحن",
        orderTrackNo: "رقم التتبع",
        orderTrack: "تتبع الشحنة",
        orderView: "تفاصيل الطلب",
        orderAsk: "استفسار عن هذا الطلب",
        orderNone: "ما لقيت طلبات على حسابك.",
        orderNotFound: "ما لقيت طلب بهذا الرقم في حسابك، هذي آخر طلباتك:",
        orderLogin: "عشان أعرض لك تفاصيل طلبك وحالة الشحن، سجّل دخولك في المتجر بنفس الحساب اللي طلبت منه.",
        loginBtn: "تسجيل الدخول",
        myOrders: "طلباتي",
        orderLoading: "أجيب لك تفاصيل طلباتك…",
        orWhatsapp: "أو واتساب",
        handoffTitle: "التحدث مع مهندس زراعي",
        handoffText: "حتى تتم خدمتك بشكل أفضل، سجّل اسمك ورقم جوالك أو بريدك الإلكتروني، وبنحوّلك مباشرة لمهندس زراعي من فريق جذرة داخل هذه الدردشة.",
        name: "الاسم",
        phone: "رقم الجوال",
        email: "البريد الإلكتروني",
        contactReq: "اكتب رقم جوالك أو بريدك الإلكتروني",
        phoneBad: "رقم الجوال غير صحيح",
        emailBad: "البريد الإلكتروني غير صحيح",
        locLabel: "📍 شارك موقعي الحالي لخدمة أدق (اختياري)",
        locWait: "جاري تحديد الموقع…",
        loginFill: "سجّل دخولك برقم جوالك وتنعبى بياناتك تلقائياً",
        orManual: "أو اكتب بياناتك هنا",
        loggedAs: "أنت مسجّل دخول، بياناتك معبّأة تلقائياً",
        topic: "باختصار، وش تحتاج؟ (اختياري)",
        start: "ابدأ المحادثة مع المهندس",
        cancel: "رجوع",
        waitTitle: "تم تحويلك لمهندس جذرة الزراعي ✅",
        waitText: "يستغرق الرد عليك حوالي دقيقتين، رجاءً لا تغادر الصفحة أو تغلق المتصفح حتى يصلك الرد.",
        waitSound: "بننبهك بصوت أول ما يوصل الرد.",
        notifBtn: "فعّل الإشعارات عشان يوصلك الرد",
        notifOn: "الإشعارات مفعّلة، بيوصلك تنبيه حتى لو كنت في صفحة ثانية.",
        waitLong: "المهندس مشغول مع عميل آخر حالياً، رسالتك محفوظة وبيرد عليك هنا قريباً. تقدر تكتب تفاصيل مشكلتك الآن.",
        elapsed: "مدة الانتظار",
        leaveWarn: "مهندس جذرة على وشك الرد عليك، متأكد تبغى تغادر؟",
        closedTitle: "تم إنهاء المحادثة",
        rateQ: "كيف كانت خدمتنا؟",
        notePh: "ملاحظة (اختياري)",
        rateSend: "إرسال التقييم",
        thanks: "شكراً لتقييمك 💚",
        newChat: "محادثة جديدة",
        error: "تعذر الإرسال، تأكد من الاتصال وحاول مرة ثانية.",
        retry: "إعادة المحاولة",
        imgCaption: "اكتب وصف للصورة (اختياري)",
        imgSend: "إرسال الصورة",
        seen: "تمت القراءة",
        sent: "تم الإرسال",
        nudge: "تحتار وش تختار؟ اسألني وأرشح لك المنتج المناسب 🌿",
        you: "أنت",
        specialist: "مهندس جذرة الزراعي",
        bot: "مساعد جذرة",
        requested: "تم طلب مهندس زراعي",
        attach: "إرفاق صورة",
        close: "إغلاق",
        minimize: "تصغير",
        nameReq: "اكتب اسمك لو سمحت",
        orderQ: "عندي استفسار عن طلبي",
      }
    : {
        title: "Jothrah Assistant",
        botStatus: "Online · replies in seconds",
        humanStatus: "Jothrah specialist · online",
        waitingStatus: "Waiting for a specialist…",
        talkHuman: "Talk to an agronomist",
        placeholder: "Type your question…",
        placeholderHuman: "Message the specialist…",
        hello: "Welcome",
        intro: "I'm Jothrah's smart assistant 🌿 I help you pick the right pesticide, fertilizer or seeds — you can also send a photo of the problem.",
        introHuman: "Prefer a person? Tap “Talk to a specialist” and our team will reply right here — no WhatsApp needed.",
        chips: [
          ["🪳", "Insects in my house"],
          ["🌱", "Problem with my plants"],
          ["🧪", "I need a fertilizer"],
          ["🍆", "Looking for seeds"],
          ["📷", "Send a photo"],
          ["📦", "Question about my order"],
        ],
        send: "Send",
        thinking: "Jothrah assistant is typing",
        connecting: "Connecting you to an agronomist…",
        adminTyping: "Specialist is typing",
        products: "Suitable Jothrah products",
        view: "View product",
        add: "Add to cart",
        added: "Added ✓",
        advice: "Quick tips",
        needHumanHint: "Need a specialist to look at it?",
        needHumanBtn: "Connect me to a specialist",
        supportHint: "Our team can help you right here",
        supportBtn: "Contact customer service",
        ordersTitle: "Your Jothrah orders",
        orderNo: "Order",
        orderTotal: "Total",
        orderShip: "Carrier",
        orderTrackNo: "Tracking no.",
        orderTrack: "Track shipment",
        orderView: "Order details",
        orderAsk: "Ask about this order",
        orderNone: "No orders found on your account.",
        orderNotFound: "I couldn't find that order number on your account. Your latest orders:",
        orderLogin: "To show your order details and shipping status, please log in with the account you ordered from.",
        loginBtn: "Log in",
        myOrders: "My orders",
        orderLoading: "Fetching your orders…",
        orWhatsapp: "or WhatsApp",
        handoffTitle: "Talk to a Jothrah specialist",
        handoffText: "To serve you better, enter your name and your mobile number or email, and we'll connect you to an agronomist right here.",
        name: "Name",
        phone: "Mobile number",
        email: "Email",
        contactReq: "Enter your mobile number or email",
        phoneBad: "Invalid mobile number",
        emailBad: "Invalid email",
        locLabel: "📍 Share my current location for better help (optional)",
        locWait: "Getting location…",
        loginFill: "Log in with your mobile to fill your details",
        orManual: "or enter your details here",
        loggedAs: "You're logged in — your details are filled in",
        topic: "Briefly, what do you need? (optional)",
        start: "Start chat with specialist",
        cancel: "Back",
        waitTitle: "You're connected to a specialist ✅",
        waitText: "A reply usually takes about two minutes — please don't leave the page or close the browser until it arrives.",
        waitSound: "We'll play a sound when the reply arrives.",
        notifBtn: "Enable notifications for the reply",
        notifOn: "Notifications are on — you'll be alerted even in another tab.",
        waitLong: "Our specialist is helping another customer; your message is saved and they'll reply here shortly. Feel free to add details now.",
        elapsed: "Waiting time",
        leaveWarn: "A specialist is about to reply. Leave anyway?",
        closedTitle: "Conversation ended",
        rateQ: "How was our service?",
        notePh: "Note (optional)",
        rateSend: "Send rating",
        thanks: "Thanks for your rating 💚",
        newChat: "New chat",
        error: "Couldn't send. Check your connection and try again.",
        retry: "Retry",
        imgCaption: "Describe the photo (optional)",
        imgSend: "Send photo",
        seen: "Seen",
        sent: "Sent",
        nudge: "Not sure what to pick? Ask me and I'll recommend the right product 🌿",
        you: "You",
        specialist: "Jothrah specialist",
        bot: "Jothrah assistant",
        requested: "Specialist requested",
        attach: "Attach photo",
        close: "Close",
        minimize: "Minimize",
        nameReq: "Please enter your name",
        orderQ: "I have a question about my order",
      };

  /* ------------------------------------------------------------------ */
  /* هوية العميل                                                         */
  /* ------------------------------------------------------------------ */
  function sallaUser() {
    try {
      var s = window.salla;
      if (!s || !s.config || !s.config.get) return null;
      var u = s.config.get("user") || {};
      var id = u.id || s.config.get("user.id");
      if (!id || String(u.type || "") === "guest") return null;
      var name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.name || "";
      return { id: String(id), name: name, phone: u.mobile ? String(u.mobile_code || "") + String(u.mobile) : "", email: u.email || "" };
    } catch (e) {
      return null;
    }
  }
  // المعرّف ثابت لهذا المتصفح (محفوظ في localStorage) حتى تبقى المحادثة بعد التحديث أو التنقل أو تسجيل الدخول
  function identity() {
    var u = sallaUser();
    var v = store(LS.visitor);
    if (!v) {
      v = uid();
      store(LS.visitor, v);
    }
    return { key: v, logged: Boolean(u), user: u };
  }

  /* ------------------------------------------------------------------ */
  /* الحالة                                                               */
  /* ------------------------------------------------------------------ */
  var S = {
    open: false,
    conv: null, // conversation object from server
    msgs: [], // server messages
    pending: [], // local optimistic
    local: [], // بطاقات محلية (تفاصيل الطلبات) لا تُحفظ في الخادم
    cursor: "",
    sending: false,
    adminTyping: false,
    adminSeenAt: "",
    unread: 0,
    view: "chat", // chat | handoff
    rated: false,
    pollTimer: null,
    lastTypingPing: 0,
    lastHumanCount: -1,
    image: null,
  };

  function mode() {
    var st = S.conv && S.conv.status;
    if (!S.conv) return "ai";
    if (st === "closed") return "closed";
    if (st === "needs_human" || st === "human_replied") return "human";
    return "ai";
  }
  function waitingForHuman() {
    if (mode() !== "human" || !S.conv) return false;
    var req = ts(S.conv.human_requested_at);
    var lastHuman = 0;
    S.msgs.forEach(function (m) {
      if (m.sender_type === "human") lastHuman = Math.max(lastHuman, ts(m.created_at));
    });
    return !lastHuman || lastHuman < req;
  }

  /* ------------------------------------------------------------------ */
  /* الشبكة                                                               */
  /* ------------------------------------------------------------------ */
  // XMLHttpRequest بدل fetch: بعض سكربتات المتجر تغلّف fetch وتمنع النطاقات الخارجية
  function api(path, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open(opts.method || "GET", API + path, true);
      x.timeout = opts.timeout || 45000;
      var body = null;
      if (opts.body instanceof FormData) body = opts.body;
      else if (opts.body) {
        x.setRequestHeader("Content-Type", "application/json");
        body = JSON.stringify(opts.body);
      }
      x.onload = function () {
        var j = null;
        try { j = JSON.parse(x.responseText || "null"); } catch (e) {}
        if (x.status >= 200 && x.status < 300) resolve(j || {});
        else reject(new Error((j && j.error) || "HTTP " + x.status));
      };
      x.onerror = function () { reject(new Error("NETWORK")); };
      x.ontimeout = function () { reject(new Error("TIMEOUT")); };
      x.send(body);
    });
  }

  function sync(full) {
    var id = identity();
    var q = "/api/chat/messages?visitor_id=" + encodeURIComponent(id.key);
    var knownConv = (S.conv && S.conv.id) || (full ? store(LS.conv) : "");
    if (knownConv && (!full || !S.conv)) q += "&conversation_id=" + encodeURIComponent(knownConv);
    if (!full && S.cursor) q += "&since=" + encodeURIComponent(S.cursor);
    if (id.user && id.user.name) q += "&customer_name=" + encodeURIComponent(id.user.name);
    return api(q, { timeout: 15000 }).then(function (data) {
      var conv = data.conversation;
      if (!conv) return;
      if (store(LS.dismissed) === conv.id) {
        // محادثة منتهية أخفاها العميل
        S.conv = null;
        S.msgs = [];
        S.cursor = "";
        return;
      }
      if (full && conv.status === "closed" && conv.rating) {
        store(LS.dismissed, conv.id);
        store(LS.conv, null);
        S.conv = null;
        S.msgs = [];
        S.cursor = "";
        return;
      }
      var convChanged = !S.conv || S.conv.id !== conv.id;
      S.conv = conv;
      store(LS.conv, conv.id);
      S.adminTyping = Boolean(data.admin_typing);
      S.adminSeenAt = data.admin_seen_at || "";
      if (convChanged || full || !data.incremental) S.msgs = [];
      var known = {};
      S.msgs.forEach(function (m) { known[m.id] = 1; });
      var newHuman = 0;
      (data.messages || []).forEach(function (m) {
        if (known[m.id]) return;
        S.msgs.push(m);
        if (m.sender_type === "human" && S.lastHumanCount >= 0) newHuman++;
        // احذف الرسالة المؤقتة المطابقة
        if (m.sender_type === "customer") {
          for (var i = 0; i < S.pending.length; i++) {
            if (S.pending[i].status !== "error" && (S.pending[i].text || "") === (m.message || "") ) {
              S.pending.splice(i, 1);
              break;
            }
          }
        }
      });
      S.msgs.sort(function (a, b) { return ts(a.created_at) - ts(b.created_at); });
      if (S.msgs.length) S.cursor = S.msgs[S.msgs.length - 1].created_at;
      var humanCount = S.msgs.filter(function (m) { return m.sender_type === "human"; }).length;
      if (S.lastHumanCount >= 0 && humanCount > S.lastHumanCount) onHumanReply(humanCount - S.lastHumanCount);
      S.lastHumanCount = humanCount;
    });
  }

  function schedulePoll() {
    clearTimeout(S.pollTimer);
    var m = mode();
    if (!S.conv || m === "closed") return;
    var hidden = document.hidden;
    var delay = m === "human" ? (hidden ? 5000 : 1500) : S.open ? 6000 : 25000;
    S.pollTimer = setTimeout(function () {
      sync(false)
        .then(render)
        .catch(function () {})
        .finally(schedulePoll);
    }, delay);
  }

  /* ------------------------------------------------------------------ */
  /* التنبيهات                                                            */
  /* ------------------------------------------------------------------ */
  var audioCtx = null;
  function chime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audioCtx.currentTime;
      [880, 1320].forEach(function (f, i) {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.16);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.35);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0 + i * 0.16);
        o.stop(t0 + i * 0.16 + 0.4);
      });
    } catch (e) {}
  }
  var baseTitle = document.title;
  var titleTimer = null;
  function flashTitle() {
    if (titleTimer || !document.hidden) return;
    var on = false;
    titleTimer = setInterval(function () {
      document.title = (on = !on) ? "💬 " + (isAr ? "رد جديد من جذرة" : "New reply from Jothrah") : baseTitle;
    }, 1000);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      clearInterval(titleTimer);
      titleTimer = null;
      document.title = baseTitle;
      schedulePoll();
    }
  });
  function canNotify() {
    return "Notification" in window && window.isSecureContext;
  }
  function askNotifications() {
    if (!canNotify() || Notification.permission !== "default") return;
    store(LS.notif, "1");
    try {
      var r = Notification.requestPermission(function () { lastHtml = ""; render(); });
      if (r && r.then) r.then(function () { lastHtml = ""; render(); });
    } catch (e) {}
  }
  function systemNotify(text) {
    if (!canNotify() || Notification.permission !== "granted") return;
    if (!document.hidden && S.open) return;
    try {
      var n = new Notification(isAr ? "💬 رد من مهندس جذرة" : "💬 Reply from Jothrah", {
        body: String(text || "").slice(0, 140),
        icon: "https://cdn.salla.sa/xPpow/fd42af9f-40f2-4972-bcad-7c8b7c1a464a-1000x1000-K7vWaelbWALZairnR5Nb269vBeHTCkfTaK8mHymz.jpg",
        tag: "jothrah-chat",
        renotify: true,
      });
      n.onclick = function () { window.focus(); setOpen(true); n.close(); };
    } catch (e) {}
  }
  function onHumanReply(n) {
    var last = S.msgs.filter(function (m) { return m.sender_type === "human"; }).pop();
    systemNotify(last && last.message);
    chime();
    flashTitle();
    if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {}
    if (!S.open) {
      S.unread += n;
      updateBadge();
    }
  }
  window.addEventListener("beforeunload", function (e) {
    if (waitingForHuman()) {
      e.preventDefault();
      e.returnValue = T.leaveWarn;
      return T.leaveWarn;
    }
  });

  /* ------------------------------------------------------------------ */
  /* الواجهة                                                              */
  /* ------------------------------------------------------------------ */
  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:'IBM Plex Sans Arabic','Tajawal',system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".w{font-family:'IBM Plex Sans Arabic','Tajawal',system-ui,-apple-system,'Segoe UI',sans-serif!important;--g:#0d4a42;--g2:#0a3832;--g3:#e7f1ee;--gold:#c99a3b;--gold2:#f6ecd5;--ink:#12201d;--mut:#55645f;--line:#dfe6e3;--bg:#f5f7f6;color:var(--ink);font-size:14.5px;line-height:1.6;direction:" + (isAr ? "rtl" : "ltr") + "}" +
    ".launch{position:fixed;bottom:" + (18 + OFFSET) + "px;" + (isAr ? "left" : "right") + ":18px;z-index:2147483000;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(145deg,#11594f,#0a3832);box-shadow:0 10px 28px rgba(10,56,50,.38),0 0 0 3px rgba(201,154,59,.55);display:grid;place-items:center;transition:transform .2s}" +
    ".launch:hover{transform:scale(1.06)}.launch:focus-visible{outline:3px solid var(--gold);outline-offset:3px}" +
    ".launch svg{width:30px;height:30px}" +
    ".launch .ring{position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(201,154,59,.6);animation:pulse 2.4s infinite}" +
    "@keyframes pulse{0%{transform:scale(.9);opacity:.9}70%{transform:scale(1.25);opacity:0}100%{opacity:0}}" +
    ".badge{position:absolute;top:-4px;" + (isAr ? "right" : "left") + ":-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#d43c2f;color:#fff;font-size:12px;font-weight:700;display:none;align-items:center;justify-content:center;border:2px solid #fff}" +
    ".nudge{position:fixed;bottom:" + (92 + OFFSET) + "px;" + (isAr ? "left" : "right") + ":18px;z-index:2147483000;max-width:260px;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:12px 14px 12px 34px;box-shadow:0 12px 30px rgba(0,0,0,.14);font-size:13.5px;font-weight:600;cursor:pointer;animation:up .35s ease}" +
    ".nudge b{position:absolute;top:6px;" + (isAr ? "left" : "right") + ":10px;font-weight:400;color:var(--mut);cursor:pointer;font-size:18px}" +
    ".panel{position:fixed;bottom:" + (92 + OFFSET) + "px;" + (isAr ? "left" : "right") + ":18px;z-index:2147483001;width:400px;height:min(680px,calc(100vh - " + (120 + OFFSET) + "px));background:#fff;border-radius:22px;box-shadow:0 24px 60px rgba(8,40,36,.32);display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(13,74,66,.15);animation:up .28s ease}" +
    ".panel.on{display:flex}" +
    "@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
    ".hd{background:linear-gradient(135deg,#0f5148,#0a3832);color:#fff;padding:14px 14px 12px;display:flex;align-items:center;gap:11px;flex:none}" +
    ".av{width:44px;height:44px;border-radius:50%;background:var(--gold);color:#0a3832;display:grid;place-items:center;font-weight:800;font-size:20px;flex:none;position:relative;box-shadow:0 0 0 3px rgba(255,255,255,.18)}" +
    ".av i{position:absolute;bottom:1px;" + (isAr ? "left" : "right") + ":1px;width:11px;height:11px;border-radius:50%;background:#3ddc84;border:2px solid #0d4a42}" +
    ".hd .t{flex:1;min-width:0}.hd .t b{display:block;font-size:16px}.hd .t small{display:block;font-size:12.5px;opacity:.9}" +
    ".ib{width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}.ib:hover{background:rgba(255,255,255,.22)}" +
    ".bar{display:flex;gap:8px;padding:9px 12px;background:var(--gold2);border-bottom:1px solid #ecdcb8;flex:none;align-items:center}" +
    ".bar span{flex:1;font-size:12.5px;color:#5c4614;font-weight:600}" +
    ".hb{border:0;border-radius:999px;background:var(--g);color:#fff;font-weight:700;font-size:13px;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap}.hb:hover{background:var(--g2)}" +
    ".body{flex:1;overflow-y:auto;padding:16px 14px 10px;background:var(--bg);scroll-behavior:smooth;overscroll-behavior:contain}" +
    ".welcome{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px}" +
    ".welcome h3{margin:0 0 6px;font-size:18px;color:var(--g)}.welcome p{margin:0 0 8px;color:#2b3a36}" +
    ".chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}" +
    ".chip{border:1.5px solid #cfe0db;background:#fff;color:var(--g);border-radius:999px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer}.chip:hover{background:var(--g3);border-color:var(--g)}" +
    ".row{display:flex;margin:7px 0;gap:8px;align-items:flex-end}.row.me{justify-content:flex-start}.row.them{justify-content:flex-end}" +
    (isAr ? "" : ".row.me{justify-content:flex-end}.row.them{justify-content:flex-start}") +
    ".bub{max-width:84%;padding:10px 13px;border-radius:18px;word-wrap:break-word;overflow-wrap:anywhere;position:relative}" +
    ".me .bub{background:var(--g);color:#fff;border-" + (isAr ? "bottom-right" : "bottom-right") + "-radius:6px}" +
    ".them .bub{background:#fff;color:var(--ink);border:1px solid var(--line);border-" + (isAr ? "bottom-left" : "bottom-left") + "-radius:6px}" +
    ".human .bub{border:1.5px solid var(--gold);background:#fffdf7}" +
    ".who{font-size:11.5px;font-weight:800;color:var(--g);margin-bottom:3px;display:flex;align-items:center;gap:5px}" +
    ".human .who{color:#8a6415}" +
    ".meta{font-size:11px;opacity:.75;margin-top:4px;display:flex;gap:6px;align-items:center}" +
    ".me .meta{justify-content:flex-end}.tick{font-weight:700}.tick.seen{color:#9ff0c6}" +
    ".bub a{color:inherit;font-weight:700;text-decoration:underline}" +
    ".bub img.att{display:block;max-width:220px;max-height:220px;border-radius:12px;margin-bottom:6px;cursor:zoom-in}" +
    ".sys{text-align:center;margin:10px 0}.sys span{display:inline-block;background:#e3ece9;color:#33514a;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px}" +
    ".adv{margin:8px 0 0;padding:0;list-style:none}.adv li{position:relative;padding-" + (isAr ? "right" : "left") + ":18px;margin:3px 0}.adv li:before{content:'';position:absolute;" + (isAr ? "right" : "left") + ":3px;top:.7em;width:7px;height:7px;border-radius:50%;background:var(--gold)}" +
    ".qs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    ".prods{margin:4px 0 10px;padding:2px 0}.prods h4{margin:0 0 7px;font-size:13px;color:var(--g)}" +
    ".rail{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}" +
    ".pc{flex:0 0 200px;scroll-snap-align:start;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}" +
    ".pc .im{height:130px;background:#fff;display:grid;place-items:center;border-bottom:1px solid var(--line)}.pc .im img{max-width:100%;max-height:126px;object-fit:contain}" +
    ".pc .in{padding:9px 10px;display:flex;flex-direction:column;gap:4px;flex:1}" +
    ".pc .nm{font-weight:800;font-size:13px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--ink)}" +
    ".pc .tg{display:flex;flex-wrap:wrap;gap:4px}.pc .tg span{font-size:11px;background:var(--g3);color:var(--g);border-radius:6px;padding:1px 6px;font-weight:700}" +
    ".pc .rs{font-size:12px;color:var(--mut);line-height:1.45}" +
    ".pc .pr{font-weight:800;color:var(--g);font-size:14px}.pc .pr s{color:#97a39f;font-weight:500;font-size:12px;margin-" + (isAr ? "right" : "left") + ":4px}" +
    ".pc .bt{display:flex;gap:6px;margin-top:auto;padding-top:6px}" +
    ".pc .bt a,.pc .bt button{flex:1;text-align:center;border-radius:10px;padding:7px 4px;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none}" +
    ".pc .bt a{border:1.5px solid var(--g);color:var(--g);background:#fff}.pc .bt button{border:0;background:var(--gold);color:#2b1f05}" +
    ".cta{margin-top:10px;background:var(--gold2);border:1px solid #ecdcb8;border-radius:14px;padding:10px 12px;font-size:13px}" +
    ".ord{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;margin:8px 0}" +
    ".ord h5{margin:0 0 8px;font-size:14px;color:var(--g);display:flex;justify-content:space-between;align-items:center;gap:6px}" +
    ".ord .stt{font-size:12px;font-weight:800;padding:2px 10px;border-radius:999px;color:#fff;white-space:nowrap}" +
    ".ord .ln{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:3px 0;border-bottom:1px dashed #e6ecea}.ord .ln:last-of-type{border:0}.ord .ln span{color:var(--mut)}.ord .ln b{text-align:left}" +
    ".ord .its{font-size:12.5px;color:#2b3a36;margin:6px 0;line-height:1.7}" +
    ".ord .ob{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ord .ob a,.ord .ob button{flex:1;min-width:120px;text-align:center;border-radius:10px;padding:8px 6px;font-size:12.5px;font-weight:800;cursor:pointer;text-decoration:none;border:1.5px solid var(--g);color:var(--g);background:#fff}.ord .ob .pri{background:var(--g);color:#fff}" +
    ".cta .hb{margin-top:7px}.cta a{color:#2c6b3a;font-weight:700;font-size:12.5px;margin-" + (isAr ? "right" : "left") + ":10px}" +
    ".typing{display:inline-flex;gap:4px;align-items:center}.typing i{width:7px;height:7px;border-radius:50%;background:var(--g);opacity:.4;animation:blink 1.2s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}" +
    "@keyframes blink{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}" +
    ".wait{background:#fff;border:2px solid var(--gold);border-radius:18px;padding:14px;margin:10px 0;text-align:center}" +
    ".wait b{display:block;color:var(--g);font-size:15.5px;margin-bottom:4px}.wait p{margin:4px 0;color:#2b3a36;font-weight:600}.wait small{color:var(--mut)}" +
    ".clock{display:inline-flex;align-items:center;gap:8px;margin:8px 0 2px;background:var(--g3);color:var(--g);font-weight:800;border-radius:999px;padding:5px 14px;font-size:14px;font-variant-numeric:tabular-nums}" +
    ".dots{display:flex;justify-content:center;gap:6px;margin:6px 0}.dots i{width:9px;height:9px;border-radius:50%;background:var(--gold);animation:blink 1.4s infinite}.dots i:nth-child(2){animation-delay:.25s}.dots i:nth-child(3){animation-delay:.5s}" +
    ".form{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin:4px 0}" +
    ".form h3{margin:0 0 4px;color:var(--g);font-size:17px}.form p{margin:0 0 10px;color:#2b3a36;font-size:13.5px}" +
    ".form input,.form textarea{width:100%;border:1.5px solid #cfdad6;border-radius:12px;padding:10px 12px;font-size:15px;margin:5px 0;background:#fff;color:var(--ink);outline:none}.form input:focus,.form textarea:focus{border-color:var(--g)}" +
    ".form .err{color:#c0392b;font-size:12.5px;min-height:18px;font-weight:700}" +
    ".form .loc{display:flex;gap:8px;align-items:center;font-size:13px;font-weight:700;color:var(--g);margin:6px 0;cursor:pointer}.form .loc input{width:18px;height:18px;margin:0;accent-color:#0d4a42}" +
    ".form .acts{display:flex;gap:8px;margin-top:6px}.form .acts .hb{flex:1;justify-content:center;padding:11px}.form .ghost{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:10px 16px;cursor:pointer;font-weight:700;color:var(--mut)}" +
    ".rate{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;text-align:center;margin:10px 0}" +
    ".stars{display:flex;justify-content:center;gap:6px;direction:ltr;margin:8px 0}.stars button{border:0;background:none;font-size:30px;cursor:pointer;color:#d5dcda;padding:0 2px;line-height:1}.stars button.on{color:var(--gold)}" +
    ".rate textarea{width:100%;border:1.5px solid #cfdad6;border-radius:12px;padding:8px 10px;font-size:14px;min-height:56px;margin:6px 0}" +
    ".ft{flex:none;border-top:1px solid var(--line);background:#fff;padding:9px 10px calc(9px + env(safe-area-inset-bottom))}" +
    ".comp{display:flex;align-items:flex-end;gap:7px}" +
    ".comp textarea{flex:1;resize:none;border:1.5px solid #cfdad6;border-radius:16px;padding:10px 12px;font-size:16px;max-height:120px;min-height:44px;line-height:1.45;outline:none;color:var(--ink);background:#fff}.comp textarea:focus{border-color:var(--g)}" +
    ".send{width:44px;height:44px;border-radius:50%;border:0;background:var(--g);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}.send:disabled{opacity:.45;cursor:default}" +
    ".att{width:40px;height:44px;border:0;background:none;color:var(--g);cursor:pointer;display:grid;place-items:center;flex:none}" +
    ".pv{display:flex;gap:10px;align-items:center;background:var(--g3);border-radius:14px;padding:8px;margin-bottom:8px}.pv img{width:58px;height:58px;object-fit:cover;border-radius:10px}.pv span{flex:1;font-size:12.5px;font-weight:700;color:var(--g)}.pv button{border:0;background:#fff;border-radius:50%;width:28px;height:28px;cursor:pointer}" +
    ".pend{opacity:.7}.errb{background:#fdecea!important;color:#8e2a20!important;border:1px solid #f2b8b0!important}.errb button{margin-top:6px;border:0;background:#8e2a20;color:#fff;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:700}" +
    ".pw{font-size:10.5px;text-align:center;color:#8a9894;margin-top:5px}" +
    ".lb{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2147483002;display:grid;place-items:center;cursor:zoom-out}.lb img{max-width:94vw;max-height:90vh;border-radius:12px}" +
    "@media (max-width:520px){.panel{inset:0;width:100%;height:100%;max-height:none;border-radius:0;bottom:0;left:0;right:0}.launch{bottom:" + (14 + OFFSET) + "px;" + (isAr ? "left" : "right") + ":14px;width:58px;height:58px}.nudge{bottom:" + (84 + OFFSET) + "px}}" +
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}";

  // خط عربي أنيق (يُحمَّل مرة واحدة على مستوى الصفحة لأن الخطوط لا تُعرَّف داخل Shadow DOM)
  if (!document.getElementById("jth-chat-font")) {
    var fl = document.createElement("link");
    fl.id = "jth-chat-font";
    fl.rel = "stylesheet";
    fl.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap";
    (document.head || document.documentElement).appendChild(fl);
  }

  var host = document.createElement("div");
  host.id = "jth-chat-v2";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="#fff"/><path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="#0d4a42" stroke-width="1.8" stroke-linecap="round"/><circle cx="18.5" cy="4.5" r="3" fill="#c99a3b"/></svg>';
  var ICON_SEND =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="transform:scaleX(' + (isAr ? -1 : 1) + ')"><path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" fill="currentColor"/></svg>';
  var ICON_CAM =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-1.8c.3-.4.7-.7 1.2-.7h3.6c.5 0 .9.3 1.2.7L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12.5" r="3.2" stroke="currentColor" stroke-width="1.8"/></svg>';
  var ICON_X = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_USER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c1.2-3.8 4.2-5.5 8-5.5s6.8 1.7 8 5.5" fill="currentColor"/></svg>';

  root.innerHTML =
    "<style>" + CSS + "</style>" +
    '<div class="w">' +
    '<button class="launch" type="button" aria-label="' + esc(T.title) + '"><span class="ring"></span>' + ICON_CHAT + '<span class="badge"></span></button>' +
    '<section class="panel" role="dialog" aria-label="' + esc(T.title) + '">' +
    '<header class="hd"><div class="av">ج<i></i></div><div class="t"><b>' + esc(T.title) + '</b><small class="st">' + esc(T.botStatus) + "</small></div>" +
    '<button class="ib x" type="button" aria-label="' + esc(T.close) + '">' + ICON_X + "</button></header>" +
    '<div class="bar"><span class="bar-t"></span><button class="hb human" type="button">' + ICON_USER + esc(T.talkHuman) + "</button></div>" +
    '<div class="body" aria-live="polite"></div>' +
    '<footer class="ft"><div class="pvw"></div><div class="comp">' +
    '<button class="att" type="button" aria-label="' + esc(T.attach) + '">' + ICON_CAM + "</button>" +
    '<input type="file" accept="image/*" hidden>' +
    '<textarea rows="1" placeholder="' + esc(T.placeholder) + '" aria-label="' + esc(T.placeholder) + '"></textarea>' +
    '<button class="send" type="button" aria-label="' + esc(T.send) + '" disabled>' + ICON_SEND + "</button>" +
    '</div><div class="pw">جذرة · ' + (isAr ? "مساعد ذكي + مختصين زراعيين" : "AI assistant + agricultural specialists") + "</div></footer>" +
    "</section></div>";

  var $ = function (sel) { return root.querySelector(sel); };
  var el = {
    launch: $(".launch"),
    badge: $(".badge"),
    panel: $(".panel"),
    body: $(".body"),
    st: $(".st"),
    bar: $(".bar"),
    barT: $(".bar-t"),
    human: $(".human"),
    x: $(".x"),
    ta: $("textarea"),
    send: $(".send"),
    att: $(".att"),
    file: $("input[type=file]"),
    pvw: $(".pvw"),
    ft: $(".ft"),
  };

  function updateBadge() {
    el.badge.style.display = S.unread ? "flex" : "none";
    el.badge.textContent = S.unread > 9 ? "9+" : String(S.unread);
  }

  function nearBottom() {
    return el.body.scrollHeight - el.body.scrollTop - el.body.clientHeight < 140;
  }
  function toBottom() {
    el.body.scrollTop = el.body.scrollHeight;
  }

  /* ---- عرض رسالة ---- */
  function renderAI(m) {
    var meta = m.metadata || {};
    var r = meta.fullResponse || {};
    var html = '<div class="who">🌿 ' + esc(T.bot) + "</div>";
    html += "<div>" + linkify(r.summary || m.message || "") + "</div>";
    if (r.advice && r.advice.length) {
      html += '<ul class="adv">' + r.advice.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>";
    }
    var products = meta.products || r.products || [];
    var cats = (r.categories || meta.categories || []).filter(function (c) { return c && c.url && c.title; });
    if (!products.length && cats.length) {
      html += '<div class="qs">' + cats.slice(0, 3).map(function (c) {
        return '<a class="chip" style="text-decoration:none" href="' + esc(safeUrl(c.url)) + '" target="_blank" rel="noopener">' + esc(c.title) + " ↗</a>";
      }).join("") + "</div>";
    }
    if (r.questions && r.questions.length && mode() === "ai") {
      html += '<div class="qs">' + r.questions.map(function (q) {
        return '<button class="chip q" type="button" data-q="' + esc(q) + '">' + esc(q) + "</button>";
      }).join("") + "</div>";
    }
    var mentionsSupport = /خدمة العملاء|التواصل مع|تواصل مع|مختص|مهندس|customer service|contact (our|the|us)|specialist/i.test(String(r.summary || m.message || ""));
    if (mentionsSupport && !(r.whatsapp_needed || m.ai_whatsapp_needed) && mode() === "ai") {
      html += '<div class="cta">' + esc(T.supportHint) + '<br><button class="hb human2" type="button">' + ICON_USER + esc(T.supportBtn) + "</button></div>";
    }
    if ((r.whatsapp_needed || m.ai_whatsapp_needed) && mode() === "ai") {
      html += '<div class="cta">' + esc(T.needHumanHint) + '<br><button class="hb human2" type="button">' + ICON_USER + esc(T.needHumanBtn) + "</button>" +
        '<a href="https://wa.me/' + WHATSAPP + "?text=" + encodeURIComponent(r.whatsapp_message || (isAr ? "السلام عليكم، أحتاج مساعدة من مختص جذرة" : "Hello, I need help from a Jothrah specialist")) + '" target="_blank" rel="noopener">' + esc(T.orWhatsapp) + "</a></div>";
    }
    html += '<div class="meta">' + esc(fmtTime(m.created_at)) + "</div>";
    var out = '<div class="row them"><div class="bub">' + html + "</div></div>";
    if (products.length) {
      out += '<div class="prods"><h4>🛒 ' + esc(T.products) + '</h4><div class="rail">' +
        products.map(function (p) {
          var tags = [p.size, p.active].filter(Boolean).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
          return '<div class="pc" data-pid="' + esc(p.id) + '"><div class="im">' + (p.image ? '<img loading="lazy" alt="" src="' + esc(safeUrl(p.image)) + '">' : "") + "</div>" +
            '<div class="in"><div class="nm">' + esc(p.name) + '</div><div class="tg">' + tags + '</div><div class="rs">' + esc(p.reason || "") + '</div><div class="pr"></div>' +
            '<div class="bt"><a href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">' + esc(T.view) + '</a><button type="button" class="addc" data-pid="' + esc(p.id) + '" data-url="' + esc(safeUrl(p.url)) + '">' + esc(T.add) + "</button></div></div></div>";
        }).join("") + "</div></div>";
    }
    return out;
  }

  function renderMsg(m) {
    var t = m.sender_type;
    if (t === "system") return '<div class="sys"><span>' + esc(/مختص|specialist/i.test(m.message || "") ? T.requested : m.message || T.requested) + "</span></div>";
    if (t === "ai") return renderAI(m);
    var img = m.image_url ? '<img class="att" alt="" src="' + esc(safeUrl(m.image_url)) + '">' : "";
    if (t === "customer") {
      var seen = S.adminSeenAt && ts(S.adminSeenAt) >= ts(m.created_at) && mode() !== "ai";
      var text = m.message && !(m.image_url && /^(صورة مرفقة|Attached image)$/.test(m.message)) ? linkify(m.message) : "";
      return '<div class="row me"><div class="bub">' + img + text +
        '<div class="meta">' + esc(fmtTime(m.created_at)) + (mode() !== "ai" || seen ? ' <span class="tick' + (seen ? " seen" : "") + '" title="' + esc(seen ? T.seen : T.sent) + '">' + (seen ? "✓✓" : "✓") + "</span>" : "") + "</div></div></div>";
    }
    // human
    return '<div class="row them human"><div class="bub"><div class="who">👨‍🌾 ' + esc(T.specialist) + "</div>" + img + linkify(m.message || "") +
      '<div class="meta">' + esc(fmtTime(m.created_at)) + "</div></div></div>";
  }

  function renderPending(p) {
    var img = p.preview ? '<img class="att" alt="" src="' + esc(p.preview) + '">' : "";
    if (p.status === "error") {
      return '<div class="row me"><div class="bub errb">' + img + esc(p.text) + '<div style="font-size:12px;margin-top:4px">' + esc(T.error) +
        '</div><button type="button" class="retry" data-lid="' + esc(p.lid) + '">' + esc(T.retry) + "</button></div></div>";
    }
    return '<div class="row me pend"><div class="bub">' + img + esc(p.text) + '<div class="meta">🕓</div></div></div>';
  }

  function welcome() {
    var id = identity();
    var nm = id.user && id.user.name ? " " + id.user.name.split(" ")[0] : "";
    return '<div class="welcome"><h3>' + esc(T.hello + nm) + " 👋</h3><p>" + esc(T.intro) + "</p><p style=\"color:#55645f;font-size:13px\">" + esc(T.introHuman) + '</p><div class="chips">' +
      T.chips.map(function (c, i) {
        return '<button type="button" class="chip st' + i + '" data-q="' + esc(c[1]) + '">' + c[0] + " " + esc(c[1]) + "</button>";
      }).join("") + "</div></div>";
  }

  function waitCard() {
    var req = ts(S.conv && S.conv.human_requested_at) || Date.now();
    var el2 = Date.now() - req;
    var long = el2 > 4 * 60 * 1000;
    return '<div class="wait"><b>' + esc(T.waitTitle) + '</b><div class="dots"><i></i><i></i><i></i></div><p>' + esc(long ? T.waitLong : T.waitText) +
      '</p><div class="clock">⏱ ' + esc(T.elapsed) + ' <span class="elapsed">' + mmss(el2) + "</span></div><br>" +
      (canNotify() && Notification.permission === "default"
        ? '<button type="button" class="hb notif-on" style="margin:8px auto 0">🔔 ' + esc(T.notifBtn) + "</button>"
        : canNotify() && Notification.permission === "granted"
          ? "<small>🔔 " + esc(T.notifOn) + "</small>"
          : "<small>🔔 " + esc(T.waitSound) + "</small>") +
      "</div>";
  }

  function rateCard() {
    if (S.rated || (S.conv && S.conv.rating)) {
      return '<div class="rate"><b>' + esc(T.thanks) + '</b><br><button class="hb newc" type="button" style="margin:10px auto 0">' + esc(T.newChat) + "</button></div>";
    }
    return '<div class="rate"><b>' + esc(T.closedTitle) + "</b><div>" + esc(T.rateQ) + '</div><div class="stars">' +
      [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-r="' + n + '" aria-label="' + n + '">★</button>'; }).join("") +
      '</div><textarea class="rnote" placeholder="' + esc(T.notePh) + '"></textarea><div style="display:flex;gap:8px;justify-content:center"><button class="hb rsend" type="button" disabled>' + esc(T.rateSend) +
      '</button><button class="ghost newc" type="button" style="border:1.5px solid #dfe6e3;background:#fff;border-radius:999px;padding:8px 14px;cursor:pointer;font-weight:700">' + esc(T.newChat) + "</button></div></div>";
  }

  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  function handoffForm() {
    var id = identity();
    var nm = (id.user && id.user.name) || store(LS.name) || "";
    var ph = (id.user && id.user.phone) || store(LS.phone) || "";
    var em = (id.user && id.user.email) || store(LS.email) || "";
    var geo = "geolocation" in navigator;
    return '<form class="form" autocomplete="on" novalidate><h3>👨‍🌾 ' + esc(T.handoffTitle) + "</h3><p>" + esc(T.handoffText) + "</p>" +
      (!id.user && window.salla && window.salla.event
        ? '<button type="button" class="hb do-login" style="width:100%;justify-content:center;margin:4px 0 10px">🔐 ' + esc(T.loginFill) + "</button><div style=\"text-align:center;color:#55645f;font-size:12.5px;margin-bottom:4px\">" + esc(T.orManual) + "</div>"
        : id.user ? '<div style="background:#e7f1ee;color:#0d4a42;border-radius:12px;padding:8px 12px;font-weight:700;font-size:13px;margin-bottom:6px">✅ ' + esc(T.loggedAs) + "</div>" : "") +
      '<input class="f-name" name="name" autocomplete="name" placeholder="' + esc(T.name) + ' *" value="' + esc(nm) + '" required>' +
      '<input class="f-phone" name="tel" type="tel" inputmode="tel" autocomplete="tel" dir="auto" placeholder="' + esc(T.phone) + '" value="' + esc(ph) + '">' +
      '<input class="f-email" name="email" type="email" inputmode="email" autocomplete="email" dir="auto" placeholder="' + esc(T.email) + '" value="' + esc(em) + '">' +
      '<textarea class="f-topic" name="topic" rows="2" placeholder="' + esc(T.topic) + '"></textarea>' +
      (geo ? '<label class="loc"><input type="checkbox" class="f-loc"' + (isMobile ? " checked" : "") + "> " + esc(T.locLabel) + "</label>" : "") +
      '<div class="err"></div>' +
      '<div class="acts"><button class="hb f-go" type="submit">' + esc(T.start) + '</button><button class="ghost f-back" type="button">' + esc(T.cancel) + "</button></div></form>";
  }

  function getLocation() {
    return new Promise(function (resolve) {
      if (!("geolocation" in navigator)) return resolve(null);
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      setTimeout(function () { finish(null); }, 12000);
      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) { finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
          function () { finish(null); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
      } catch (e) { finish(null); }
    });
  }

  var lastHtml = "";
  function render() {
    var m = mode();
    var waiting = waitingForHuman();
    el.st.textContent = m === "closed" ? T.closedTitle : m === "human" ? (waiting ? T.waitingStatus : T.humanStatus) : T.botStatus;
    el.human.style.display = m === "ai" ? "" : "none";
    el.bar.style.display = m === "ai" && S.view === "chat" ? "" : "none";
    el.barT.textContent = isAr ? "تفضّل التحدث مع شخص؟" : "Prefer talking to a person?";
    el.ft.style.display = m === "closed" || S.view === "handoff" ? "none" : "";
    el.ta.placeholder = m === "human" ? T.placeholderHuman : T.placeholder;

    var html = "";
    if (S.view === "handoff") {
      html = handoffForm();
    } else {
      if (!S.msgs.length && !S.pending.length && !S.local.length) html += welcome();
      S.msgs.forEach(function (msg) { html += renderMsg(msg); });
      S.pending.forEach(function (p) { html += renderPending(p); });
      S.local.forEach(function (x) { html += x.html; });
      if (waiting) html += waitCard();
      if (S.botTyping && m === "ai" && Date.now() - S.botTyping < 65000) html += '<div class="row them"><div class="bub"><span class="typing"><i></i><i></i><i></i></span> <small style="color:#55645f">' + esc(T.thinking) + "</small></div></div>";
      if (S.connecting) html += '<div class="sys"><span>⏳ ' + esc(T.connecting) + "</span></div>";
      if (S.adminTyping && m === "human") html += '<div class="row them human"><div class="bub"><span class="typing"><i></i><i></i><i></i></span> <small style="color:#8a6415">' + esc(T.adminTyping) + "</small></div></div>";
      if (m === "closed") html += rateCard();
    }
    if (html === lastHtml) return;
    var stick = nearBottom() || !lastHtml;
    lastHtml = html;
    // احتفظ بقيم النموذج عند إعادة الرسم
    var keep = {};
    root.querySelectorAll(".form input:not([type=checkbox]),.form textarea,.rnote").forEach(function (i) { keep[i.className] = i.value; });
    el.body.innerHTML = html;
    Object.keys(keep).forEach(function (k) {
      var i = root.querySelector("." + k.split(" ")[0]);
      if (i) i.value = keep[k];
    });
    if (stick) toBottom();
    hydratePrices();
  }

  /* أسعار حية من سلة */
  var priceCache = {};
  function hydratePrices() {
    var s = window.salla;
    if (!s || !s.product || !s.product.api || !s.product.api.getDetails) return;
    root.querySelectorAll(".pc[data-pid]").forEach(function (card) {
      var id = card.getAttribute("data-pid");
      var box = card.querySelector(".pr");
      var paint = function (d) {
        if (!d || !box) return;
        var price = d.sale_price && d.is_on_sale ? d.sale_price : d.price;
        var fmt = function (v) {
          if (v && typeof v === "object") v = v.amount;
          return v == null ? "" : Number(v).toLocaleString(isAr ? "ar-SA" : "en", { maximumFractionDigits: 2 }) + (isAr ? " ر.س" : " SAR");
        };
        var main = fmt(price);
        if (main) box.innerHTML = esc(main) + (d.is_on_sale && d.regular_price ? "<s>" + esc(fmt(d.regular_price)) + "</s>" : "");
        if (d.is_available === false) box.innerHTML += ' <small style="color:#c0392b">' + (isAr ? "غير متوفر حالياً" : "Out of stock") + "</small>";
      };
      if (priceCache[id]) return paint(priceCache[id]);
      if (priceCache[id] === null) return;
      priceCache[id] = null;
      try {
        Promise.resolve(s.product.api.getDetails(id))
          .then(function (res) {
            priceCache[id] = (res && (res.data || res)) || null;
            var c = root.querySelector('.pc[data-pid="' + id + '"]');
            if (c) paint(priceCache[id]);
          })
          .catch(function () {});
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------ */
  /* الإرسال                                                              */
  /* ------------------------------------------------------------------ */
  function compressImage(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) return resolve(null);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var w = img.width, h = img.height;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * k);
        c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          resolve(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file.size < 4e6 ? file : null); };
      img.src = url;
    });
  }

  function postMessage(p) {
    var id = identity();
    var fd = new FormData();
    fd.append("message", p.text || "");
    fd.append("language", isAr ? "ar" : "en");
    fd.append("visitor_id", id.key);
    fd.append("page_url", location.href.split("#")[0].slice(0, 500));
    var nm = (id.user && id.user.name) || store(LS.name) || "";
    if (nm) fd.append("customer_name", nm);
    var ph = (id.user && id.user.phone) || store(LS.phone) || "";
    if (ph) fd.append("customer_phone", ph);
    var em = (id.user && id.user.email) || store(LS.email) || "";
    if (em) fd.append("customer_email", em);
    if (p.file) fd.append("image", p.file);
    return api("/api/chat", { method: "POST", body: fd, timeout: 60000 });
  }

  /* ---------- الطلبات (من حساب العميل في سلة) ---------- */
  var ORDER_RE = /(طلبي|طلبيتي|الطلب|رقم الطلب|رقم طلب|طلب رقم|تتبع|التتبع|الشحنه|الشحنة|شحنتي|وين طلب|متى يوصل|متى يوصل|وصل طلب|order|tracking|shipment)/i;
  function localPush(html) {
    S.local.push({ html: html });
    lastHtml = "";
    render();
    toBottom();
  }
  function money(v) {
    var a = v && typeof v === "object" ? v.amount : v;
    return a == null ? "" : Number(a).toLocaleString(isAr ? "ar-SA" : "en", { maximumFractionDigits: 2 }) + (isAr ? " ر.س" : " SAR");
  }
  function orderCard(o) {
    var st = o.status || {};
    var sh = o.shipping || {};
    var trackNo = sh.number && sh.number !== "0" ? sh.number : "";
    var trackUrl = safeUrl(sh.tracking_url || sh.tracing_link || "");
    var items = (o.items || []).map(function (i) { return esc(i.name) + " × " + esc(i.quantity); }).join("<br>");
    var d = o.created_at && (o.created_at.date || o.created_at);
    var date = "";
    try { date = new Date(String(d).replace(" ", "T")).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch (e) {}
    return '<div class="ord"><h5><span>📦 ' + esc(T.orderNo) + " #" + esc(o.reference_id || o.id) + '</span><span class="stt" style="background:' + esc(st.color || "#0d4a42") + '">' + esc(st.name || "") + "</span></h5>" +
      (date ? '<div class="ln"><span>🗓️</span><b>' + esc(date) + "</b></div>" : "") +
      '<div class="ln"><span>' + esc(T.orderTotal) + "</span><b>" + esc(money(o.total)) + "</b></div>" +
      (sh.name ? '<div class="ln"><span>' + esc(T.orderShip) + "</span><b>" + esc(sh.name) + "</b></div>" : "") +
      (trackNo ? '<div class="ln"><span>' + esc(T.orderTrackNo) + '</span><b dir="ltr">' + esc(trackNo) + "</b></div>" : "") +
      (items ? '<div class="its">' + items + "</div>" : "") +
      '<div class="ob">' +
      (trackUrl ? '<a class="pri" href="' + esc(trackUrl) + '" target="_blank" rel="noopener">🚚 ' + esc(T.orderTrack) + "</a>" : "") +
      (o.url ? '<a href="' + esc(safeUrl(o.url)) + '" target="_blank" rel="noopener">' + esc(T.orderView) + "</a>" : "") +
      '<button type="button" class="ord-ask" data-ref="' + esc(o.reference_id || o.id) + '">💬 ' + esc(T.orderAsk) + "</button>" +
      "</div></div>";
  }
  function handleOrderQuestion(text) {
    localPush('<div class="row me"><div class="bub">' + linkify(text) + '<div class="meta">' + esc(fmtTime(new Date().toISOString())) + "</div></div></div>");
    var s = window.salla;
    var api = s && s.order && s.order.api;
    var u = sallaUser();
    var botWrap = function (inner) { return '<div class="row them"><div class="bub"><div class="who">🌿 ' + esc(T.bot) + "</div>" + inner + "</div></div>"; };
    var supportBtn = '<div class="cta">' + esc(T.supportHint) + '<br><button class="hb human2" type="button">' + ICON_USER + esc(T.supportBtn) + "</button></div>";
    if (!api || !api.fetch) {
      localPush(botWrap(esc(T.orderLogin) + '<div class="qs"><a class="chip" style="text-decoration:none" href="https://jothrah.com/ar/account/orders" target="_blank" rel="noopener">📦 ' + esc(T.myOrders) + " ↗</a></div>" + supportBtn));
      return;
    }
    if (!u) {
      localPush(botWrap(esc(T.orderLogin) + '<div class="qs"><button type="button" class="chip do-login">🔐 ' + esc(T.loginBtn) + "</button></div>" + supportBtn));
      return;
    }
    var loadingId = "ld" + uid();
    S.local.push({ id: loadingId, html: botWrap('<span class="typing"><i></i><i></i><i></i></span> <small>' + esc(T.orderLoading) + "</small>") });
    lastHtml = ""; render(); toBottom();
    var num = (String(text).replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); }).match(/\d{4,}/) || [])[0] || "";
    Promise.resolve(api.fetch())
      .then(function (res) {
        var list = (res && (res.data || res)) || [];
        if (!Array.isArray(list)) list = list.data || [];
        var match = num ? list.filter(function (o) { return String(o.reference_id) === num || String(o.id) === num; }) : [];
        var show = match.length ? match : list.slice(0, 3);
        return Promise.all(show.map(function (o) {
          return Promise.resolve(api.getDetails(o.id)).then(function (r) { return (r && (r.data || r)) || o; }).catch(function () { return o; });
        })).then(function (details) { return { details: details, found: match.length > 0, total: list.length }; });
      })
      .then(function (r) {
        S.local = S.local.filter(function (x) { return x.id !== loadingId; });
        var head = !r.total ? esc(T.orderNone) : num && !r.found ? esc(T.orderNotFound) : "<b>" + esc(T.ordersTitle) + "</b>";
        localPush(botWrap(head + r.details.map(orderCard).join("") + supportBtn));
      })
      .catch(function () {
        S.local = S.local.filter(function (x) { return x.id !== loadingId; });
        localPush(botWrap(esc(T.orderLogin) + supportBtn));
      });
  }

  function send(text, file, preview) {
    text = String(text || "").trim();
    if ((!text && !file) || S.sending && mode() === "ai") return;
    if (S.conv && S.conv.id && store(LS.dismissed) === S.conv.id) store(LS.dismissed, null);
    var p = { lid: uid(), text: text || (file ? (isAr ? "صورة مرفقة" : "Attached image") : ""), file: file || null, preview: preview || "", status: "sending" };
    S.pending.push(p);
    S.sending = true;
    S.botTyping = mode() === "ai" ? Date.now() : 0;
    S.view = "chat";
    render();
    toBottom();
    postMessage(p)
      .then(function (res) {
        if (res && res.conversation_id && (!S.conv || S.conv.id !== res.conversation_id)) {
          S.conv = { id: res.conversation_id, status: res.status || "ai" };
          S.cursor = "";
          S.msgs = [];
        }
        return sync(!S.cursor);
      })
      .then(function () {
        // الصورة المرسلة: احذف المؤقت (النص قد يختلف)
        S.pending = S.pending.filter(function (x) { return x.lid !== p.lid; });
      })
      .catch(function () {
        p.status = "error";
      })
      .finally(function () {
        S.sending = false;
        S.botTyping = 0;
        render();
        toBottom();
        schedulePoll();
      });
  }

  function requestHuman(name, phone, topic, email, geo) {
    var id = identity();
    if (name) store(LS.name, name);
    if (phone) store(LS.phone, phone);
    if (email) store(LS.email, email);
    S.view = "chat";
    S.connecting = true;
    render();
    return Promise.resolve().then(function () { return api("/api/chat/human", {
      method: "POST",
      body: {
        visitor_id: id.key,
        language: isAr ? "ar" : "en",
        message: topic || (isAr ? "طلب تواصل مع مختص جذرة" : "Requested a Jothrah specialist"),
        page_url: window.location.href.split("#")[0].slice(0, 500),
        customer_name: name,
        customer_phone: phone,
        customer_email: email || (id.user && id.user.email) || "",
        location: geo || null,
      },
    }); })
      .then(function (res) {
        if (res && res.conversation_id && (!S.conv || S.conv.id !== res.conversation_id)) {
          S.conv = { id: res.conversation_id, status: "needs_human" };
          S.cursor = "";
          S.msgs = [];
        }
        return sync(true);
      })
      .then(function () {
        if (topic) return postMessage({ text: topic }).then(function () { return sync(false); });
      })
      .catch(function () {
        S.pending.push({ lid: uid(), text: T.talkHuman, status: "error", human: true });
      })
      .finally(function () {
        S.connecting = false;
        if (S.lastHumanCount < 0) S.lastHumanCount = 0;
        render();
        toBottom();
        schedulePoll();
      });
  }

  function typingPing() {
    if (mode() !== "human" || !S.conv || !S.conv.id) return;
    var now = Date.now();
    if (now - S.lastTypingPing < 2500) return;
    S.lastTypingPing = now;
    api("/api/chat/typing", { method: "POST", body: { conversation_id: S.conv.id, visitor_id: identity().key, draft: el.ta.value } }).catch(function () {});
  }

  /* ------------------------------------------------------------------ */
  /* الأحداث                                                              */
  /* ------------------------------------------------------------------ */
  function setOpen(v) {
    S.open = v;
    el.panel.classList.toggle("on", v);
    store(LS.open, v ? "1" : "0");
    var n = root.querySelector(".nudge");
    if (n) n.remove();
    if (v) {
      S.unread = 0;
      updateBadge();
      render();
      setTimeout(function () {
        toBottom();
        if (window.innerWidth > 520) el.ta.focus();
      }, 60);
      if (window.innerWidth <= 520) document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
    schedulePoll();
  }

  el.launch.addEventListener("click", function () { setOpen(!S.open); });
  el.x.addEventListener("click", function () { setOpen(false); });
  el.human.addEventListener("click", function () { S.view = "handoff"; render(); });

  el.ta.addEventListener("input", function () {
    el.ta.style.height = "auto";
    el.ta.style.height = Math.min(120, el.ta.scrollHeight) + "px";
    el.send.disabled = !el.ta.value.trim() && !S.image;
    typingPing();
  });
  el.ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.innerWidth > 520) {
      e.preventDefault();
      doSend();
    }
  });
  var HUMAN_RE = /(مختص|مهندس|موظف|خدمة العملاء|إنسان|انسان|شخص حقيقي|أكلم أحد|اكلم احد|specialist|agronomist|engineer|human|agent)/i;
  function doSend() {
    var text = el.ta.value;
    var img = S.image;
    if (!text.trim() && !img) return;
    if (!img && mode() === "ai" && ORDER_RE.test(text) && text.length < 160) {
      el.ta.value = "";
      el.ta.style.height = "auto";
      el.send.disabled = true;
      return handleOrderQuestion(text.trim());
    }
    if (!img && mode() === "ai" && HUMAN_RE.test(text) && text.length < 80) {
      el.ta.value = "";
      el.send.disabled = true;
      S.view = "handoff";
      lastHtml = "";
      render();
      var tp = root.querySelector(".f-topic");
      if (tp) tp.value = text;
      return;
    }
    el.ta.value = "";
    el.ta.style.height = "auto";
    el.send.disabled = true;
    S.image = null;
    el.pvw.innerHTML = "";
    send(text, img && img.file, img && img.preview);
  }
  el.send.addEventListener("click", doSend);
  el.att.addEventListener("click", function () { el.file.click(); });
  el.file.addEventListener("change", function () {
    var f = el.file.files && el.file.files[0];
    el.file.value = "";
    if (!f) return;
    compressImage(f).then(function (file) {
      if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        S.image = { file: file, preview: r.result };
        el.pvw.innerHTML = '<div class="pv"><img alt="" src="' + esc(r.result) + '"><span>' + esc(T.imgCaption) + '</span><button type="button" class="pvx" aria-label="x">' + ICON_X + "</button></div>";
        el.send.disabled = false;
        el.ta.focus();
      };
      r.readAsDataURL(file);
    });
  });
  el.pvw.addEventListener("click", function (e) {
    if (e.target.closest(".pvx")) {
      S.image = null;
      el.pvw.innerHTML = "";
      el.send.disabled = !el.ta.value.trim();
    }
  });

  el.body.addEventListener("click", function (e) {
    var t = e.target;
    var q = t.closest(".chip[data-q]");
    if (q) {
      var text = q.getAttribute("data-q");
      if (q.classList.contains("st4")) return el.att.click();
      if (q.classList.contains("st5")) return handleOrderQuestion(T.orderQ);
      if (mode() === "ai" && ORDER_RE.test(text)) return handleOrderQuestion(text);
      return send(text);
    }
    if (t.closest(".human2")) { S.view = "handoff"; return render(); }
    if (t.closest(".notif-on")) { askNotifications(); return; }
    var oa = t.closest(".ord-ask");
    if (oa) {
      S.view = "handoff";
      lastHtml = "";
      render();
      var tp = root.querySelector(".f-topic");
      if (tp) tp.value = (isAr ? "استفسار عن الطلب رقم " : "Question about order #") + oa.getAttribute("data-ref");
      return;
    }
    if (t.closest(".do-login")) {
      setOpen(false);
      try { if (window.salla && salla.event && salla.event.dispatch) salla.event.dispatch("login::open"); } catch (e2) {}
      // احتياط: زر تسجيل الدخول في هيدر المتجر
      setTimeout(function () {
        var modal = document.querySelector("salla-login-modal");
        var opened = modal && (modal.shadowRoot || modal).querySelector && document.querySelector(".s-modal-wrapper:not(.hidden), salla-modal[open]");
        if (opened) return;
        var trigger = document.querySelector('[onclick*="login::open"], salla-user-menu, .s-user-menu-trigger, a[href*="/login"]');
        if (trigger && trigger.click) trigger.click();
      }, 700);
      return;
    }
    if (t.closest(".f-back")) { S.view = "chat"; return render(); }
    var retry = t.closest(".retry");
    if (retry) {
      var lid = retry.getAttribute("data-lid");
      var p = S.pending.filter(function (x) { return x.lid === lid; })[0];
      S.pending = S.pending.filter(function (x) { return x.lid !== lid; });
      if (p && p.human) { S.view = "handoff"; return render(); }
      if (p) return send(p.text, p.file, p.preview);
    }
    var star = t.closest(".stars button");
    if (star) {
      var n = Number(star.getAttribute("data-r"));
      root.querySelectorAll(".stars button").forEach(function (b) { b.classList.toggle("on", Number(b.getAttribute("data-r")) <= n); });
      root.querySelector(".stars").setAttribute("data-v", n);
      var rs = root.querySelector(".rsend");
      if (rs) rs.disabled = false;
      return;
    }
    if (t.closest(".rsend")) {
      var v = Number((root.querySelector(".stars") || { getAttribute: function () { return 0; } }).getAttribute("data-v") || 0);
      if (!v || !S.conv) return;
      api("/api/chat/rating", { method: "POST", body: { conversation_id: S.conv.id, rating: v, note: (root.querySelector(".rnote") || {}).value || "" } })
        .catch(function () {})
        .finally(function () { S.rated = true; lastHtml = ""; render(); });
      return;
    }
    if (t.closest(".newc")) {
      if (S.conv) store(LS.dismissed, S.conv.id);
      store(LS.conv, null);
      S.conv = null; S.msgs = []; S.pending = []; S.local = []; S.cursor = ""; S.rated = false; S.lastHumanCount = -1;
      lastHtml = "";
      return render();
    }
    var add = t.closest(".addc");
    if (add) {
      var pid = add.getAttribute("data-pid");
      var url = add.getAttribute("data-url");
      var s = window.salla;
      if (s && s.cart && s.cart.addItem) {
        add.disabled = true;
        Promise.resolve(s.cart.addItem({ id: Number(pid), quantity: 1 }))
          .then(function () { add.textContent = T.added; })
          .catch(function () { window.open(url, "_blank", "noopener"); add.disabled = false; });
      } else {
        window.open(url, "_blank", "noopener");
      }
      return;
    }
    var im = t.closest("img.att");
    if (im) {
      var lb = document.createElement("div");
      lb.className = "lb";
      lb.innerHTML = '<img alt="" src="' + esc(im.getAttribute("src")) + '">';
      lb.addEventListener("click", function () { lb.remove(); });
      root.querySelector(".w").appendChild(lb);
    }
  });

  el.body.addEventListener("submit", function (e) {
    var form = e.target.closest && e.target.closest(".form");
    if (!form) return;
    e.preventDefault();
    var val = function (c) { return ((root.querySelector(c) || {}).value || "").trim(); };
    var name = val(".f-name");
    var phone = val(".f-phone").replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); });
    phone = phone.replace(/[\s\-()]/g, "").replace(/^(\+|00)?966/, "0").replace(/^5/, "05");
    var email = val(".f-email");
    var topic = val(".f-topic");
    var er = root.querySelector(".form .err");
    var fail = function (msg) { if (er) er.textContent = msg; };
    if (!name) return fail(T.nameReq);
    if (!phone && !email) return fail(T.contactReq);
    if (phone && !/^\+?\d{9,15}$/.test(phone)) return fail(T.phoneBad);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(T.emailBad);
    askNotifications();
    var wantLoc = (root.querySelector(".f-loc") || {}).checked;
    var btn = root.querySelector(".f-go");
    if (btn) { btn.disabled = true; btn.textContent = wantLoc ? T.locWait : "…"; }
    (wantLoc ? getLocation() : Promise.resolve(null)).then(function (loc) {
      lastHtml = "";
      requestHuman(name.slice(0, 80), phone.slice(0, 20), topic.slice(0, 600), email.slice(0, 120), loc);
    });
  });

  // عدّاد الانتظار حي
  setInterval(function () {
    if (S.botTyping && Date.now() - S.botTyping > 65000) { S.botTyping = 0; S.sending = false; lastHtml = ""; render(); }
    if (!S.open || !waitingForHuman()) return;
    var e = root.querySelector(".elapsed");
    var req = ts(S.conv && S.conv.human_requested_at);
    if (e && req) e.textContent = mmss(Date.now() - req);
    if (req && Date.now() - req > 4 * 60 * 1000 && e && !root.querySelector(".wait").textContent.includes(T.waitLong.slice(0, 12))) {
      lastHtml = "";
      render();
    }
  }, 1000);

  // لوحة المفاتيح في الجوال
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      if (!S.open || window.innerWidth > 520) return;
      el.panel.style.height = window.visualViewport.height + "px";
      toBottom();
    });
  }

  /* ------------------------------------------------------------------ */
  /* التشغيل                                                              */
  /* ------------------------------------------------------------------ */
  function removeLegacy() {
    var old = document.getElementById("jth-chat");
    if (old) old.remove();
  }

  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    removeLegacy();
    try {
      new MutationObserver(removeLegacy).observe(document.body, { childList: true });
    } catch (e) {}
    document.body.appendChild(host);
    render();
    sync(true)
      .then(function () {
        S.lastHumanCount = S.msgs.filter(function (m) { return m.sender_type === "human"; }).length;
        render();
        if (store(LS.open) === "1") setOpen(true);
        schedulePoll();
      })
      .catch(function () {});

    // تلميح لطيف مرة واحدة في الجلسة
    if (!sstore(LS.nudge)) {
      setTimeout(function () {
        if (S.open || S.msgs.length || sstore(LS.nudge)) return;
        sstore(LS.nudge, "1");
        var n = document.createElement("div");
        n.className = "nudge";
        n.innerHTML = "<b aria-label=\"x\">×</b>" + esc(T.nudge);
        n.addEventListener("click", function (e) {
          n.remove();
          if (!e.target.closest("b")) setOpen(true);
        });
        root.querySelector(".w").appendChild(n);
        setTimeout(function () { if (n.parentNode) n.remove(); }, 15000);
      }, 20000);
    }

    window.JothrahChat = {
      version: VERSION,
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      ask: function (q) { setOpen(true); send(q); },
      specialist: function () { setOpen(true); S.view = "handoff"; render(); },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
