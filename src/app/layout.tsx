import type { Metadata } from "next";
import { themeScript } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruwanpura Gems ERP demo",
  description:
    "Stock, cost and custody control for a gem trading business — demonstration system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
