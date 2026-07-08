import { parse } from 'csv-parse/sync';
import { config } from '../config.js';
import type { ParseResult, RawRow } from '../types/crm.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Parse an uploaded CSV buffer into headers + row objects.
 * Handles UTF-8 BOM, quoted fields, embedded newlines and ragged rows.
 */
export function parseCsvBuffer(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8');
  if (!text.trim()) {
    throw new HttpError(400, 'The uploaded file is empty.');
  }

  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
    }) as string[][];
  } catch (err) {
    throw new HttpError(400, `Could not parse CSV: ${(err as Error).message}`);
  }

  if (records.length === 0) {
    throw new HttpError(400, 'The CSV contains no rows.');
  }
  if (records.length === 1) {
    throw new HttpError(400, 'The CSV only contains a header row — no data to import.');
  }
  if (records.length - 1 > config.maxRows) {
    throw new HttpError(
      413,
      `CSV has ${records.length - 1} rows; the maximum supported is ${config.maxRows}.`
    );
  }

  const rawHeaders = records[0];
  // De-duplicate / fill unnamed headers so row objects don't lose columns.
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    let name = h.trim() || `column_${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name}_${count + 1}`;
    return name;
  });

  const rows: RawRow[] = records.slice(1).map((cells) => {
    const row: RawRow = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });

  // Drop rows where every cell is empty.
  const nonEmpty = rows.filter((r) => Object.values(r).some((v) => v !== ''));

  if (nonEmpty.length === 0) {
    throw new HttpError(400, 'All data rows in the CSV are empty.');
  }

  return { headers, rows: nonEmpty, totalRows: nonEmpty.length };
}
