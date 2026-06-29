import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "The Directory — certified practitioners, discoverable by people and AI",
  description:
    "The AI-native platform that turns a school's certified graduates into a branded, searchable, agent-accessible directory.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter is the non-Apple fallback; Apple devices render SF Pro via the stack. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <a className="site-header__brand" href="/">
              The Directory<span className="dot">.</span>
            </a>
            <nav>
              <div className="nav-links nav-links--collapse">
                <a href="/directory">Directory</a>
                <a href="/#for-schools">For schools</a>
                <a href="/#how-it-works">How it works</a>
              </div>
              <a href="/login">Sign in</a>
              <a className="btn btn-primary btn-sm" href="/login?mode=signup">
                Get started
              </a>
            </nav>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="site-footer__inner">
            <div className="site-footer__col">
              <a className="site-header__brand" href="/" style={{ marginBottom: 4 }}>
                The Directory<span className="dot">.</span>
              </a>
              <span className="muted" style={{ fontSize: "var(--fs-sm)", maxWidth: "30ch" }}>
                Certified practitioners, discoverable by people and their AI agents.
              </span>
            </div>
            <div className="site-footer__col">
              <strong style={{ fontSize: "var(--fs-sm)" }}>Product</strong>
              <a href="/directory">Browse the directory</a>
              <a href="/#for-schools">For schools</a>
              <a href="/#how-it-works">How it works</a>
            </div>
            <div className="site-footer__col">
              <strong style={{ fontSize: "var(--fs-sm)" }}>Access</strong>
              <a href="/login">Sign in</a>
              <a href="/login?mode=signup">Create a school</a>
              <a href="/api/.well-known/ai-directory.json">For AI agents</a>
            </div>
          </div>
          <div className="site-footer__legal">
            © 2026 The Directory. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
