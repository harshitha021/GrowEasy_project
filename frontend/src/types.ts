/** Mirrors backend/src/types/crm.ts — keep in sync. */

export const CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export const DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
] as const;
export type CrmField = (typeof CRM_FIELDS)[number];

export type RawRow = Record<string, string>;

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  totalRows: number;
}

export type CrmRecord = Record<CrmField, string>;

export interface ImportedRecord extends CrmRecord {
  rowIndex: number;
}

export interface SkippedRecord {
  rowIndex: number;
  raw: RawRow;
  reason: string;
}

/** How one CSV column was interpreted by the AI. */
export interface ColumnMapping {
  column: string;
  /** CRM field it maps to, or '' when the column was not used. */
  maps_to: string;
}

export interface ImportSummary {
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
  totalRows: number;
  columnMapping?: ColumnMapping[];
}

export interface ImportProgress {
  batchesDone: number;
  totalBatches: number;
  rowsProcessed: number;
  totalRows: number;
}
