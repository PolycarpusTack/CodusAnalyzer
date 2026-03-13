import type { RuleConfig } from './rule-config';

export interface ProjectProfile {
  id: string;
  name: string;
  description: string;
  ruleConfig: RuleConfig;
  preset: string;
  customRuleIds: string[];
  createdAt: string;
}

const STORAGE_KEY = 'project-profiles';

export function loadProfiles(): ProjectProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveProfile(profile: ProjectProfile): void {
  if (typeof window === 'undefined') return;
  const profiles = loadProfiles();
  const existingIndex = profiles.findIndex((p) => p.id === profile.id);
  if (existingIndex >= 0) {
    profiles[existingIndex] = profile;
  } else {
    profiles.push(profile);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function deleteProfile(id: string): void {
  if (typeof window === 'undefined') return;
  const profiles = loadProfiles().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function applyProfile(profile: ProjectProfile): { ruleConfig: RuleConfig; preset: string } {
  return {
    ruleConfig: { ...profile.ruleConfig },
    preset: profile.preset,
  };
}
