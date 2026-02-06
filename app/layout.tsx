import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anchor',
  description: 'Stay Steady',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-calm-cream">
        {children}
      </body>
    </html>
  );
}
