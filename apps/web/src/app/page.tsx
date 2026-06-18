export default function Home() {
  return (
    <main>
      <h1 style={{ color: "#3B7A8C" }}>The Directory</h1>
      <p>AI-native marketplace that turns a school&apos;s graduates into a marketplace.</p>
      <ul>
        <li>
          <a href="/breathwork-global">Public directory — Global Breathwork Collective</a>
        </li>
        <li>
          <a href="/admin?school=breathwork-global">School AI insights (admin demo)</a>
        </li>
      </ul>
      <p style={{ color: "#5a6b6f", fontSize: ".9rem" }}>
        Seed the DB and run <code>pnpm intelligence:nightly</code> to populate insights.
      </p>
    </main>
  );
}
