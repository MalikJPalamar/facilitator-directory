export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>
          Find a certified practitioner you can trust<span className="dot">.</span>
        </h1>
        <p>
          The AI-native marketplace that turns a school&apos;s certified graduates
          into a discoverable, agent-accessible directory.
        </p>
        <div className="hero__actions">
          <a className="btn btn-primary" href="/breathwork-global">
            Browse the directory
          </a>
          <a
            className="btn btn-outline"
            href="/login"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,.5)" }}
          >
            School sign in
          </a>
        </div>
      </section>

      <div className="page">
        <div className="directory-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="panel">
            <h3>For schools</h3>
            <p className="muted">
              Turn your accredited graduates into a branded, searchable marketplace —
              with AI coaching that compounds every night.
            </p>
          </div>
          <div className="panel">
            <h3>For practitioners</h3>
            <p className="muted">
              A verified profile that gets found — by people and by their AI agents —
              plus private insights on what&apos;s working.
            </p>
          </div>
          <div className="panel">
            <h3>For agents</h3>
            <p className="muted">
              Structured, machine-readable profiles and an MCP endpoint so an AI
              agent can shop for the right practitioner.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
