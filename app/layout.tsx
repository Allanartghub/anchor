import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anchor',
  description: 'Stay Steady - mental load companion for international postgraduate students in Ireland',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-calm-cream" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
