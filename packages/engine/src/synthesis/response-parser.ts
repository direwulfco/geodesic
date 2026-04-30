import type { SynthesisResult, SkillFileJson, GapReport } from '@geodesic/types';

function assertGapReport(val: unknown): asserts val is GapReport {
  if (typeof val !== 'object' || val === null)
    throw new Error('GAP_REPORT must be a JSON object');
  const obj = val as Record<string, unknown>;
  if (typeof obj['repoName'] !== 'string')
    throw new Error('GAP_REPORT missing required .repoName string');
  if (typeof obj['overallScore'] !== 'number')
    throw new Error('GAP_REPORT missing required .overallScore number');
  if (!Array.isArray(obj['dimensions']))
    throw new Error('GAP_REPORT missing required .dimensions array');
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json|markdown|md|text)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

function parseJson(raw: string, label: string): unknown {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse ${label} JSON: ${msg}\nRaw (first 200 chars): ${cleaned.slice(0, 200)}`);
  }
}

export interface SynthesisMeta {
  analystId: string;
  repo: string;
  repoCommit: string;
  crystalId: string | null;
  crystalMatchScore: number | null;
  provider: string;
  model: string;
  synthesisTokensUsed: number;
  echoHintsApplied: number;
  analysisDurationMs: number;
}

export function parseSynthesisResponse(
  parts: { archMap: string; skillFile: SkillFileJson; gapReport: string },
  meta: SynthesisMeta,
): SynthesisResult {
  const archMapRaw   = parts.archMap.trim();
  const gapReportRaw = stripCodeFences(parts.gapReport);

  const rawGapReport = parseJson(gapReportRaw, 'GAP_REPORT');
  assertGapReport(rawGapReport);
  const gapReport: GapReport = rawGapReport;

  // Patch authoritative meta fields into the pre-assembled skill file
  const skillFile: SkillFileJson = {
    ...parts.skillFile,
    meta: {
      ...parts.skillFile.meta,
      analysisDurationMs: meta.analysisDurationMs,
    },
  };

  gapReport.analyzedAt = new Date().toISOString();

  return {
    skillFile,
    gapReport,
    architectureMapMarkdown: archMapRaw,
    synthesisTokensUsed: meta.synthesisTokensUsed,
    echoHintsApplied: meta.echoHintsApplied,
    crystalId: meta.crystalId,
  };
}
