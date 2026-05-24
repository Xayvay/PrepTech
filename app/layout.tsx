import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrepTech — interview prep, tailored",
  description: "Build a study plan and drill graded questions for any role at any company.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
