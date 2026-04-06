'use client';

import {
  EnvelopeIcon,
  ShoppingCartIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  BookOpenIcon,
  HeartIcon,
  CircleStackIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { MobilePreviewShell } from './MobilePreviewShell';

interface QuickLink {
  id: string;
  title: string;
  subtitle?: string;
  iconKey: string;
  targetRoute: string;
  iconColor?: string;
  iconBgColor?: string;
  enabled: boolean;
  order: number;
}

interface HomeWidget {
  id: string;
  type: 'dealer_card' | 'tips_list' | 'product_strip' | 'maintenance_summary';
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

interface HomeDashboardMockupProps {
  quickLinks: QuickLink[];
  quickLinksLayout: 'single' | 'double';
  widgets: HomeWidget[];
  dealerPhone: string;
  dealerAddress: string;
  primaryColor?: string;
}

const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement> & { className?: string }>> = {
  mail: EnvelopeIcon,
  water: BeakerIcon,
  cart: ShoppingCartIcon,
  build: WrenchScrewdriverIcon,
  book: BookOpenIcon,
  medkit: HeartIcon,
  storefront: BuildingStorefrontIcon,
  ellipse: CircleStackIcon,
};

function MockupQuickLinkTile({
  link,
  layout,
  primaryColor,
}: {
  link: QuickLink;
  layout: 'single' | 'double';
  primaryColor: string;
}) {
  const IconComponent = ICON_MAP[link.iconKey] ?? CircleStackIcon;
  const iconColor = link.iconColor || primaryColor;
  const iconBg = link.iconBgColor || `${primaryColor}18`;

  if (layout === 'double') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg }}
        >
          <IconComponent className="h-6 w-6" style={{ color: iconColor }} />
        </div>
        <span className="text-center text-sm font-semibold text-gray-800 break-words" style={{ lineHeight: 1.2 }}>
          {link.title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg }}
      >
        <IconComponent className="h-6 w-6" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-800">{link.title}</span>
        {link.subtitle ? (
          <span className="block text-xs text-gray-500 break-words">{link.subtitle}</span>
        ) : null}
      </div>
      <span className="text-gray-400">›</span>
    </div>
  );
}

export function HomeDashboardMockup({
  quickLinks,
  quickLinksLayout,
  widgets,
  dealerPhone,
  dealerAddress,
  primaryColor = '#1B4D7A',
}: HomeDashboardMockupProps) {
  const visibleLinks = quickLinks
    .filter((q) => q.enabled)
    .sort((a, b) => a.order - b.order);
  const visibleWidgets = widgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <MobilePreviewShell>
      <div className="space-y-4 px-4 py-4">
        {/* Hero placeholder */}
        <div
          className="rounded-2xl px-5 py-6"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}ee, ${primaryColor})`,
          }}
        >
          <div className="text-sm font-medium text-white/80">Welcome to</div>
          <div className="text-[26px] font-bold leading-tight text-white">Your Retailer</div>
          <div className="mt-1 text-sm text-white/90">Your Hot Tub Care Partner</div>
        </div>

        {/* Quick Links */}
        {visibleLinks.length > 0 && (
          <div>
            {quickLinksLayout === 'double' ? (
              <div className="grid grid-cols-2 gap-3">
                {visibleLinks.map((link) => (
                  <MockupQuickLinkTile
                    key={link.id}
                    link={link}
                    layout="double"
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleLinks.map((link) => (
                  <MockupQuickLinkTile
                    key={link.id}
                    link={link}
                    layout="single"
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Widgets */}
        {visibleWidgets.map((w) => {
          if (w.type === 'dealer_card') {
            const title = String(w.props.title ?? 'Your Dealership');
            const subtitle = String(w.props.subtitle ?? 'We are here to help');
            return (
              <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-base font-semibold text-gray-800 break-words">{title}</div>
                <div className="mt-1 text-sm text-gray-600 break-words">{subtitle}</div>
                {dealerPhone ? (
                  <div className="mt-3 text-sm font-medium break-words" style={{ color: primaryColor }}>
                    {dealerPhone}
                  </div>
                ) : null}
                {dealerAddress ? (
                  <div className="mt-1 text-xs text-gray-500 break-words whitespace-pre-wrap">{dealerAddress}</div>
                ) : null}
              </div>
            );
          }
          if (w.type === 'tips_list') {
            const title = String(w.props.title ?? 'Tips');
            const subtitle = String(w.props.subtitle ?? '');
            const items = Array.isArray(w.props.items) ? w.props.items : [];
            return (
              <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-base font-semibold text-gray-800">{title}</div>
                {subtitle ? (
                  <div className="mt-1 text-sm text-gray-500 break-words">{subtitle}</div>
                ) : null}
                <div className="mt-3 space-y-2.5">
                  {(items as { title?: string; body?: string }[]).map((item, i) => (
                    <div key={i}>
                      <div className="text-sm font-medium text-gray-700">
                        {String(item?.title ?? 'Tip')}
                      </div>
                      {item?.body ? (
                        <div className="text-xs text-gray-500 break-words">{String(item.body)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (w.type === 'product_strip') {
            const title = String(w.props.title ?? 'Recommended');
            const subtitle = String(w.props.subtitle ?? '');
            return (
              <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-base font-semibold text-gray-800 break-words">{title}</div>
                {subtitle ? (
                  <div className="mt-1 text-sm text-gray-500 break-words">{subtitle}</div>
                ) : null}
                <div className="mt-3 flex gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 w-14 shrink-0 rounded-xl bg-gray-100"
                      title="Product"
                    />
                  ))}
                </div>
              </div>
            );
          }
          if (w.type === 'maintenance_summary') {
            const title = String(w.props.title ?? 'Care schedule');
            const n = Math.min(8, Math.max(1, Math.floor(Number(w.props.maxItems) || 3)));
            return (
              <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-semibold text-gray-800 break-words">{title}</div>
                  <span className="text-gray-400 text-sm">›</span>
                </div>
                <div className="mt-3 space-y-2">
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                      <div>
                        <div className="font-medium text-gray-700">Sample task {i + 1}</div>
                        <div className="text-xs text-gray-500">Due YYYY-MM-DD</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs font-medium" style={{ color: primaryColor }}>
                  Open full schedule ›
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </MobilePreviewShell>
  );
}
