/** Allowed CRM status values — the CRM rejects anything else. */
export const CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

/** Allowed data source values — blank when none matches confidently. */
export const DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** GrowEasy CRM record. All fields are strings; empty string = not available. */
export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | '';
  crm_note: string;
  data_source: DataSource | '';
  possession_time: string;
  description: string;
}

export const CRM_FIELDS: (keyof CrmRecord)[] = [
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
];

/** A raw CSV row: header -> cell value. */
export type RawRow = Record<string, string>;

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  totalRows: number;
}

export interface SkippedRecord {
  /** 1-based index of the row in the uploaded CSV (excluding header). */
  rowIndex: number;
  raw: RawRow;
  reason: string;
}

export interface ImportedRecord extends CrmRecord {
  rowIndex: number;
}

/** How one CSV column was interpreted by the AI (for transparency in the UI). */
export interface ColumnMapping {
  /** Original CSV column name. */
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
  /** Present when the AI produced a column mapping (best effort). */
  columnMapping?: ColumnMapping[];
}
