import React from 'react';
import type { DealerContact, HomeWidget } from '../../contexts/TenantContext';
import { DealerCardWidget } from './DealerCardWidget';
import { LinkTileWidget } from './LinkTileWidget';
import { ProductStripWidget } from './ProductStripWidget';
import { TipsListWidget, type TipItem } from './TipsListWidget';

const ALLOWED_ROUTES = new Set([
  '/shop',
  '/water-care',
  '/inbox',
  '/dealer',
  '/services',
  '/onboarding',
]);

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseTips(items: unknown): TipItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const o = raw as Record<string, unknown>;
      const title = str(o.title);
      const body = str(o.body);
      if (!title && !body) return null;
      return { title: title || 'Tip', body: body || '' };
    })
    .filter((x): x is TipItem => x !== null);
}

export function HomeWidgetRenderer({
  widget,
  tenantName,
  dealerContact,
  sanitizationLabel,
}: {
  widget: HomeWidget;
  tenantName: string;
  dealerContact?: DealerContact | null;
  sanitizationLabel?: string | null;
}) {
  const { type, props } = widget;

  switch (type) {
    case 'link_tile': {
      const title = str(props.title) || 'Open';
      const subtitle = str(props.subtitle) || undefined;
      let targetRoute = str(props.targetRoute) || '/shop';
      if (!ALLOWED_ROUTES.has(targetRoute)) {
        targetRoute = '/shop';
      }
      const iconKey = str(props.iconKey) || 'ellipse';
      return (
        <LinkTileWidget title={title} subtitle={subtitle} targetRoute={targetRoute} iconKey={iconKey} />
      );
    }
    case 'dealer_card':
      return (
        <DealerCardWidget
          tenantName={tenantName}
          phone={dealerContact?.phone ?? null}
          address={dealerContact?.address ?? null}
        />
      );
    case 'tips_list': {
      const title = str(props.title) || 'Tips';
      const items = parseTips(props.items);
      if (items.length === 0) return null;
      return <TipsListWidget title={title} items={items} />;
    }
    case 'product_strip': {
      const title = str(props.title) || 'Recommended';
      const subtitle = str(props.subtitle) || undefined;
      return <ProductStripWidget title={title} subtitle={subtitle} sanitizationLabel={sanitizationLabel} />;
    }
    default:
      return null;
  }
}
