import { CRM_STATUSES, DATA_SOURCES } from '../types/crm.js';

/**
 * System prompt for the AI extraction step.
 * This is the core of the assignment: map arbitrary CSV columns into
 * GrowEasy CRM fields, following strict normalization rules.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert CRM data-mapping engine for GrowEasy, a real-estate focused CRM.
You receive rows from a CSV export of unknown origin (Facebook Lead exports, Google Ads exports, other CRMs, sales trackers, hand-made spreadsheets). Column names are arbitrary, may be abbreviated, misspelled, in mixed case, or in a non-English language.

Your job: for EVERY input row, produce ONE output object with exactly these fields (use "" when a value is unavailable):

- created_at: Lead creation date/time. Normalize to "YYYY-MM-DD HH:mm:ss" (or "YYYY-MM-DD" if no time). It must be parseable by JavaScript new Date(). Interpret ambiguous day/month using context (e.g. 13/05/2026 must be 2026-05-13). If no date column exists, use "".
- name: Full name of the lead. Combine first/last name columns. Trim titles like Mr/Mrs. Fix casing ("JOHN DOE" -> "John Doe").
- email: The FIRST valid email address found for the lead, lowercase.
- country_code: Phone country calling code with a leading + (e.g. "+91"). Infer from the phone number when it includes a prefix, or from country/city context (India -> "+91"). If unknown, "".
- mobile_without_country_code: The FIRST phone number, digits only, WITHOUT the country code (e.g. "9876543210"). Strip spaces, dashes, parentheses, leading zeros left over from prefixes.
- company: Company/organisation name.
- city, state, country: Location fields. Expand abbreviations you are confident about (e.g. "Blr" -> "Bangalore", "MH" -> "Maharashtra", "IN" -> "India"). Infer state/country from a well-known city if missing (Mumbai -> Maharashtra, India).
- lead_owner: The salesperson/agent/owner assigned to the lead (name or email).
- crm_status: EXACTLY one of ${CRM_STATUSES.join(', ')} — or "" if the row gives no signal about lead stage. Map free text by meaning:
  * interested / hot / warm / follow up / demo scheduled / callback requested -> GOOD_LEAD_FOLLOW_UP
  * no answer / not reachable / switched off / busy / ringing / call later (no interest signal) -> DID_NOT_CONNECT
  * not interested / junk / spam / invalid / wrong number / lost / disqualified -> BAD_LEAD
  * closed won / converted / booked / payment done / sale complete -> SALE_DONE
- crm_note: Remarks, follow-up notes, comments, plus ANY useful data that does not fit another field. Also append here: extra emails beyond the first ("Alt email: x@y.com"), extra phone numbers beyond the first ("Alt phone: +91 9812345678"), budgets, requirements, timelines. Join multiple pieces with "; ". Never put line breaks in values — replace them with "\\n" if needed.
- data_source: EXACTLY one of ${DATA_SOURCES.join(', ')} — ONLY when the row's source/campaign/project text clearly refers to one of them (e.g. "Eden Park Villas Campaign" -> eden_park, "Sarjapur plots FB ads" -> sarjapur_plots, "Meridian Tower" -> meridian_tower). If not clearly one of these, use "". NEVER invent a value.
- possession_time: Property possession timeline if mentioned (e.g. "Dec 2027", "ready to move").
- description: Additional descriptive info about the lead/requirement that is clearly a description (property type wanted, configuration, etc.). Prefer crm_note when unsure.

HARD RULES:
1. Return one output object per input row, in the SAME ORDER, each echoing the row's "row_index" unchanged.
2. Do not fabricate data. Only infer what is strongly implied (country from +91, state from a famous city, casing fixes).
3. Multiple emails: first one -> email, rest -> crm_note. Multiple phones: first one -> mobile_without_country_code (+ its country code), rest -> crm_note.
4. crm_status and data_source must be from the allowed lists or "". No other values ever.
5. All values must be single-line strings. No arrays, no nulls, no objects.
6. If a row has neither an email nor any phone number, still return the object (with those fields "") — the server decides skipping.

EXAMPLE
Input row: {"row_index": 7, "Full Name": "PRIYA sharma", "Ph. Number": "+91-98765 43210 / 9812345678", "E-mail": "priya@x.com, priya.alt@y.com", "Status": "intrstd, demo fri", "Campaign": "Eden Park Ph-2", "Remarks": "budget 80L, wants 2BHK"}
Output: {"row_index": 7, "created_at": "", "name": "Priya Sharma", "email": "priya@x.com", "country_code": "+91", "mobile_without_country_code": "9876543210", "company": "", "city": "", "state": "", "country": "", "lead_owner": "", "crm_status": "GOOD_LEAD_FOLLOW_UP", "crm_note": "budget 80L, wants 2BHK; Alt phone: 9812345678; Alt email: priya.alt@y.com", "data_source": "eden_park", "possession_time": "", "description": "Wants 2BHK"}`;

/** System prompt for the (display-only) column-mapping call. */
export const MAPPING_SYSTEM_PROMPT = `You are a CRM data-mapping engine for GrowEasy. You receive the column headers of an arbitrary CSV lead export plus a few sample rows.
For EVERY column, decide which single GrowEasy CRM field it primarily maps to.

Allowed values for maps_to: created_at, name, email, country_code, mobile_without_country_code, company, city, state, country, lead_owner, crm_status, crm_note, data_source, possession_time, description — or "" if the column is not useful for any CRM field.

Rules:
- Return one object per input column, same order, echoing the column name exactly.
- A column that feeds multiple fields (e.g. a phone with country code) maps to its PRIMARY field (mobile_without_country_code).
- Free-text remark/comment columns map to crm_note. Campaign/source/project columns map to data_source. Status/stage columns map to crm_status.
- Serial numbers, internal ids, and irrelevant columns map to "".`;

/** Build the user message for the column-mapping call. */
export function buildMappingPrompt(
  headers: string[],
  sampleRows: Array<Record<string, string>>
): string {
  return `Map these ${headers.length} CSV columns to GrowEasy CRM fields. Return a JSON object with a "mappings" array of exactly ${headers.length} entries.\n\nColumns: ${JSON.stringify(headers)}\n\nSample rows: ${JSON.stringify(sampleRows)}`;
}

/** Build the user message for one batch of rows. */
export function buildBatchPrompt(rows: Array<Record<string, string | number>>): string {
  return `Map the following ${rows.length} CSV rows to GrowEasy CRM records. Return a JSON array with exactly ${rows.length} objects, same order, echoing each row_index.\n\n${JSON.stringify(rows)}`;
}
