export interface WaterCareTipDTO {
  text: string;
}

export interface WaterCareLegalDTO {
  /** When non-empty, users must accept this version before logging tests / seeing dosage (WC-0). */
  policyVersion: string;
  acknowledgmentTitle: string;
  acknowledgmentBody: string;
  fullPolicyUrl: string | null;
}

export interface WaterCareConfigDTO {
  testingTipsTitle: string;
  testingTips: WaterCareTipDTO[];
  legal: WaterCareLegalDTO;
}

const MAX_TITLE = 120;
const MAX_TIPS = 12;
const MAX_TIP = 300;
const MAX_POLICY_VER = 120;
const MAX_ACK_TITLE = 200;
const MAX_ACK_BODY = 4000;
const MAX_URL = 2000;

export const DEFAULT_WATER_CARE_CONFIG: WaterCareConfigDTO = {
  testingTipsTitle: 'Water Testing Tips',
  testingTips: [
    { text: 'Test water 2-3 times per week' },
    { text: 'Test after heavy use or rainfall' },
    { text: 'Take samples 12-18 inches below surface' },
    { text: 'Test water away from jets and returns' },
  ],
  legal: {
    policyVersion: '',
    acknowledgmentTitle: 'Water care information',
    acknowledgmentBody:
      'Water chemistry guidance in this app is informational only and does not replace manufacturer instructions or professional service. By continuing, you acknowledge you have read and accept this disclaimer.',
    fullPolicyUrl: null,
  },
};

function clampStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeLegal(raw: unknown): WaterCareLegalDTO {
  const base = DEFAULT_WATER_CARE_CONFIG.legal;
  if (!raw || typeof raw !== 'object') return { ...base };
  const r = raw as Record<string, unknown>;
  return {
    policyVersion: clampStr(r.policyVersion, MAX_POLICY_VER),
    acknowledgmentTitle: clampStr(r.acknowledgmentTitle, MAX_ACK_TITLE) || base.acknowledgmentTitle,
    acknowledgmentBody: clampStr(r.acknowledgmentBody, MAX_ACK_BODY) || base.acknowledgmentBody,
    fullPolicyUrl: (() => {
      const u = clampStr(r.fullPolicyUrl, MAX_URL);
      return u || null;
    })(),
  };
}

export function normalizeWaterCareConfig(raw: unknown): WaterCareConfigDTO {
  if (!raw || typeof raw !== 'object') {
    return {
      testingTipsTitle: DEFAULT_WATER_CARE_CONFIG.testingTipsTitle,
      testingTips: DEFAULT_WATER_CARE_CONFIG.testingTips.map((tip) => ({ ...tip })),
      legal: { ...DEFAULT_WATER_CARE_CONFIG.legal },
    };
  }

  const record = raw as { testingTipsTitle?: unknown; testingTips?: unknown; legal?: unknown };
  const testingTipsTitle = clampStr(record.testingTipsTitle, MAX_TITLE) || DEFAULT_WATER_CARE_CONFIG.testingTipsTitle;

  const testingTips: WaterCareTipDTO[] = [];
  if (Array.isArray(record.testingTips)) {
    for (const row of record.testingTips.slice(0, MAX_TIPS)) {
      if (!row || typeof row !== 'object') continue;
      const text = clampStr((row as { text?: unknown }).text, MAX_TIP);
      if (text) testingTips.push({ text });
    }
  }

  return {
    testingTipsTitle,
    testingTips:
      testingTips.length > 0
        ? testingTips
        : DEFAULT_WATER_CARE_CONFIG.testingTips.map((tip) => ({ ...tip })),
    legal: normalizeLegal(record.legal),
  };
}

export function getWaterCareLegalConfig(raw: unknown): WaterCareLegalDTO {
  return normalizeWaterCareConfig(raw).legal;
}
