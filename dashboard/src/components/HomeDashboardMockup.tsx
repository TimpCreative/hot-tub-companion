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
  type: 'dealer_card' | 'tips_list' | 'product_strip';
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
      <div className="flex flex-col items-center justify-center rounded-xl card p-3 shadow-sm">
        <div
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBg }}
        >
          <IconComponent className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <span className="text-center text-[11px] font-semibold text-gray-800 break-words" style={{ lineHeight: 1.2 }}>
          {link.title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl card p-3 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        <IconComponent className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-gray-800">{link.title}</span>
        {link.subtitle ? (
          <span className="block text-[10px] text-gray-500 break-words">{link.subtitle}</span>
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
    <div
      className="sticky top-6 self-start shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-xl"
      style={{ width: 280, maxHeight: 'calc(100vh - 3rem)' }}
    >
      <div className="border-b border-gray-300 bg-gray-700 px-4 py-2 text-center shrink-0">
        <span className="text-xs font-medium text-white">App preview</span>
      </div>
      <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Hero placeholder */}
        <div
          className="mb-4 rounded-xl px-3 py-4"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}ee, ${primaryColor})`,
          }}
        >
          <div className="text-[10px] font-medium text-white/80">Welcome to</div>
          <div className="text-sm font-bold text-white">Your Retailer</div>
          <div className="mt-1 text-[10px] text-white/90">Your Hot Tub Care Partner</div>
        </div>

        {/* Quick Links */}
        {visibleLinks.length > 0 && (
          <div className="mb-4">
            {quickLinksLayout === 'double' ? (
              <div className="grid grid-cols-2 gap-2">
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
              <div className="space-y-2">
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
              <div key={w.id} className="mb-4 rounded-xl card p-3 shadow-sm">
                <div className="text-xs font-semibold text-gray-800 break-words">{title}</div>
                <div className="mt-0.5 text-[10px] text-gray-600 break-words">{subtitle}</div>
                {dealerPhone ? (
                  <div className="mt-2 text-[10px] font-medium break-words" style={{ color: primaryColor }}>
                    {dealerPhone}
                  </div>
                ) : null}
                {dealerAddress ? (
                  <div className="mt-0.5 text-[10px] text-gray-500 break-words whitespace-pre-wrap">{dealerAddress}</div>
                ) : null}
              </div>
            );
          }
          if (w.type === 'tips_list') {
            const title = String(w.props.title ?? 'Tips');
            const subtitle = String(w.props.subtitle ?? '');
            const items = Array.isArray(w.props.items) ? w.props.items : [];
            return (
              <div key={w.id} className="mb-4 rounded-xl card p-3 shadow-sm">
                <div className="text-xs font-semibold text-gray-800">{title}</div>
                {subtitle ? (
                  <div className="mt-0.5 text-[10px] text-gray-500 break-words">{subtitle}</div>
                ) : null}
                <div className="mt-2 space-y-1.5">
                  {(items as { title?: string; body?: string }[]).map((item, i) => (
                    <div key={i}>
                      <div className="text-[10px] font-medium text-gray-700">
                        {String(item?.title ?? 'Tip')}
                      </div>
                      {item?.body ? (
                        <div className="text-[9px] text-gray-500 break-words">{String(item.body)}</div>
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
              <div key={w.id} className="mb-4 rounded-xl card p-3 shadow-sm">
                <div className="text-xs font-semibold text-gray-800 break-words">{title}</div>
                {subtitle ? (
                  <div className="mt-0.5 text-[10px] text-gray-500 break-words">{subtitle}</div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-12 w-12 shrink-0 rounded-lg bg-gray-100"
                      title="Product"
                    />
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
