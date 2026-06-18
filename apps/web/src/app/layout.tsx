import type { ReactNode } from "react";

export const metadata = {
  title: "The Directory",
  description: "AI-native marketplace of certified practitioners.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          color: "#1d2b2f",
          margin: 0,
          background: "#f7fafa",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
