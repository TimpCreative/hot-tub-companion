import './globals.css';
import Link from 'next/link';
import { ReferenceNav } from '@/components/ReferenceNav';

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
              <nav className="sidebar-nav">
                <Link href="/" className="sidebar-link">
                  Overview
                </Link>
                <Link href="/getting-started" className="sidebar-link">
                  Getting Started
                </Link>
                <Link href="/concepts" className="sidebar-link">
                  Core Concepts
                </Link>
                <Link href="/auth" className="sidebar-link">
                  Authentication
                </Link>
                <Link href="/errors" className="sidebar-link">
                  Errors
                </Link>
                <ReferenceNav />
                <Link href="/changelog" className="sidebar-link">
                  Changelog
                </Link>
                <a href="/internal/docs-explorer" className="sidebar-link sidebar-link--external">
                  Internal Explorer
                </a>
              </nav>
            </aside>
            <main className="card content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
