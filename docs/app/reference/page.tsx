import Link from 'next/link';
import { readReferenceIndex } from '@/lib/reference';

export default function ReferenceIndexPage() {
  const items = readReferenceIndex();
  const byDomain = new Map<string, typeof items>();
  for (const item of items) {
    if (!byDomain.has(item.domain)) byDomain.set(item.domain, []);
    byDomain.get(item.domain)!.push(item);
  }

  return (
    <div>
      <h1>API Reference</h1>
      <p className="muted">
        Full operation coverage generated from route inventory + OpenAPI + usage mapping, with technical writing metadata.
      </p>
      {Array.from(byDomain.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([domain, rows]) => (
        <section key={domain} style={{ marginTop: 20 }}>
          <h2>{domain}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Group</th>
                <th>Auth</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`)).map((item) => (
                <tr key={`${item.method}:${item.path}`}>
                  <td><span className="pill">{item.method}</span></td>
                  <td><code>{item.path}</code></td>
                  <td>{item.group}</td>
                  <td>{item.authType}</td>
                  <td><Link href={`/reference/${item.slug}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
