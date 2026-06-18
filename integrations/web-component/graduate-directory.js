/**
 * The Directory — universal embed.
 *
 * A framework-agnostic Web Component. Drop it on ANY site (Webflow, Squarespace,
 * Wix, plain HTML) — it consumes the same REST contract as every other adapter
 * and renders into Shadow DOM (style-isolated).
 *
 *   <script src="https://cdn.thedirectory.example/embed.js"></script>
 *   <graduate-directory
 *      school="breathwork-global"
 *      api-base="https://api.thedirectory.example"
 *      modality="holotropic"></graduate-directory>
 *
 * Client-side render = weaker SEO; SEO-sensitive hosts use a native SSR adapter
 * (WordPress plugin / Drupal module). Same contract, same card markup.
 */
class GraduateDirectory extends HTMLElement {
  static get observedAttributes() {
    return ["school", "api-base", "modality", "q", "online"];
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  async render() {
    const school = this.getAttribute("school");
    const apiBase = (this.getAttribute("api-base") || "").replace(/\/$/, "");
    if (!school || !apiBase) {
      this.shadowRoot.innerHTML =
        '<p>Configure <code>school</code> and <code>api-base</code>.</p>';
      return;
    }
    const params = new URLSearchParams();
    for (const key of ["modality", "q", "online"]) {
      const v = this.getAttribute(key);
      if (v) params.set(key === "online" ? "online" : key, v);
    }
    this.shadowRoot.innerHTML = `${STYLE}<div class="gd-grid">Loading…</div>`;

    try {
      const res = await fetch(
        `${apiBase}/v1/schools/${encodeURIComponent(school)}/search?${params}`,
      );
      const data = await res.json();
      const cards = (data.results || []).map((p) => card(p)).join("");
      this.shadowRoot.querySelector(".gd-grid").innerHTML =
        cards || "<p>No practitioners found.</p>";
    } catch (err) {
      this.shadowRoot.querySelector(".gd-grid").textContent =
        "Could not load the directory.";
    }
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function card(p) {
  const where = [p.city, p.country].filter(Boolean).join(", ");
  const badges = [
    p.verified ? '<span class="gd-badge gd-verified">✓ Verified</span>' : "",
    p.offersOnline ? '<span class="gd-badge">Online</span>' : "",
  ].join("");
  return `<article class="gd-card">
    <h3>${esc(p.displayName)}</h3>
    <p class="gd-headline">${esc(p.headline || "")}</p>
    <p class="gd-meta">${esc(where)} ${badges}</p>
    <p class="gd-modalities">${(p.modalities || []).map(esc).join(" · ")}</p>
  </article>`;
}

const STYLE = `<style>
  :host { display:block; font-family: system-ui, sans-serif; color:#1d2b2f; }
  .gd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
  .gd-card { border:1px solid #e2e8e9; border-radius:12px; padding:16px; background:#fff; }
  .gd-card h3 { margin:0 0 4px; font-size:1.05rem; }
  .gd-headline { margin:0 0 8px; color:#3B7A8C; font-size:.9rem; }
  .gd-meta { margin:0 0 8px; font-size:.8rem; color:#5a6b6f; }
  .gd-modalities { margin:0; font-size:.8rem; color:#33484d; }
  .gd-badge { display:inline-block; font-size:.7rem; padding:2px 6px; border-radius:999px; background:#eef4f5; margin-left:4px; }
  .gd-verified { background:#e6f4ea; color:#1e7a3c; }
</style>`;

if (!customElements.get("graduate-directory")) {
  customElements.define("graduate-directory", GraduateDirectory);
}
