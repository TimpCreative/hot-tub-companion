export interface WaterCareTipDTO {
  text: string;
}

export interface WaterCareConfigDTO {
  testingTipsTitle: string;
  testingTips: WaterCareTipDTO[];
}

const MAX_TITLE = 120;
const MAX_TIPS = 12;
const MAX_TIP = 300;

export const DEFAULT_WATER_CARE_CONFIG: WaterCareConfigDTO = {
  testingTipsTitle: 'Water Testing Tips',
  testingTips: [
    { text: 'Test water 2-3 times per week' },
    { text: 'Test after heavy use or rainfall' },
    { text: 'Take samples 12-18 inches below surface' },
    { text: 'Test water away from jets and returns' },
  ],
};

function clampStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function normalizeWaterCareConfig(raw: unknown): WaterCareConfigDTO {
  if (!raw || typeof raw !== 'object') {
    return {
      testingTipsTitle: DEFAULT_WATER_CARE_CONFIG.testingTipsTitle,
      testingTips: DEFAULT_WATER_CARE_CONFIG.testingTips.map((tip) => ({ ...tip })),
    };
  }

  const record = raw as { testingTipsTitle?: unknown; testingTips?: unknown };
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
  };
}
