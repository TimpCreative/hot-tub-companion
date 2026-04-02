import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { readReferenceContent, readReferenceIndex } from '@/lib/reference';

export function generateStaticParams() {
  const items = readReferenceIndex();
  return items.map((item) => ({ slug: item.slug }));
}

export default async function ReferenceOperationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const items = readReferenceIndex();
  const item = items.find((row) => row.slug === slug);
  if (!item) notFound();

  let source = '';
  try {
    source = readReferenceContent(slug);
  } catch {
    notFound();
  }

  return (
    <article>
      <div style={{ marginBottom: 8 }}>
        <span className="pill">{item.method}</span>
        <span className="pill">{item.authType}</span>
        <span className="pill">{item.domain}</span>
      </div>
      <h1 style={{ marginTop: 0 }}>{item.summary}</h1>
      <p className="muted"><code>{item.path}</code></p>
      <MDXRemote source={source} />
    </article>
  );
}
