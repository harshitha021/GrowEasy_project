import { describe, expect, it } from 'vitest';
import { parseCsvBuffer } from './csvParser.js';
import { HttpError } from '../middleware/errorHandler.js';

describe('parseCsvBuffer', () => {
  it('parses a simple CSV into headers and row objects', () => {
    const result = parseCsvBuffer(Buffer.from('name,phone\nAmit,987\nSneha,988\n'));
    expect(result.headers).toEqual(['name', 'phone']);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0]).toEqual({ name: 'Amit', phone: '987' });
  });

  it('strips a UTF-8 BOM', () => {
    const result = parseCsvBuffer(Buffer.from('\uFEFFname\nAmit\n'));
    expect(result.headers).toEqual(['name']);
  });

  it('handles quoted fields with commas and embedded newlines', () => {
    const csv = 'name,note\n"Doe, John","line1\nline2"\n';
    const result = parseCsvBuffer(Buffer.from(csv));
    expect(result.rows[0]['name']).toBe('Doe, John');
    expect(result.rows[0]['note']).toContain('line1');
  });

  it('fills unnamed and duplicate headers', () => {
    const result = parseCsvBuffer(Buffer.from('name,,name\na,b,c\n'));
    expect(result.headers).toEqual(['name', 'column_2', 'name_2']);
  });

  it('pads ragged rows instead of failing', () => {
    const result = parseCsvBuffer(Buffer.from('a,b,c\n1,2\n'));
    expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('drops fully empty rows', () => {
    const result = parseCsvBuffer(Buffer.from('a,b\n1,2\n,\n3,4\n'));
    expect(result.totalRows).toBe(2);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsvBuffer(Buffer.from('  '))).toThrow(HttpError);
  });

  it('rejects a header-only file', () => {
    expect(() => parseCsvBuffer(Buffer.from('a,b\n'))).toThrow(/header row/i);
  });
});
