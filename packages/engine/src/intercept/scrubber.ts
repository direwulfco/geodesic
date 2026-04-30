import type {
  HarvestResult,
  HipaaIdentifierCategory,
  InterceptResult,
  PiiCategory,
  PiiType,
  ScrubConfidence,
  UncertainDetection,
} from '@geode/types';
import { PurityCheckError } from '@geode/types';
import { detectInValue, isStructuralField } from './detector.js';
import { generateRefId, buildToken, applyReplacements } from './tokenizer.js';
import { AttestationChain, computeHash } from './attestation.js';
import { verifyPurity } from './purity.js';

export interface ScrubContext {
  readonly analystId: string;
  readonly repo: string;
  readonly repoCommit: string;
}

interface PendingDetection {
  entryId: string;
  token: string;
  jsonPath: string;
  startIndex: number;
  endIndex: number;
  patternId: string;
  match: string;
  category: PiiCategory;
  piiType: PiiType;
  hipaaIdentifier: HipaaIdentifierCategory | null;
  hipaaSafeHarborItem: string | null;
  confidence: ScrubConfidence;
  confidencePct: number;
}

const MAX_SCRUB_DEPTH = 50;

function walkAndScrub(
  obj: unknown,
  fieldName: string,
  jsonPath: string,
  usedRefIds: Set<string>,
  pending: PendingDetection[],
  depth = 0,
  seen = new Set<object>(),
): unknown {
  if (depth > MAX_SCRUB_DEPTH) return obj;

  if (typeof obj === 'string') {
    if (isStructuralField(fieldName)) return obj;

    const detections = detectInValue(obj);
    if (detections.length === 0) return obj;

    const tokens: string[] = [];
    for (const detection of detections) {
      const refId = generateRefId(usedRefIds);
      const token = buildToken(
        detection.patternDef.category,
        detection.patternDef.piiType,
        refId,
        detection.patternDef.confidence,
      );
      tokens.push(token);
      pending.push({
        entryId: refId,
        token,
        jsonPath,
        startIndex: detection.startIndex,
        endIndex: detection.endIndex,
        patternId: detection.patternId,
        match: detection.match,
        category: detection.patternDef.category,
        piiType: detection.patternDef.piiType,
        hipaaIdentifier: detection.patternDef.hipaaIdentifier,
        hipaaSafeHarborItem: detection.patternDef.hipaaSafeHarborItem,
        confidence: detection.patternDef.confidence,
        confidencePct: detection.patternDef.confidencePct,
      });
    }

    return applyReplacements(obj, detections, tokens);

  } else if (Array.isArray(obj)) {
    if (seen.has(obj)) return obj;
    seen.add(obj);
    const result = obj.map((item, i) =>
      walkAndScrub(item, fieldName, `${jsonPath}[${String(i)}]`, usedRefIds, pending, depth + 1, seen),
    );
    seen.delete(obj);
    return result;
  } else if (typeof obj === 'object' && obj !== null) {
    if (seen.has(obj)) return obj;
    seen.add(obj);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = walkAndScrub(value, key, `${jsonPath}.${key}`, usedRefIds, pending, depth + 1, seen);
    }
    seen.delete(obj);
    return result;
  }

  return obj;
}

/**
 * Main intercept entry point. Takes a raw HarvestResult and returns a
 * fully scrubbed payload with attestation chain and purity verification.
 *
 * Throws PurityCheckError if any PII survives scrubbing.
 */
export function intercept(
  harvest: HarvestResult,
  ctx: ScrubContext,
): InterceptResult {
  const usedRefIds = new Set<string>();
  const pending: PendingDetection[] = [];

  // Walk the full HarvestResult tree and scrub all string values
  const scrubbed = walkAndScrub(harvest, 'root', 'harvest', usedRefIds, pending);

  // Serialize the scrubbed payload
  const scrubbedPayload = JSON.stringify(scrubbed);
  const payloadHash = computeHash(scrubbedPayload);

  // Build attestation chain
  const chain = new AttestationChain();
  const uncertainDetections: UncertainDetection[] = [];

  for (const p of pending) {
    const entry = chain.addEntry({
      entryId: p.entryId,
      analystId: ctx.analystId,
      repo: ctx.repo,
      repoCommit: ctx.repoCommit,
      // File recorded as the JSON path within the harvest payload
      file: `[payload:${p.jsonPath}]`,
      lineStart: 1,
      lineEnd: 1,
      colStart: p.startIndex,
      colEnd: p.endIndex,
      piiCategory: p.category,
      piiType: p.piiType,
      hipaaIdentifier: p.hipaaIdentifier,
      hipaaSafeHarborItem: p.hipaaSafeHarborItem,
      scrubConfidence: p.confidence,
      tokenPlaced: p.token,
      payloadHash,
    });

    if (entry.scrubConfidence === 'UNCERTAIN' || entry.scrubConfidence === 'LOW') {
      uncertainDetections.push({
        entryId: entry.entryId,
        file: entry.file,
        lineStart: entry.lineStart,
        lineEnd: entry.lineEnd,
        isApproximateRange: true,
        trigger: `Pattern: ${p.patternId} matched "${p.match.slice(0, 40)}"`,
        confidence: entry.scrubConfidence,
        confidencePct: p.confidencePct,
        attestationRef: entry.entryId,
        recommendedAction:
          `Open the source repository at payload path '${p.jsonPath}'. ` +
          `Confirm or clear the detection manually via: geode review mark-reviewed --ref ${entry.entryId}`,
        markedReviewed: false,
        reviewedAt: null,
        reviewedBy: null,
      });
    }
  }

  // Mandatory purity check — verify the parsed object, not the JSON string,
  // so JSON escape sequences (\n before @decorator, etc.) never cause false positives.
  const purity = verifyPurity(scrubbed);
  if (!purity.clean) {
    throw new PurityCheckError(
      purity.firstMatchPattern ?? 'unknown',
      purity.firstMatchPosition ?? 0,
    );
  }

  const attestationEntries = chain.getEntries();
  const phiCount = attestationEntries.filter(e => e.piiCategory === 'PHI').length;
  const secretCount = attestationEntries.filter(e => e.piiCategory === 'SECRET').length;
  const piiCount = attestationEntries.filter(e => e.piiCategory === 'PII').length;

  return {
    scrubbedPayload,
    attestationEntries,
    uncertainDetections,
    piiCount,
    phiCount,
    secretCount,
    purityVerified: true,
  };
}
