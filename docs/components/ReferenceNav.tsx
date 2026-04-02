import Link from 'next/link';
import { readReferenceIndex } from '@/lib/reference';

export function ReferenceNav() {
  const items = readReferenceIndex();
  if (items.length === 0) {
    return (
      <Link href="/reference" className="sidebar-link">
        API Reference
      </Link>
    );
  }

  const byDomain = new Map<string, typeof items>();
  for (const item of items) {
    const domain = item.domain || 'Other';
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(item);
  }

  const domains = Array.from(byDomain.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <details className="sidebar-details sidebar-details--root" open>
      <summary className="sidebar-summary">API Reference</summary>
      <div className="sidebar-submenu sidebar-submenu--scroll">
        <Link href="/reference" className="sidebar-sublink sidebar-sublink--index">
          Full index (table)
        </Link>
        {domains.map(([domain, rows]) => (
          <details key={domain} className="sidebar-details sidebar-details--nested">
            <summary className="sidebar-summary sidebar-summary--nested">{domain}</summary>
            <div className="sidebar-submenu">
              {rows
                .slice()
                .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`))
                .map((item) => (
                  <Link
                    key={`${item.method}:${item.path}`}
                    href={`/reference/${item.slug}`}
                    className="sidebar-sublink"
                    title={item.summary}
                  >
                    <span className="sidebar-method">{item.method}</span>
                    <span className="sidebar-path">{item.path}</span>
                  </Link>
                ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
