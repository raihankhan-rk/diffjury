import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DiffJury — Jev decides if this PR is risky or not",
  description:
    "Paste a public GitHub pull request. DiffJury fetches the dossier and Jev returns a risk verdict — no essays.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
