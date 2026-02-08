import "./globals.css";

export const metadata = {
  title: "March 2026 Burpee Challenge",
  description: "Log burpees privately, compete on totals publicly."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
