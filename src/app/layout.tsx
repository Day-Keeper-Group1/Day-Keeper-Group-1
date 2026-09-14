import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayKeeper",
  description:
    "Upload a photo of a letter or document, and DayKeeper turns it into tasks and reminders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
