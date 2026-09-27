import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Table & Taste — Restaurant order assistant",
  description:
    "A sample restaurant menu assistant with Jev-powered matching and WhatsApp handoff.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
