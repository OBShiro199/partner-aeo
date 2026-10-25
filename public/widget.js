/* AI search scanner embed. Usage:
   <div data-partner-aeo="pk_..."></div>
   <script async src="https://partneraeo.com/widget.js"></script> */
(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://partneraeo.com";
  var frames = {};

  function mount(el) {
    if (!el || el.getAttribute("data-aeo-mounted")) return;
    var key = el.getAttribute("data-partner-aeo");
    if (!/^pk_[a-f0-9]{32}$/.test(key || "")) return;
    el.setAttribute("data-aeo-mounted", "1");
    var f = document.createElement("iframe");
    f.src = origin + "/embed/" + key + "?host=" + encodeURIComponent(location.hostname);
    f.title = "AI search scanner";
    f.loading = "lazy";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "width:100%;max-width:" + (el.getAttribute("data-max-width") || "640px") + ";height:560px;border:0;display:block;margin:0 auto;color-scheme:light;transition:height .25s ease";
    el.appendChild(f);
    (frames[key] = frames[key] || []).push(f);
  }

  function mountAll() {
    var els = document.querySelectorAll("[data-partner-aeo]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== "partner-aeo:height") return;
    var list = frames[e.data.key] || [];
    for (var i = 0; i < list.length; i++) if (list[i].contentWindow === e.source) list[i].style.height = Math.max(320, e.data.height) + "px";
  });

  window.PartnerAEO = { mount: mountAll };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
