import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hearth: household ops over MCP",
  description:
    "A voice-assistant simulator backed by a real MCP server (Streamable HTTP) for groceries, chores and bills.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e8edef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
