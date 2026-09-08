import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Habit Tracker",
  description: "Build habits one day at a time and keep the streak alive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
