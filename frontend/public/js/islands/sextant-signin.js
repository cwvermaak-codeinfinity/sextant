/* <sextant-signin> — the local break-glass door.
 *
 * Not the front door any more. When a provider is configured the shell sends
 * an unauthenticated visitor straight to it, so this card is only reached when
 * that round trip came back without signing them in, or when they asked for it
 * with ?local=1.
 *
 * The username and password fields are for the day the identity provider is
 * ITSELF the outage, which is the day a database console matters most. They are
 * hidden until then, because a password box offered next to a working SSO
 * button is an invitation to type a password into the wrong place.
 */
(function () {
  const { signal, html, Tina4Element } = Tina4;
  const S = window.Sextant;

  class SextantSignin extends Tina4Element {
    static shadow = false;

    constructor() {
      super();
      // Created once. See the note in sextant-app.js.
      this.failed = signal(null);
      this.working = signal(false);
    }

    async submit(event) {
      event.preventDefault();
      const form = event.target.closest("form") || event.target;
      // Read from the DOM rather than binding value= on the inputs. A controlled
      // input inside a reactive render loses the caret position on every
      // keystroke, which makes a password field unusable.
      const username = form.querySelector('[name="username"]').value;
      const password = form.querySelector('[name="password"]').value;

      this.working.value = true;
      this.failed.value = null;
      const r = await S.api("/sign-in", { method: "POST", body: { username, password } });
      this.working.value = false;

      if (!r.ok) {
        this.failed.value = r.error;
        return;
      }
      await S.loadMe();
    }

    render() {
      const failed = this.failed.value;
      const working = this.working.value;
      // Read off <sextant-app>, which the server rendered. An inline <script>
      // carrying this would be blocked by `default-src 'self'` and the button
      // would simply never appear.
      const root = document.querySelector("sextant-app");
      const oidc = root && root.getAttribute("oidc") === "true";
      const provider = (root && root.getAttribute("provider")) || "single sign-on";

      // Reaching this card with SSO configured means the round trip already
      // happened and did not sign them in. Say so, and offer the other door.
      const askedForLocal =
        new URLSearchParams(location.search).get("local") === "1";
      let ssoFailed = false;
      try {
        ssoFailed = oidc && !askedForLocal &&
          sessionStorage.getItem("sextant.sso.attempted") === "1";
      } catch (err) { /* no storage, no claim either way */ }
      const showLocal = !oidc || askedForLocal || ssoFailed;

      // TWO SEPARATE TOP-LEVEL TEMPLATES, deliberately, rather than one with the
      // form wrapped in ${showLocal ? html`...`}. The form carries an @submit
      // binding, and tina4js attaches listeners while walking the template it
      // renders; putting that binding inside a nested conditional template is
      // untested here, and the failure mode is the silent one -- the markup
      // appears and the handler never fires. That cost a day on 24 August when
      // 48 handlers were inert. The duplication is the cheap half of this trade.
      const head = html`
            <h1>Sextant</h1>
            <p>Sign in to reach the databases this console is configured for.</p>

            ${failed ? html`<div class="notice bad">${failed}</div>` : ""}

            ${ssoFailed && !failed ? html`
              <div class="notice bad">
                ${provider} did not sign you in. You may not be in a group this
                console requires.
              </div>
            ` : ""}

            ${oidc ? html`
              <a class="btn primary sso" href="/login">Sign in with ${provider}</a>
            ` : ""}
      `;

      if (!showLocal) {
        return html`
          <div class="signin">
            <div class="card">
              ${head}
            </div>
          </div>
        `;
      }

      return html`
        <div class="signin">
          <div class="card">
            ${head}

            ${oidc ? html`<p class="or">or use the break-glass credential</p>` : ""}

            <form @submit=${(e) => this.submit(e)}>
              <label>
                Username
                <input type="text" name="username" autocomplete="username" autofocus />
              </label>
              <label>
                Password
                <input type="password" name="password" autocomplete="current-password" />
              </label>
              <button class="btn primary" type="submit" disabled=${working}>
                ${working ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      `;
    }
  }

  customElements.define("sextant-signin", SextantSignin);
})();
