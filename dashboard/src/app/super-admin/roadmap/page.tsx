'use client';

import React from 'react';
import {
  PLANS_ROADMAP_SECTIONS,
  BUILD_OUT_ITEMS,
  ENTITLEMENTS_EXTRA,
  type BuildStatus,
} from '@/data/plansRoadmap';

function StatusBadge({ status }: { status: BuildStatus }) {
  const styles: Record<BuildStatus, string> = {
    shipped: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    partial: 'bg-amber-100 text-amber-900 border-amber-200',
    not_yet: 'bg-red-50 text-red-800 border-red-200',
    ops: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const labels: Record<BuildStatus, string> = {
    shipped: 'Shipped',
    partial: 'Partial',
    not_yet: 'Not yet',
    ops: 'Ops',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function SuperAdminRoadmapPage() {
  return (
    <div className="max-w-[1100px]">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Plans vs phases</h2>
        <p className="mt-2 text-sm text-gray-600">
          Internal reference aligned with the public{' '}
          <a
            href="https://hottubcompanion.com/plans/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            pricing &amp; features
          </a>{' '}
          page. <strong>Phase</strong> = where we document or plan work (<code className="text-xs bg-gray-100 px-1 rounded">PHASE-*.md</code>
          ). <strong>Build</strong> is a rough engineering snapshot, not formal QA sign-off.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          This route: <code className="bg-gray-100 px-1 rounded">/super-admin/roadmap</code> (e.g. on your deployed admin host).
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-xs text-gray-600">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 align-middle" /> Shipped
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1 align-middle" /> Partial
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1 align-middle" /> Not yet
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1 align-middle" /> Ops (non-product)
        </span>
      </div>

      <div className="space-y-10">
        {PLANS_ROADMAP_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
              {section.title}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-[800px] w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <th className="px-3 py-2 w-[32%]">Feature</th>
                    <th className="px-2 py-2 text-center w-12">Base</th>
                    <th className="px-2 py-2 text-center w-12">Core</th>
                    <th className="px-2 py-2 text-center w-12">Adv.</th>
                    <th className="px-3 py-2 w-20">Phase</th>
                    <th className="px-3 py-2 w-24">Build</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {section.rows.map((row) => (
                    <tr key={row.feature} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2 font-medium text-gray-900">{row.feature}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{row.base}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{row.core}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{row.adv}</td>
                      <td className="px-3 py-2 text-blue-700 whitespace-nowrap">{row.phase}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-xs">{row.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section>
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Standard build-out (marketing package)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-3 py-2">Line item</th>
                  <th className="px-3 py-2 w-24">Phase</th>
                  <th className="px-3 py-2 w-24">Build</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {BUILD_OUT_ITEMS.map((row) => (
                  <tr key={row.item} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 font-medium text-gray-900">{row.item}</td>
                    <td className="px-3 py-2 text-blue-700 whitespace-nowrap">{row.phase}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{row.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Platform / entitlements (not on comparison grid)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 w-24">Phase</th>
                  <th className="px-3 py-2 w-24">Build</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ENTITLEMENTS_EXTRA.map((row) => (
                  <tr key={row.item} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 font-medium text-gray-900">{row.item}</td>
                    <td className="px-3 py-2 text-blue-700 whitespace-nowrap">{row.phase}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{row.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-10 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-950">
        <p className="font-semibold mb-1">Blind spots to track</p>
        <ul className="list-disc pl-5 space-y-1 text-amber-900">
          <li>
            <strong>Scale pricing (future)</strong> — per-active-user add-on after 500 users (site footnote): not captured in{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">PHASE-*.md</code> yet.
          </li>
          <li>
            <strong>Hosting / annual / contract</strong> — commercial footnotes on the site; infrastructure is Phase 0, billing is ops.
          </li>
          <li>
            <strong>“Retailer-defined service categories”</strong> (Core marketing bullets) ≈ custom service types in Phase 4 — ensure Phase 4
            copy calls out categories explicitly if you want parity with sales language.
          </li>
        </ul>
      </div>
    </div>
  );
}
