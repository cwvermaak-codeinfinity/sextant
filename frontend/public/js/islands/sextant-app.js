/* <sextant-app> — decides whether you are looking at a sign-in or the console.
 *
 * ── The trap, do not reintroduce it ─────────────────────────────────────────
 * Tina4Element calls render() INSIDE a reactive effect, so render() re-runs on
 * every signal change. Creating a signal in render() therefore builds a NEW one
 * on every pass and re-fires whatever depends on it — an effect that never
 * settles, presenting as an island that renders nothing at all rather than as
 * an error. Signals are instance state, created once in the constructor; side
 * effects belong in onMount(), which runs once.
 */
(function () {
  const { html, Tina4Element } = Tina4;
  const S = window.Sextant;

  const SSO_ATTEMPT = "sextant.sso.attempted";

  /* Start the provider round trip for an unauthenticated visitor.
   * Returns true when the page is navigating away, so the caller stops.
   *
   * THE GUARD IS THE POINT. If the provider hands them back still
   * unauthenticated -- a group requirement they do not meet, a rotated client
   * secret -- an unguarded redirect is an infinite loop between two hosts,
   * showing a blank page and logging nothing anywhere. One attempt per tab,
   * then fall through to the card so the reason is visible and the break-glass
   * door is reachable.
   *
   * `?local=1` opts out, which is how you reach the break-glass form when the
   * provider is up but you do not want it.
   */
  function beginSingleSignOn() {
    const root = document.querySelector("sextant-app");
    if (!root || root.getAttribute("oidc") !== "true") return false;
    const params = new URLSearchParams(location.search);
    // ?local=1 asks for the break-glass form. ?signed-out=1 is set by /logout
    // so that signing out does not immediately sign you back in.
    if (params.get("local") === "1") return false;
    if (params.get("signed-out") === "1") return false;
    try {
      if (sessionStorage.getItem(SSO_ATTEMPT) === "1") return false;
      sessionStorage.setItem(SSO_ATTEMPT, "1");
    } catch (err) {
      // Storage refused -- private windows, blocked site data. Without a place
      // to record the attempt there is no loop guard, so do not start one.
      return false;
    }
    location.assign("/login");
    return true;
  }

  function forgetSingleSignOn() {
    try { sessionStorage.removeItem(SSO_ATTEMPT); } catch (err) { /* nothing to undo */ }
  }

  class SextantApp extends Tina4Element {
    /* Light DOM, not shadow. Tina4Element.shadow defaults to TRUE, and a shadow
     * root is a style boundary — /css/sextant.css would not reach inside it and
     * the whole console would render unstyled while the stylesheet loaded fine. */
    static shadow = false;

    constructor() {
      super();
      this.ready = S.busy;
      this.checked = Tina4.signal(false);
    }

    async onMount() {
      await S.loadMe();
      // Already signed in at the provider? Then a card with one button on it is
      // a stop sign in front of an open door. Send them through instead; the
      // round trip is invisible when the provider session exists.
      if (!S.me.value && beginSingleSignOn()) return;
      if (S.me.value) forgetSingleSignOn();
      this.checked.value = true;
    }

    render() {
      if (!this.checked.value) {
        return html`<div class="empty">Loading…</div>`;
      }
      if (!S.me.value) {
        return html`<sextant-signin></sextant-signin>`;
      }
      return html`
        <div class="shell">
          <sextant-rail></sextant-rail>
          <sextant-workspace></sextant-workspace>
        </div>
      `;
    }
  }

  customElements.define("sextant-app", SextantApp);
})();
