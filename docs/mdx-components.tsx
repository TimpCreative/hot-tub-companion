import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }} {...props} />,
    h2: (props) => <h2 style={{ fontSize: '1.4rem', marginTop: '2rem', marginBottom: '0.75rem' }} {...props} />,
    h3: (props) => <h3 style={{ fontSize: '1.1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }} {...props} />,
    p: (props) => <p style={{ lineHeight: 1.7, marginBottom: '0.9rem' }} {...props} />,
    li: (props) => <li style={{ marginBottom: '0.35rem' }} {...props} />,
    code: (props) => <code style={{ background: '#111827', padding: '0.15rem 0.3rem', borderRadius: 4 }} {...props} />,
    ...components,
  };
}
