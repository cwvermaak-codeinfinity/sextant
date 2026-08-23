/* <sextant-rail> — connections, databases and collections down the left.
 *
 * Loads lazily: databases when a connection is picked, collections when a
 * database is. Listing every collection on every database up front means a
 * `listCollections` per database on a server that might hold hundreds, and the
 * console would sit blank while it finished.
 */
(function () {
  const { signal, html, Tina4Element } = Tina4;
  const S = window.Sextant;

  class SextantRail extends Tina4Element {
    static shadow = false;

    constructor() {
      super();
      this.databases = signal([]);
      this.collections = signal([]);
      this.loadingDbs = signal(false);
      this.loadingCols = signal(false);
      this.failed = signal(null);
      this._lastConnection = null;
      this._lastDatabase = null;
    }

    onMount() {
      this.refresh();
    }

    /* render() re-runs on every signal change, so the fetch cannot live there.
     * This is called from onMount and from the click handlers instead, and it
     * guards against refetching what it already has. */
    async refresh() {
      const conn = S.connectionId.value;
      if (conn && conn !== this._lastConnection) {
        this._lastConnection = conn;
        this._lastDatabase = null;
        this.collections.value = [];
        this.loadingDbs.value = true;
        const r = await S.api(`/api/${encodeURIComponent(conn)}/databases`);
        this.loadingDbs.value = false;
        if (r.ok) { this.databases.value = r.data.databases || []; this.failed.value = null; }
        else { this.databases.value = []; this.failed.value = r.error; }
      }

      const db = S.database.value;
      if (conn && db && db !== this._lastDatabase) {
        this._lastDatabase = db;
        this.loadingCols.value = true;
        const r = await S.api(
          `/api/${encodeURIComponent(conn)}/${encodeURIComponent(db)}/collections`);
        this.loadingCols.value = false;
        if (r.ok) { this.collections.value = r.data.collections || []; this.failed.value = null; }
        else { this.collections.value = []; this.failed.value = r.error; }
      }
    }

    pickConnection(id) {
      if (S.connectionId.value === id) return;
      S.connectionId.value = id;
      S.database.value = null;
      S.collection.value = null;
      this.refresh();
    }

    pickDatabase(name) {
      if (S.database.value === name) return;
      S.database.value = name;
      S.collection.value = null;
      this.refresh();
    }

    pickCollection(name) {
      S.collection.value = name;
      S.tab.value = "documents";
    }

    render() {
      const me = S.me.value;
      const conns = (me && me.connections) || [];
      const activeConn = S.connectionId.value;
      const activeDb = S.database.value;
      const activeCol = S.collection.value;

      return html`
        <aside class="rail">
          <div class="rail-head">
            <span class="mark"></span>
            <h1>Sextant</h1>
          </div>

          <div class="rail-body">
            ${this.failed.value ? html`<div class="notice bad" style="margin:10px">${this.failed.value}</div>` : ""}

            <h2>Connections</h2>
            ${conns.length === 0
              ? html`<div class="empty">No connections are available to you.</div>`
              : conns.map((c) => html`
                  <div class="tree-item" aria-current=${String(c.id === activeConn)}
                       onclick=${() => this.pickConnection(c.id)}>
                    <span>${c.name}</span>
                    <span class=${"badge " + (c.writable ? "rw" : "ro")}>
                      ${c.writable ? "rw" : "ro"}
                    </span>
                  </div>
                `)}

            ${activeConn ? html`
              <h2>Databases</h2>
              ${this.loadingDbs.value
                ? html`<div class="empty">Loading…</div>`
                : this.databases.value.length === 0
                  ? html`<div class="empty">Nothing this credential can see.</div>`
                  : this.databases.value.map((d) => html`
                      <div class="tree-item db" aria-current=${String(d.name === activeDb)}
                           onclick=${() => this.pickDatabase(d.name)}>
                        <span>${d.name}</span>
                      </div>
                      ${d.name === activeDb ? html`
                        ${this.loadingCols.value
                          ? html`<div class="empty">Loading…</div>`
                          : this.collections.value.map((c) => html`
                              <div class="tree-item col" aria-current=${String(c.name === activeCol)}
                                   onclick=${() => this.pickCollection(c.name)}>
                                <span>${c.name}</span>
                                <span class="count">
                                  ${c.estimated_count === null ? "?" : c.estimated_count}
                                </span>
                              </div>
                            `)}
                      ` : ""}
                    `)}
            ` : ""}
          </div>
        </aside>
      `;
    }
  }

  customElements.define("sextant-rail", SextantRail);
})();
