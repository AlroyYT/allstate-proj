import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import AuthGuard from '@/components/AuthGuard';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthGuard>
      <Component {...pageProps} />
    </AuthGuard>
  );
}