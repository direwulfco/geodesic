export type PhaseProgressEventType =
  | 'phase_start'
  | 'phase_complete'
  | 'file_cataloged'
  | 'file_read'
  | 'file_error'
  | 'pii_detected'
  | 'discovery_finding'
  | 'relationship_found'
  | 'synthesis_stage'
  | 'warning';

export interface PhaseProgressEvent {
  type: PhaseProgressEventType;
  phase: 1 | 2 | 3 | 4;
  message: string;
  detail?: string | undefined;
  filePath?: string | undefined;
  count?: number | undefined;
  total?: number | undefined;
}
