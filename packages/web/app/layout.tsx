import type { ReactNode } from 'react';

export const metadata = {
  title: 'lumemex',
  description: 'Personal knowledge base (LLM Wiki pattern)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 24 }}>{children}</body>
    </html>
  );
}

