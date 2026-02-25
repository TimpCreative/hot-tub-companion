import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Hot Tub Companion Dashboard
      </h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Access your dashboard using the appropriate URL or links below.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/?tenant=takeabreak"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Retailer Admin (Take A Break)
        </Link>
        <Link
          href="/?tenant=admin"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-900 transition-colors"
        >
          Super Admin
        </Link>
      </div>
      <p className="mt-8 text-sm text-gray-500 text-center">
        Local dev: use <code className="bg-gray-200 px-1 rounded">?tenant=takeabreak</code> or{' '}
        <code className="bg-gray-200 px-1 rounded">?tenant=admin</code> for routing.
      </p>
    </div>
  );
}
