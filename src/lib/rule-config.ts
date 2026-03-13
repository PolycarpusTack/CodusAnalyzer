export interface RuleConfig {
  security: boolean;
  performance: boolean;
  maintainability: boolean;
  style: boolean;
}

const STORAGE_KEY = 'code-review-rule-config';

const DEFAULT_CONFIG: RuleConfig = {
  security: true,
  performance: true,
  maintainability: true,
  style: true,
};

export function loadRuleConfig(): RuleConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveRuleConfig(config: RuleConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
