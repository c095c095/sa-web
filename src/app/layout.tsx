import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/500.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ระบบตรวจและส่งมอบบ้าน", template: "%s | ระบบตรวจและส่งมอบบ้าน" },
  description: "ระบบตรวจบ้าน ติดตามงานซ่อม และส่งมอบบ้าน",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      data-theme="sa-furrow"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
