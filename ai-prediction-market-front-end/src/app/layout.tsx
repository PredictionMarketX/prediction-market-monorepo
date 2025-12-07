import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import { BlockchainProvider } from '@/lib/blockchain';
import { Header } from '@/components/layout';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AI Prediction Market',
  description: 'Decentralized prediction market powered by AI and x402 payments',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-950 min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>
          <BlockchainProvider>
            <Header />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </BlockchainProvider>
        </Providers>
      </body>
    </html>
  );
}
