import {
  Sparkles,
  ShieldCheck,
  Search,
  Bot,
  Globe,
  Brain,
  Users,
  ArrowRight,
} from "lucide-react";

import styles from "./home.module.css";

export default function Home() {
  return (
    <main>
      {/* ---------- HERO ---------- */}
      <section className={styles.hero}>
        <div className="container">
          <div className={`${styles.heroInner} reveal`}>
            <span className="eyebrow">For certification schools</span>
            <h1 className={`display ${styles.heroTitle}`}>
              Your graduates, finally discoverable<span className="dot">.</span>
            </h1>
            <p className={`lead ${styles.heroLead}`}>
              Turn your certified graduates into a branded, searchable directory —
              found by the people who need them and the AI agents that shop for
              them.
            </p>
            <div className={styles.heroActions}>
              <a className="btn btn-primary btn-lg" href="/login?mode=signup">
                Get started
              </a>
              <a className="btn btn-ghost btn-lg" href="/directory">
                Browse the directory
              </a>
            </div>
            <span className={styles.trustLine}>
              <ShieldCheck size={15} strokeWidth={2} />
              Built for breathwork, yoga &amp; coaching certification bodies
            </span>

            {/* trust / capability strip */}
            <div className={styles.statStrip}>
              <span className="pill-static">
                <Users size={14} className={styles.pillIcon} strokeWidth={2} />
                Found by people &amp; AI agents
              </span>
              <span className="pill-static">
                <Brain size={14} className={styles.pillIcon} strokeWidth={2} />
                Nightly AI coaching
              </span>
              <span className="pill-static">
                <Bot size={14} className={styles.pillIcon} strokeWidth={2} />
                MCP-ready
              </span>
              <span className="pill-static">
                <Globe size={14} className={styles.pillIcon} strokeWidth={2} />
                JSON-LD structured profiles
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOR SCHOOLS ---------- */}
      <section id="for-schools" className="section">
        <div className="container">
          <div className={styles.sectionHead}>
            <span className="eyebrow">For schools</span>
            <h2>Everything your accreditation should already do.</h2>
            <p>
              Your graduates earned the credential. Give it a home that works for
              them — and for you — every single day.
            </p>
          </div>

          <div className="directory-grid directory-grid--3">
            <div className="feature">
              <span className="feature__icon">
                <Sparkles size={22} strokeWidth={1.8} />
              </span>
              <h3>A branded directory</h3>
              <p>
                Your name, your standards, your graduates — in a directory that
                looks like you built it. No spreadsheets, no dead PDFs.
              </p>
            </div>

            <div className="feature">
              <span className="feature__icon">
                <ShieldCheck size={22} strokeWidth={1.8} />
              </span>
              <h3>Verified profiles</h3>
              <p>
                Every practitioner is tied to a real certification you control.
                Trust is the product — credentials stay authoritative.
              </p>
            </div>

            <div className="feature">
              <span className="feature__icon">
                <Brain size={22} strokeWidth={1.8} />
              </span>
              <h3>Insights that compound</h3>
              <p>
                A nightly AI loop reads how your directory performs and coaches
                you on what&apos;s working — smarter every morning.
              </p>
            </div>

            <div className="feature">
              <span className="feature__icon">
                <Bot size={22} strokeWidth={1.8} />
              </span>
              <h3>Agent-accessible</h3>
              <p>
                An MCP endpoint and structured JSON-LD let AI agents discover and
                recommend your graduates — wherever the search begins.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how-it-works" className={`section ${styles.tinted}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className="eyebrow">How it works</span>
            <h2>Live in an afternoon.</h2>
            <p>
              Three steps from a list of names to a directory the world — and its
              agents — can find.
            </p>
          </div>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <h3>Create your school</h3>
              <p>
                Claim your branded space, set your standards, and make it yours
                in minutes. No engineering required.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <h3>Add your graduates</h3>
              <p>
                Invite certified practitioners or import them in bulk. Each gets a
                verified, editable profile tied to your credential.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3>Get discovered</h3>
              <p>
                Your directory goes live for people and AI agents — and the
                nightly insight loop starts coaching you on what to improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOR PRACTITIONERS + FOR AGENTS ---------- */}
      <section className="section">
        <div className="container">
          <div className={styles.split}>
            <div className="panel">
              <div className={styles.splitCard}>
                <span className={styles.eyebrowRow}>
                  <Search size={18} strokeWidth={2} />
                  <span className="eyebrow" style={{ margin: 0 }}>
                    For practitioners
                  </span>
                </span>
                <h3>A profile that actually gets found.</h3>
                <p>
                  A verified profile under your school&apos;s name — discovered by
                  people searching and the AI agents acting on their behalf. Plus
                  private insight on what&apos;s drawing interest to your work.
                </p>
                <a className={`btn-ghost ${styles.splitLink}`} href="/directory">
                  See the directory
                  <ArrowRight size={15} strokeWidth={2} />
                </a>
              </div>
            </div>

            <div className="panel">
              <div className={styles.splitCard}>
                <span className={styles.eyebrowRow}>
                  <Bot size={18} strokeWidth={2} />
                  <span className="eyebrow" style={{ margin: 0 }}>
                    For agents
                  </span>
                </span>
                <h3>Structured, machine-readable, MCP-ready.</h3>
                <p>
                  Every profile ships as clean JSON-LD with an MCP endpoint, so an
                  AI agent can query certifications, modalities, and availability —
                  and recommend the right practitioner with confidence.
                </p>
                <span className={styles.codeLine}>
                  GET /api/.well-known/ai-directory.json
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="section--tight">
        <div className="container">
          <div className={styles.ctaBand}>
            <h2>Create your school&apos;s directory.</h2>
            <p>
              Give your graduates a credential that keeps working — discoverable by
              people and AI agents, coached by AI every night.
            </p>
            <div className={styles.ctaActions}>
              <a
                className={`btn btn-lg ${styles.btnInvert}`}
                href="/login?mode=signup"
              >
                Get started
              </a>
              <a
                className={`btn btn-outline btn-lg ${styles.btnGhostInvert}`}
                href="/directory"
              >
                Browse the directory
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
