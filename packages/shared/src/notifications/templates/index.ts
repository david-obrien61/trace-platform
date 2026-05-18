import type { TraceVertical, TemplateDef } from '../types';
import { cultivarTemplates }   from './cultivar';
import { ignitionTemplates }   from './ignition';
import { assessmentTemplates } from './assessment';

// ── Registry ──────────────────────────────────────────────────────────────────
// To add a new vertical: import its templates array and add one line below.

const REGISTRY = new Map<string, TemplateDef>();

function register(templates: TemplateDef[]) {
  for (const t of templates) {
    REGISTRY.set(`${t.vertical}:${t.id}`, t);
  }
}

register(cultivarTemplates);
register(ignitionTemplates);
register(assessmentTemplates);

// ── Public API ────────────────────────────────────────────────────────────────

export function getTemplate(
  vertical: TraceVertical,
  templateId: string,
): TemplateDef | undefined {
  return REGISTRY.get(`${vertical}:${templateId}`);
}

export function listTemplates(vertical?: TraceVertical): TemplateDef[] {
  const all = [...REGISTRY.values()];
  return vertical ? all.filter((t) => t.vertical === vertical) : all;
}

export { cultivarTemplates, ignitionTemplates, assessmentTemplates };
