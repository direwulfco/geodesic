import * as fs from 'fs';
import * as path from 'path';
import type { SynthesisResult } from '@geode/types';
import { renderArchitectureMap } from './arch-map-writer.js';
import { renderSkillFileJson, renderSkillFileMd } from './skill-file-writer.js';
import { renderGapReport } from './gap-report-writer.js';

export { renderArchitectureMap } from './arch-map-writer.js';
export { renderSkillFileJson, renderSkillFileMd } from './skill-file-writer.js';
export { renderGapReport, computeLetterGrade, computeDimensionScore, computeOverallScore } from './gap-report-writer.js';

export interface ArtifactPaths {
  architectureMap: string;
  skillFileJson: string;
  skillFileMd: string;
  gapReport: string;
}

/**
 * Renders all four output artifacts from a SynthesisResult and writes them
 * to the given output directory, creating it if necessary.
 *
 * Output directory must be outside the analyzed repo.
 * The caller is responsible for selecting a compliant output path.
 */
export function writeArtifacts(synthesis: SynthesisResult, outputDir: string): ArtifactPaths {
  fs.mkdirSync(outputDir, { recursive: true });

  const files: Array<readonly [finalPath: string, content: string]> = [
    [path.join(outputDir, 'architecture-map.md'),    renderArchitectureMap(synthesis)],
    [path.join(outputDir, 'skill-file.geode.json'),  renderSkillFileJson(synthesis.skillFile)],
    [path.join(outputDir, 'skill-file.geode.md'),    renderSkillFileMd(synthesis.skillFile)],
    [path.join(outputDir, 'gap-report.md'),          renderGapReport(synthesis.gapReport)],
  ] as const;

  // Write to .tmp siblings first; on success rename atomically so no partial state is visible
  const tmpPaths: string[] = [];
  try {
    for (const [finalPath, content] of files) {
      const tmpPath = `${finalPath}.tmp`;
      fs.writeFileSync(tmpPath, content, 'utf8');
      tmpPaths.push(tmpPath);
    }
    for (let i = 0; i < files.length; i++) {
      fs.renameSync(tmpPaths[i]!, files[i]![0]);
    }
  } catch (err) {
    for (const tmpPath of tmpPaths) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
    }
    throw err;
  }

  return {
    architectureMap: files[0]![0],
    skillFileJson:   files[1]![0],
    skillFileMd:     files[2]![0],
    gapReport:       files[3]![0],
  };
}
