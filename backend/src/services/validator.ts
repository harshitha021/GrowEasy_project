import {
  CRM_STATUSES,
  DATA_SOURCES,
  CRM_FIELDS,
  type CrmRecord,
  type ImportedRecord,
  type RawRow,
  type SkippedRecord,
} from '../types/crm.js';
import type { AiRecord } from './aiExtractor.js';

const STATUS_SET = new Set<string>(CRM_STATUSES);
const SOURCE_SET = new Set<string>(DATA_SOURCES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Collapse newlines so each record stays a single CSV row. */
function singleLine(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r?\n/g, '\\n').trim();
}

function appendNote(note: string, extra: string): string {
  return note ? `${note}; ${extra}` : extra;
}

export interface ValidationOutcome {
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
}

/**
 * Server-side enforcement of the CRM rules. The AI maps; this code decides.
 * - skip records with neither email nor mobile
 * - enforce crm_status / data_source enums
 * - ensure created_at parses with new Date()
 * - normalize phone/email, keep values single-line
 */
export function validateRecords(
  aiRecords: AiRecord[],
  rowsByIndex: Map<number, RawRow>
): ValidationOutcome {
  const imported: ImportedRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const ai of aiRecords) {
    const rowIndex = Number(ai.row_index);
    const raw = rowsByIndex.get(rowIndex) ?? {};

    const rec = {} as CrmRecord;
    for (const field of CRM_FIELDS) {
      rec[field] = singleLine(ai[field]) as never;
    }

    // --- email ---
    rec.email = rec.email.toLowerCase();
    if (rec.email && !EMAIL_RE.test(rec.email)) {
      rec.crm_note = appendNote(rec.crm_note, `Unverified email: ${rec.email}`);
      rec.email = '';
    }

    // --- mobile ---
    rec.mobile_without_country_code = rec.mobile_without_country_code.replace(/\D/g, '');
    if (rec.mobile_without_country_code && rec.mobile_without_country_code.length < 5) {
      rec.crm_note = appendNote(
        rec.crm_note,
        `Unverified phone: ${rec.mobile_without_country_code}`
      );
      rec.mobile_without_country_code = '';
    }

    // --- skip rule: neither email nor mobile ---
    if (!rec.email && !rec.mobile_without_country_code) {
      skipped.push({
        rowIndex,
        raw,
        reason: 'No email or mobile number found',
      });
      continue;
    }

    // --- country code ---
    if (rec.country_code) {
      const digits = rec.country_code.replace(/\D/g, '');
      rec.country_code = digits ? `+${digits}` : '';
    }
    if (!rec.mobile_without_country_code) rec.country_code = '';

    // --- enums: never trust the model ---
    if (rec.crm_status && !STATUS_SET.has(rec.crm_status)) {
      rec.crm_note = appendNote(rec.crm_note, `Original status: ${rec.crm_status}`);
      rec.crm_status = '';
    }
    if (rec.data_source && !SOURCE_SET.has(rec.data_source)) {
      rec.crm_note = appendNote(rec.crm_note, `Original source: ${rec.data_source}`);
      rec.data_source = '';
    }

    // --- created_at must survive new Date() ---
    if (rec.created_at && Number.isNaN(new Date(rec.created_at).getTime())) {
      rec.crm_note = appendNote(rec.crm_note, `Original date: ${rec.created_at}`);
      rec.created_at = '';
    }

    imported.push({ rowIndex, ...rec });
  }

  return { imported, skipped };
}
