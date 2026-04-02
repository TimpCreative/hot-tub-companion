import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Hot Tub Companion Docs',
  description: 'Technical documentation and full API reference for Hot Tub Companion.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="layout">
            <aside className="card sidebar">
              <h2 style={{ marginTop: 0 }}>HTC Docs</h2>
              <div className="muted" style={{ marginBottom: 12 }}>Stripe-style technical writing + full API reference.</div>
              <nav style={{ display: 'grid', gap: 8 }}>
                <Link href="/">Overview</Link>
                <Link href="/getting-started">Getting Started</Link>
                <Link href="/concepts">Core Concepts</Link>
                <Link href="/auth">Authentication</Link>
                <Link href="/errors">Errors</Link>
                <Link href="/reference">API Reference</Link>
                <Link href="/changelog">Changelog</Link>
                <a href="/internal/docs-explorer">Internal Explorer</a>
              </nav>
            </aside>
            <main className="card content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
