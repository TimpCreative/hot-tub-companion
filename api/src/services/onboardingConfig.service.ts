export type OnboardingStepId = 'brand' | 'modelPick' | 'sanitizer';

export interface WelcomeBlockDTO {
  greetingLine1: string;
  greetingLine2: string;
}

export interface OnboardingConfigDTO {
  version: number;
  allowSkip: boolean;
  steps: { id: OnboardingStepId; enabled: boolean }[];
  welcomeBlock?: WelcomeBlockDTO;
}

const DEFAULT_STEPS: { id: OnboardingStepId; enabled: boolean }[] = [
  { id: 'brand', enabled: true },
  { id: 'modelPick', enabled: true },
  { id: 'sanitizer', enabled: true },
];

const DEFAULT_WELCOME_BLOCK: WelcomeBlockDTO = {
  greetingLine1: 'Hey {{name}}!',
  greetingLine2: 'Welcome to {{retailer}}',
};

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfigDTO = {
  version: 1,
  allowSkip: true,
  steps: DEFAULT_STEPS,
  welcomeBlock: DEFAULT_WELCOME_BLOCK,
};

const STEP_IDS = new Set<OnboardingStepId>(['brand', 'modelPick', 'sanitizer']);

export function normalizeOnboardingConfig(raw: unknown): OnboardingConfigDTO {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ONBOARDING_CONFIG, steps: DEFAULT_STEPS.map((s) => ({ ...s })) };
  }
  const r = raw as Record<string, unknown>;
  const allowSkip = typeof r.allowSkip === 'boolean' ? r.allowSkip : DEFAULT_ONBOARDING_CONFIG.allowSkip;
  const version = typeof r.version === 'number' ? r.version : DEFAULT_ONBOARDING_CONFIG.version;

  const byId = new Map<OnboardingStepId, boolean>(
    DEFAULT_STEPS.map((s) => [s.id, s.enabled])
  );

  if (Array.isArray(r.steps)) {
    for (const item of r.steps) {
      if (!item || typeof item !== 'object') continue;
      const id = (item as { id?: string }).id;
      if (id && STEP_IDS.has(id as OnboardingStepId)) {
        byId.set(id as OnboardingStepId, (item as { enabled?: boolean }).enabled !== false);
      }
    }
  }

  const steps = DEFAULT_STEPS.map((s) => ({
    id: s.id,
    // Spa profile creation always requires a UHTD spa model id; keep model pick on.
    enabled: s.id === 'modelPick' ? true : byId.get(s.id) ?? true,
  }));

  let welcomeBlock: WelcomeBlockDTO | undefined = DEFAULT_WELCOME_BLOCK;
  if (r.welcomeBlock && typeof r.welcomeBlock === 'object') {
    const wb = r.welcomeBlock as Record<string, unknown>;
    const l1 = typeof wb.greetingLine1 === 'string' ? wb.greetingLine1.trim() : '';
    const l2 = typeof wb.greetingLine2 === 'string' ? wb.greetingLine2.trim() : '';
    welcomeBlock = {
      greetingLine1: l1 || DEFAULT_WELCOME_BLOCK.greetingLine1,
      greetingLine2: l2 || DEFAULT_WELCOME_BLOCK.greetingLine2,
    };
  }

  return { version, allowSkip, steps, welcomeBlock };
}
