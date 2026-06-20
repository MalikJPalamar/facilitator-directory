import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "The Directory",
  description: "AI-native marketplace of certified practitioners.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap"
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
              <a href="/breathwork-global">Directory</a>
              <a href="/login">Sign in</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
