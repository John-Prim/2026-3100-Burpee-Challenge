export const metadata = {
  title: "March 2026 Burpee Challenge",
  description: "Log burpees privately, compete on totals publicly."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
