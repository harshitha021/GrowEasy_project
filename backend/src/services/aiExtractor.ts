import { AzureOpenAI } from 'openai';
import { config, assertAiConfigured } from '../config.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  MAPPING_SYSTEM_PROMPT,
  buildBatchPrompt,
  buildMappingPrompt,
} from '../prompts/extraction.js';
import { CRM_FIELDS, type ColumnMapping, type RawRow } from '../types/crm.js';

/** Raw (unvalidated) record as returned by the LLM. */
export type AiRecord = Record<string, string> & { row_index: number };

/** A raw CSV row tagged with its 1-based row index for the AI round-trip. */
export interface TaggedRow {
  row_index: number;
  [column: string]: string | number;
}

/** JSON schema for OpenAI structured outputs (strict mode). */
const responseSchema = {
  type: 'object',
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          row_index: { type: 'integer' },
          ...Object.fromEntries(CRM_FIELDS.map((f) => [f, { type: 'string' }])),
        },
        required: ['row_index', ...CRM_FIELDS],
        additionalProperties: false,
      },
    },
  },
  required: ['records'],
  additionalProperties: false,
} as const;

let client: AzureOpenAI | null = null;
function getClient(): AzureOpenAI {
  assertAiConfigured();
  if (!client) {
    client = new AzureOpenAI({
      apiKey: config.azureApiKey,
      endpoint: config.azureEndpoint,
      apiVersion: config.azureApiVersion,
      deployment: config.azureDeployment,
    });
  }
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Split rows into batches, tagging each row with its 1-based CSV row index. */
export function makeBatches(rows: RawRow[]): TaggedRow[][] {
  const tagged: TaggedRow[] = rows.map((row, i) => ({ ...row, row_index: i + 1 }));
  const batches: TaggedRow[][] = [];
  for (let i = 0; i < tagged.length; i += config.batchSize) {
    batches.push(tagged.slice(i, i + config.batchSize));
  }
  return batches;
}

/**
 * Send one batch to Gemini and return unvalidated records.
 * Retries with exponential backoff on transient failures.
 */
export async function extractBatch(batch: TaggedRow[]): Promise<AiRecord[]> {
  const ai = getClient();
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await ai.chat.completions.create({
        model: config.azureDeployment,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildBatchPrompt(batch) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'crm_records', strict: true, schema: responseSchema },
        },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('Empty response from AI model');

      const parsed = JSON.parse(text) as { records?: AiRecord[] };
      if (!Array.isArray(parsed.records)) throw new Error('AI response has no records array');
      return parsed.records;
    } catch (err) {
      lastError = err;
      console.warn(
        `[ai] batch attempt ${attempt}/${config.maxRetries} failed:`,
        (err as Error).message
      );
      if (attempt < config.maxRetries) {
        await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s...
      }
    }
  }
  throw new Error(
    `AI extraction failed after ${config.maxRetries} attempts: ${(lastError as Error)?.message}`
  );
}

const mappingSchema = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          maps_to: { type: 'string' },
        },
        required: ['column', 'maps_to'],
        additionalProperties: false,
      },
    },
  },
  required: ['mappings'],
  additionalProperties: false,
} as const;

const VALID_FIELDS = new Set<string>(CRM_FIELDS);

/**
 * Ask the AI how each CSV column maps to CRM fields — display-only metadata
 * for transparency in the UI. Best effort: throws on failure, callers should
 * tolerate absence.
 */
export async function extractColumnMapping(
  headers: string[],
  sampleRows: RawRow[]
): Promise<ColumnMapping[]> {
  const ai = getClient();
  const response = await ai.chat.completions.create({
    model: config.azureDeployment,
    messages: [
      { role: 'system', content: MAPPING_SYSTEM_PROMPT },
      { role: 'user', content: buildMappingPrompt(headers, sampleRows) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'column_mappings', strict: true, schema: mappingSchema },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Empty mapping response');
  const parsed = JSON.parse(text) as { mappings?: ColumnMapping[] };
  if (!Array.isArray(parsed.mappings)) throw new Error('No mappings array');

  // Never trust the model: unknown fields become "not mapped".
  return parsed.mappings.map((m) => ({
    column: String(m.column),
    maps_to: VALID_FIELDS.has(m.maps_to) ? m.maps_to : '',
  }));
}


