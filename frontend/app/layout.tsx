import type { Metadata } from 'next';
import { Inter, Noto_Nastaliq_Urdu } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import QuickJoinModal from '@/components/QuickJoinModal';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-nastaliq',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EvalAssist - AI Grading & Evaluation Platform',
  description: 'AI grading and personalized-learning platform with Urdu-aware handwritten answer grading.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${notoNastaliq.variable}`}>
      <body className="bg-bg-base text-text-primary antialiased">
        <AuthProvider>
          {children}
          <QuickJoinModal />
        </AuthProvider>
      </body>
    </html>
  );
}
