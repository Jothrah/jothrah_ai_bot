(function () {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js")
        .then(function (reg) {
          // يفحص وجود نسخة جديدة كل ما رجعت للتطبيق
          document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible") reg.update().catch(function () {});
          });
        })
        .catch(function () {});
    });
  }

  // تطبيق الجوال يبقى مفتوح بالخلفية؛ إذا رجعت له بعد غياب طويل يعيد التحميل
  // عشان يجيب آخر نسخة من الموقع تلقائياً بدون ما تحذف التطبيق وترجعه.
  var hiddenAt = 0;
  var standalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (!standalone || !hiddenAt) return;
    var away = Date.now() - hiddenAt;
    var el = document.activeElement;
    var typing = el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "button"));
    if (away > 10 * 60 * 1000 && !typing) window.location.reload();
  });

  // تحديث تلقائي فور نشر نسخة جديدة من اللوحة (بدون حذف التطبيق وإعادته)
  var current = "";
  function isTyping() {
    var el = document.activeElement;
    return !!(el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "button" && el.type !== "checkbox")) && el.value);
  }
  function checkVersion() {
    if (!/^\/admin/.test(location.pathname)) return;
    fetch("/api/version", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var v = j && j.version;
        if (!v) return;
        if (!current) { current = v; return; }
        if (v !== current && !isTyping()) window.location.reload();
      })
      .catch(function () {});
  }
  checkVersion();
  setInterval(function () { if (document.visibilityState === "visible") checkVersion(); }, 2 * 60 * 1000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checkVersion(); });
})();
