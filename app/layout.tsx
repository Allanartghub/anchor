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
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{__html: `
          // Set up error suppression BEFORE anything else loads
          if (typeof window !== 'undefined') {
            // Suppress AbortError from unhandled rejections
            window.addEventListener('unhandledrejection', (event) => {
              if (event.reason instanceof Error && event.reason.name === 'AbortError') {
                event.preventDefault();
                return;
              }
            }, true);
            
            // Suppress AbortError from sync errors
            window.addEventListener('error', (event) => {
              if (event.error instanceof Error && event.error.name === 'AbortError') {
                event.preventDefault();
                return true;
              }
            }, true);
            
            // Override console methods to suppress AbortError messages
            const originalError = console.error;
            const originalWarn = console.warn;
            
            console.error = function(...args) {
              const firstArg = args[0];
              if (firstArg instanceof Error && firstArg.name === 'AbortError') {
                return;
              }
              if (typeof firstArg === 'string' && (firstArg.includes('aborted') || firstArg.includes('AbortError'))) {
                return;
              }
              originalError.apply(console, args);
            };
            
            console.warn = function(...args) {
              const firstArg = args[0];
              if (firstArg instanceof Error && firstArg.name === 'AbortError') {
                return;
              }
              if (typeof firstArg === 'string' && (firstArg.includes('aborted') || firstArg.includes('AbortError'))) {
                return;
              }
              originalWarn.apply(console, args);
            };
          }
        `}} />
      </head>
      <body className="bg-calm-cream" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
