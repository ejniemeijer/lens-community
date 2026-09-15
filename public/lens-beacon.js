/*! Lens beacon — MIT licensed (Copyright (c) 2026 Erik Niemeijer), unlike the
 * Lens server (AGPL-3.0), so it can be embedded in ANY app under test — closed
 * source included — with no copyleft obligations. Full text: LICENSE-beacon in
 * the Lens repository. */
/* Lens beacon v1 — paste into a prototype app under test (or prompt your AI
 * builder to include it on every page). Captures route views and clicks —
 * never form values, keystrokes, or page content — and reports them to the
 * Lens test session identified by the ?lens= URL parameter.
 *
 * The endpoint comes from window.LENS_ENDPOINT or the script tag's
 * data-endpoint attribute; the Lens builder generates both lines for you. */
(function () {
  var endpoint =
    window.LENS_ENDPOINT ||
    (document.currentScript && document.currentScript.dataset.endpoint);
  if (!endpoint) return;

  var m = location.search.match(/[?&]lens=([^&]+)/);
  var sid = m ? decodeURIComponent(m[1]) : sessionStorage.getItem("lens-session");
  if (!sid) return; // no session context — capture is opt-in per visit
  sessionStorage.setItem("lens-session", sid);

  var t0 = Date.now();
  var buf = [];

  function push(e) {
    buf.push(e);
    if (buf.length >= 50) flush();
  }

  function flush(useBeacon) {
    if (!buf.length) return;
    var body = JSON.stringify({ session: sid, events: buf.splice(0) });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body); // text/plain — survives tab close
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  function page() {
    push({ t: Date.now() - t0, type: "page", path: location.pathname + location.hash });
  }

  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      page();
      return r;
    };
  });
  addEventListener("popstate", page);
  addEventListener("hashchange", page);

  addEventListener(
    "click",
    function (ev) {
      var el = ev.target;
      if (el.closest) el = el.closest("a,button,[role=button],input,select,label") || ev.target;
      var sel =
        el.tagName.toLowerCase() +
        (el.id ? "#" + el.id : "") +
        (typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "");
      var doc = document.documentElement;
      push({
        t: Date.now() - t0,
        type: "click",
        path: location.pathname + location.hash,
        sel: sel.slice(0, 120),
        x: +(ev.clientX / innerWidth).toFixed(4),
        y: +(ev.clientY / innerHeight).toFixed(4),
        // v2: scroll-corrected, normalized against the full document — these
        // line up with a screenshot of the whole page.
        dx: +((ev.clientX + scrollX) / Math.max(doc.scrollWidth, innerWidth)).toFixed(4),
        dy: +((ev.clientY + scrollY) / Math.max(doc.scrollHeight, innerHeight)).toFixed(4),
        // v3: the participant's actual layout in px at click time — viewport
        // and full document. Lets results segment by breakpoint and render
        // size-faithful overlays.
        vw: Math.round(innerWidth),
        vh: Math.round(innerHeight),
        dw: Math.round(Math.max(doc.scrollWidth, innerWidth)),
        dh: Math.round(Math.max(doc.scrollHeight, innerHeight)),
      });
    },
    true
  );

  addEventListener("pagehide", function () {
    flush(true);
  });
  setInterval(flush, 3000);
  page();
})();
