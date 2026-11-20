// The stand-in for Google's sign-in script (accounts.google.com/gsi/client) for the walk-throughs: never Google's real
// script. A test browser answers that address with GIS_STUB (shot-signin, shot-launch).
// google.accounts.id as the site uses it: initialize (kept for the checks), renderButton (a button of Google's measured
// size: dark 194x40, light 191x32), disableAutoSelect. A click makes an ID token for the newest config's nonce (or, in
// `wrong-nonce` mode, for another one) and gives it to that config's callback, as Google's library does.
export const GIS_STUB = `(() => {
  const log = (window.__gis = { configs: [], renders: [], disabled: 0, email: "nobody@dev.test", mode: "ok", credentials: [] });
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  const token = (cfg) => {
    const now = Math.floor(Date.now() / 1000);
    const nonce = log.mode === "wrong-nonce" ? "f".repeat(64) : cfg.nonce;
    return b64({ alg: "RS256", kid: "stub", typ: "JWT" }) + "." + b64({ iss: "https://accounts.google.com", aud: cfg.client_id, sub: "g-" + log.email, email: log.email, email_verified: true, name: "Stub Person", nonce, iat: now, exp: now + 3600 }) + ".c3R1Yg";
  };
  window.google = { accounts: { id: {
    initialize(cfg) { log.configs.push(cfg); log.cfg = cfg; },
    renderButton(el, opts) {
      log.renders.push(opts);
      const b = document.createElement("div");
      const large = opts.size !== "medium", dark = opts.theme === "filled_black";
      b.setAttribute("role", "button");
      b.tabIndex = 0;
      b.className = "stub-gis";
      b.textContent = opts.text === "continue_with" ? "Continue with Google" : opts.text === "signin" ? "Sign in" : "Sign in with Google";
      // As wide as its words, or as opts.width when that is more (Google's own rule: width is the least it takes).
      const natural = opts.text === "signin" ? (large ? 120 : 104) : large ? 194 : 191;
      Object.assign(b.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
        width: Math.max(natural, Number(opts.width) || 0) + "px", height: large ? "40px" : "32px", borderRadius: large ? "20px" : "16px",
        font: "500 14px system-ui, sans-serif", cursor: "pointer", background: dark ? "#131314" : "#ffffff",
        color: dark ? "#e3e3e3" : "#1f1f1f", border: dark ? "0" : "1px solid #747775" });
      b.addEventListener("click", () => {
        // Google calls the button's click_listener first, then the client's callback with the token.
        opts.click_listener?.();
        log.clicked = (log.clicked || 0) + 1;
        const cfg = log.cfg;
        const credential = token(cfg);
        log.credentials.push({ credential, cfg: log.configs.indexOf(cfg) });
        cfg.callback({ credential, select_by: "btn" });
      });
      el.appendChild(b);
    },
    disableAutoSelect() { log.disabled++; },
    prompt() {},
    cancel() {},
  } } };
})();`;
