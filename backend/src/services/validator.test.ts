import { describe, expect, it } from 'vitest';
import { validateRecords } from './validator.js';
import type { AiRecord } from './aiExtractor.js';
import { CRM_FIELDS } from '../types/crm.js';

function aiRecord(overrides: Partial<Record<string, string>> & { row_index: number }): AiRecord {
  const base = Object.fromEntries(CRM_FIELDS.map((f) => [f, ''])) as Record<string, string>;
  return { ...base, ...overrides } as AiRecord;
}

const rowsByIndex = new Map([[1, { any: 'raw' }]]);

describe('validateRecords', () => {
  it('skips records with neither email nor mobile', () => {
    const { imported, skipped } = validateRecords(
      [aiRecord({ row_index: 1, name: 'No Contact' })],
      rowsByIndex
    );
    expect(imported).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/no email or mobile/i);
  });

  it('keeps records with only an email', () => {
    const { imported, skipped } = validateRecords(
      [aiRecord({ row_index: 1, email: 'A@B.com' })],
      rowsByIndex
    );
    expect(skipped).toHaveLength(0);
    expect(imported[0].email).toBe('a@b.com');
  });

  it('rejects invalid crm_status values and preserves them in the note', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', crm_status: 'HOT_LEAD' })],
      rowsByIndex
    );
    expect(imported[0].crm_status).toBe('');
    expect(imported[0].crm_note).toContain('HOT_LEAD');
  });

  it('accepts allowed crm_status values', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', crm_status: 'SALE_DONE' })],
      rowsByIndex
    );
    expect(imported[0].crm_status).toBe('SALE_DONE');
  });

  it('rejects invalid data_source values', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', data_source: 'facebook' })],
      rowsByIndex
    );
    expect(imported[0].data_source).toBe('');
  });

  it('blanks created_at that new Date() cannot parse', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', created_at: 'not-a-date' })],
      rowsByIndex
    );
    expect(imported[0].created_at).toBe('');
    expect(imported[0].crm_note).toContain('not-a-date');
  });

  it('keeps parseable created_at', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', created_at: '2026-05-13 14:20:48' })],
      rowsByIndex
    );
    expect(imported[0].created_at).toBe('2026-05-13 14:20:48');
  });

  it('normalizes mobile to digits and country code to +digits', () => {
    const { imported } = validateRecords(
      [
        aiRecord({
          row_index: 1,
          mobile_without_country_code: '98765 43210',
          country_code: '91',
        }),
      ],
      rowsByIndex
    );
    expect(imported[0].mobile_without_country_code).toBe('9876543210');
    expect(imported[0].country_code).toBe('+91');
  });

  it('collapses line breaks so records stay single CSV rows', () => {
    const { imported } = validateRecords(
      [aiRecord({ row_index: 1, email: 'a@b.com', crm_note: 'line one\nline two' })],
      rowsByIndex
    );
    expect(imported[0].crm_note).toBe('line one\\nline two');
  });
});
