// ============================================================
// contactRecord — ONE QUICKBOOKS CUSTOMER → THE THREE TYPED LISTS (platform, ledger #335)
// PURPOSE:      The vCard shape, applied to the import. A QuickBooks customer carries PrimaryPhone,
//               Mobile, AlternatePhone, Fax, PrimaryEmailAddr, BillAddr and ShipAddr — a LIST of
//               each, arriving at a single column. This module stops the flattening: every value
//               becomes a row in `customer_phones` / `customer_emails` / `customer_addresses`,
//               labelled, with its provenance, and NOTHING is chosen between.
//
// 🔴 THIS SUPERSEDES `fix/address-import-line2-shape` (#331) AND ABSORBS ITS RULE RATHER THAN
//    DISCARDING IT. David, 2026-09-15: *"Its per-record shape rule is right and moves into this
//    build — it just writes into the phone list and the address list instead of choosing one
//    value. Take the logic, leave the branch."* #331 measured, on the complete 1,959-record
//    capture, that `BillAddr.Line1` holds a STREET on 962 records and a PHONE on 484, and that a
//    blanket "Line2 is the street" rule is wrong in BOTH directions. That finding is preserved
//    exactly; only its DESTINATION changes.
//
// 🔴 AND IT RETIRES A RULING DAVID WAS OWED. #331's `phone-would-be-lost` branch covered 5 records
//    where recovering the street meant discarding a phone number held nowhere else, and it left
//    the choice to him. THERE IS NO CHOICE HERE: the street goes in the address list, the number
//    goes in the phone list, and both survive. The branch does not exist in this module.
//
// DEPENDENCIES: `classifyValueShape` from ../quickbooks/importFieldAudit (the SHIPPED classifier —
//               the same one the import preview panel uses, so the panel and the writer cannot
//               disagree). No IO, no clock, no client: every rule below is provable at a desk.
// OUTPUTS:      `buildContactRecord` → the three lists + `findings`, the report of what was seen
//               and NOT taken. · `addressKey` (shared with contactWriter's already-held check).
//               · THE SEED RULE (foot of file): `DECLARED_CONTACT_SEEDERS`,
//               `HISTORY_TABLES`, `contactSeedStatements`, `historySourceViolation` — `20260911b`
//               §4 as code, read by `customerAddresses.test.ts` §F and `contactRecord.test.ts` §H.
// ============================================================

import { classifyValueShape } from '../quickbooks/importFieldAudit';

/** Trim to null. A QuickBooks field that is present-but-blank is ABSENT, not empty (A9). */
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Digits only — the same normalisation the database trigger applies to `value_norm`. */
export function normalizePhoneValue(v: string): string {
  return v.replace(/\D/g, '');
}

/** Lower-cased and trimmed — mirrors the trigger. */
export function normalizeEmailValue(v: string): string {
  return v.trim().toLowerCase();
}

/**
 * A phone label is WHAT KIND of number it is. Provenance is `source`, deliberately separate —
 * an owner who relabels an imported number must not thereby erase where it came from.
 */
export type PhoneLabel = 'main' | 'mobile' | 'other' | 'fax';

export interface ContactPhone {
  label: PhoneLabel;
  value: string;
  /** Text that sat beside the number in the same field ("cell", "gate 1234") — kept, never lost.
   *  `customer_phones.note` (20260915). Null when the field held only the number. */
  note?: string | null;
  is_primary: boolean;
  /** 'quickbooks:PrimaryPhone' · 'quickbooks:BillAddr.Line1' · … */
  source: string;
}

export interface ContactEmail {
  label: 'main';
  value: string;
  is_primary: boolean;
  source: string;
}

export interface ContactAddress {
  kind: 'billing' | 'shipping' | 'both';
  label: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_default: boolean;
  source: string;
}

/**
 * 🔴 THE REPORT. David, 2026-09-15: *"Show the customer what we found and what we did not take,
 * and let them fix it in QuickBooks. A value we cannot read confidently is surfaced, never
 * guessed."*
 *
 * ⚠️ A finding is NOT an error and never blocks an import (R-57 — *no finding may ever block an
 * ingest*). It is the honest half of "the import takes everything": everything we could read, we
 * took; everything we could not, we say so rather than inventing a reading for it.
 */
export type ContactFindingKind =
  /** A value sat where a street belongs, and it is not a street or a phone. Left alone. */
  | 'address-line-unreadable'
  /** One email field held more than one address. SPLIT into one row each (David, 2026-09-16). */
  | 'email-holds-several'
  /** A phone was found in an address line and taken into the phone list from there. */
  | 'phone-recovered-from-address'
  /** The record has an address block but no street we could identify anywhere in it. */
  | 'no-street-found';

export interface ContactFinding {
  kind: ContactFindingKind;
  /** The field path the value came from, e.g. `BillAddr.Line1`. */
  field: string;
  /** One sentence, written for Lauren rather than for us. */
  reason: string;
}

/** One sentence per finding kind. Exhaustive by type, so a new kind without copy fails to compile. */
export const CONTACT_FINDING_REASON: Record<ContactFindingKind, string> = {
  'address-line-unreadable':
    'this address line is neither a street nor a phone number, so it was left exactly as it is — correct it in QuickBooks and re-import',
  'email-holds-several':
    'this email field held more than one address; each was saved as its own email — separate them in QuickBooks too, so the next import reads the same',
  'phone-recovered-from-address':
    'a phone number was typed into an address line; it was kept as a phone and the street was read from the other line',
  'no-street-found':
    'this customer has an address block but no line that reads as a street, so no address was imported — adding one in QuickBooks will bring it in',
};

export interface ContactRecord {
  phones: ContactPhone[];
  emails: ContactEmail[];
  addresses: ContactAddress[];
  findings: ContactFinding[];
}

/** The four QuickBooks phone fields, in the order that decides which becomes primary. */
const PHONE_FIELDS: { path: string; label: PhoneLabel }[] = [
  { path: 'PrimaryPhone', label: 'main' },
  { path: 'Mobile', label: 'mobile' },
  { path: 'AlternatePhone', label: 'other' },
  { path: 'Fax', label: 'fax' },
];

/** The address lines a phone can hide in. `Line3` is included: 10 records carry one. */
const ADDRESS_LINES = ['Line1', 'Line2', 'Line3'] as const;

/**
 * Which line of an address block holds the STREET — decided PER RECORD, from the shape of the
 * value. #331's rule, preserved.
 *
 * 🔴 A BLANKET "Line2 IS THE STREET" RULE IS WRONG IN BOTH DIRECTIONS ON THE REAL DATA, which is
 * why this is per-record and never global: it would write a phone over a correct street on the 6
 * records shaped `street` then `phone`, and NULL the street on the 953 whose `Line2` is empty.
 *
 * Returns the street and the line it came from, or null when no line reads as a street.
 */
export function resolveStreet(block: Record<string, unknown> | null): { street: string; from: string } | null {
  if (!block || typeof block !== 'object') return null;
  for (const line of ADDRESS_LINES) {
    const v = str(block[line]);
    // `classifyValueShape` answers 'other' for a value it cannot place, and 'other' is never a
    // verdict — an unrecognised line is not promoted to a street.
    if (v !== null && classifyValueShape(v) === 'street') return { street: v, from: line };
  }
  return null;
}

// ── A PHONE INSIDE OTHER TEXT (David, 2026-09-16) ─────────────────────────────────────────────
// A field holding "(512) 555-0142 - cell" is not a street and not, to the classifier, a phone —
// it has letters. The rule: pull out each phone-SHAPED run, let `classifyValueShape` read each run
// on its own, and keep the leftover words as the phone's NOTE. A value is phone-bearing when it is a
// phone outright, or when it is NOT a street and at least one run reads as a phone. A street stays a
// street even with a number in it — the classifier decides, never this file.
// 🔴 MIRRORED IN SQL by `20260915_contact_record.sql` (`pg_temp.phones_in_text`) for the seed, and
// the two are asserted to agree on every value of the LAWNS snapshot (contact-seed harness).

/** A phone-shaped run: optional country 1, area code with or without brackets, 3 + 4 digits. */
export const PHONE_RUN_SOURCE = String.raw`(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}`;
const NOTE_EDGES = /^[\s–—/,;:()-]+|[\s–—/,;:()-]+$/g;

/** Trim with the classifier's notion of whitespace. */
function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/^\s+|\s+$/g, '');
  return s === '' ? null : s;
}

/** The phones in one field and the words beside them — or null when the field is not phone-bearing. */
export function phonesInText(raw: unknown): { phones: string[]; note: string | null } | null {
  const v = cleanText(raw);
  if (v === null) return null;
  const shape = classifyValueShape(v);
  if (shape === 'phone') return { phones: [v], note: null };
  if (shape === 'street') return null;
  const runs = (v.match(new RegExp(PHONE_RUN_SOURCE, 'g')) ?? []).filter(r => classifyValueShape(r) === 'phone');
  if (runs.length === 0) return null;
  const rest = v.replace(new RegExp(PHONE_RUN_SOURCE, 'g'), ' ').replace(/\s+/g, ' ').replace(NOTE_EDGES, '');
  return { phones: runs, note: rest === '' ? null : rest };
}

/** Every phone hiding in an address block's lines, with the line it came from. */
function phonesInBlock(block: Record<string, unknown> | null, path: string): { value: string; note: string | null; field: string }[] {
  if (!block || typeof block !== 'object') return [];
  const out: { value: string; note: string | null; field: string }[] = [];
  for (const line of ADDRESS_LINES) {
    const found = phonesInText(block[line]);
    if (found) for (const value of found.phones) out.push({ value, note: found.note, field: `${path}.${line}` });
  }
  return out;
}

/**
 * One email field → one address per entry. SPLIT only when EVERY piece is an address — "jane@x.com,
 * bob@y.com" is two; "Jane: jane@x.com" is kept whole, because splitting it would drop "Jane:".
 * Duplicates (case-folded) collapse to the first spelling. Mirrored in SQL (`pg_temp.split_emails`).
 */
export function splitEmails(raw: unknown): string[] {
  const v = cleanText(raw);
  if (v === null) return [];
  const parts = v.split(/[;,]|\s+/).filter(p => p !== '');
  const list = parts.length >= 2 && parts.every(p => p.includes('@')) ? parts : [v];
  const seen = new Set<string>();
  return list.filter(e => { const k = e.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** An address block's non-street, non-phone lines — the ones we could not read. */
function unreadableLines(block: Record<string, unknown> | null, path: string, streetLine: string | null): string[] {
  if (!block || typeof block !== 'object') return [];
  const out: string[] = [];
  for (const line of ADDRESS_LINES) {
    if (line === streetLine) continue;
    const v = str(block[line]);
    if (v === null) continue;
    const shape = classifyValueShape(v);
    if (shape !== 'street' && shape !== 'phone' && phonesInText(v) === null) out.push(`${path}.${line}`);
  }
  return out;
}

/** The line that is NOT the street and NOT a phone, kept as line2 (a suite, a unit, a gate code). */
function secondaryLine(block: Record<string, unknown> | null, streetLine: string | null): string | null {
  if (!block || typeof block !== 'object') return null;
  for (const line of ADDRESS_LINES) {
    if (line === streetLine) continue;
    const v = str(block[line]);
    if (v === null) continue;
    // A phone is NOT a second address line — it has already been taken into the phone list, and
    // carrying it here too would put one value in two places (STD-011) with only one of them true.
    if (phonesInText(v) !== null) continue;
    return v;
  }
  return null;
}

/** The comparable identity of an address — street plus city plus postcode, case-folded. */
export function addressKey(a: Pick<ContactAddress, 'line1' | 'city' | 'zip'>): string {
  return [a.line1, a.city, a.zip].map(v => (v ?? '').trim().toLowerCase()).join('|');
}

/**
 * Does this email field hold more than one address?
 * ✏️ WAS detection-only ("never split"). David, 2026-09-16: *"The email field holding three
 * addresses becomes three email rows."* `splitEmails` does the split; this still drives the finding.
 */
export function emailHoldsSeveral(value: string): boolean {
  return splitEmails(value).length > 1;
}

/**
 * One raw QuickBooks customer → the three typed lists, plus the report.
 *
 * PURE. Same record in, same lists out, forever.
 */
export function buildContactRecord(raw: Record<string, unknown>): ContactRecord {
  const findings: ContactFinding[] = [];

  // ── PHONES ────────────────────────────────────────────────────────────────────────────────
  // Every declared phone field first, in order, then every number hiding in an address line.
  // Deduped on DIGITS, so `(512) 456-3632` and `512-456-3632` are one number and the FIRST
  // spelling wins — the declared fields outrank a number recovered from a street column.
  const phones: ContactPhone[] = [];
  const seenPhone = new Set<string>();
  const offerPhone = (value: string, label: PhoneLabel, source: string, note: string | null = null) => {
    const norm = normalizePhoneValue(value);
    // A "number" with fewer than 7 digits is an extension, a house number or a typo — not a
    // reachable phone. Taking it would put an unusable value on the record wearing the word phone.
    if (norm.length < 7 || seenPhone.has(norm)) return;
    seenPhone.add(norm);
    phones.push({ label, value, note, is_primary: phones.length === 0, source });
  };

  for (const { path, label } of PHONE_FIELDS) {
    const v = str((raw[path] as { FreeFormNumber?: unknown } | null)?.FreeFormNumber);
    if (v !== null) offerPhone(v, label, `quickbooks:${path}`);
  }

  const bill = (raw.BillAddr ?? null) as Record<string, unknown> | null;
  const ship = (raw.ShipAddr ?? null) as Record<string, unknown> | null;

  for (const { value, note, field } of [...phonesInBlock(bill, 'BillAddr'), ...phonesInBlock(ship, 'ShipAddr')]) {
    const before = phones.length;
    // 🔴 LABELLED `other`, NOT `main`. A number typed into a street line is a number whose KIND we
    // do not know — asserting it is the main line would be inventing a fact. `source` records
    // exactly where it came from, which is the part that is true.
    offerPhone(value, 'other', `quickbooks:${field}`, note);
    if (phones.length > before) {
      findings.push({
        kind: 'phone-recovered-from-address',
        field,
        reason: CONTACT_FINDING_REASON['phone-recovered-from-address'],
      });
    }
  }

  // ── EMAILS ────────────────────────────────────────────────────────────────────────────────
  // QuickBooks' Customer entity has exactly ONE email field — measured across all 1,959 records,
  // zero carry a second. The list still exists because the OWNER may add one, and because one
  // record proves the need from the other direction: it packs three addresses into the one box.
  const emails: ContactEmail[] = [];
  const primaryEmail = str((raw.PrimaryEmailAddr as { Address?: unknown } | null)?.Address);
  if (primaryEmail !== null) {
    splitEmails(primaryEmail).forEach((value, i) =>
      emails.push({ label: 'main', value, is_primary: i === 0, source: 'quickbooks:PrimaryEmailAddr' }));
    if (emailHoldsSeveral(primaryEmail)) {
      findings.push({
        kind: 'email-holds-several',
        field: 'PrimaryEmailAddr.Address',
        reason: CONTACT_FINDING_REASON['email-holds-several'],
      });
    }
  }

  // ── ADDRESSES ─────────────────────────────────────────────────────────────────────────────
  const addresses: ContactAddress[] = [];
  const blocks: { block: Record<string, unknown> | null; path: string; kind: 'billing' | 'shipping'; label: string }[] = [
    { block: bill, path: 'BillAddr', kind: 'billing', label: 'Billing' },
    { block: ship, path: 'ShipAddr', kind: 'shipping', label: 'Shipping' },
  ];

  for (const { block, path, kind, label } of blocks) {
    if (!block || typeof block !== 'object') continue;
    const resolved = resolveStreet(block);
    const streetLine = resolved?.from ?? null;

    for (const field of unreadableLines(block, path, streetLine)) {
      findings.push({
        kind: 'address-line-unreadable',
        field,
        reason: CONTACT_FINDING_REASON['address-line-unreadable'],
      });
    }

    if (resolved === null) {
      // The block exists but nothing in it reads as a street. There is NO ADDRESS here, and an
      // honest absence beats a guessed street (D-9). Reported so it can be fixed at source.
      const hasAnything = ADDRESS_LINES.some(l => str(block[l]) !== null) || str(block.City) !== null;
      if (hasAnything) {
        findings.push({ kind: 'no-street-found', field: path, reason: CONTACT_FINDING_REASON['no-street-found'] });
      }
      continue;
    }

    addresses.push({
      kind,
      label,
      line1: resolved.street,
      line2: secondaryLine(block, streetLine),
      city: str(block.City),
      state: str(block.CountrySubDivisionCode),
      zip: str(block.PostalCode),
      is_default: false,
      source: `quickbooks:${path}`,
    });
  }

  // 🔴 THE SHIPPING ADDRESS IS FOLDED INTO THE BILLING ONE WHEN THEY ARE THE SAME PLACE — and on
  // this tenant that is the COMMON case, not an edge: 725 of 736 resolved ship streets are
  // identical to the billing street. Writing both would give 725 customers two rows for one yard,
  // which is the same drift `20260911b` §4 refuses, arriving by a different door. `kind: 'both'`
  // says the one row serves both purposes, which is the fact.
  if (addresses.length === 2 && addressKey(addresses[0]) === addressKey(addresses[1])) {
    addresses.splice(1, 1);
    addresses[0] = { ...addresses[0], kind: 'both', label: 'Main' };
  }

  // The billing address is the default; with no billing address the first one is. `is_default`
  // must be set on exactly one row or the derived column has nothing to read.
  if (addresses.length > 0) {
    const billingIdx = addresses.findIndex(a => a.kind === 'billing' || a.kind === 'both');
    const defaultIdx = billingIdx >= 0 ? billingIdx : 0;
    addresses[defaultIdx] = { ...addresses[defaultIdx], is_default: true };
  }

  return { phones, emails, addresses, findings };
}

// ── THE FLAT RULE — one customer's flat values → the three lists (David, 2026-09-16) ───────────
// The SAME rule serves two callers, so it cannot drift between them:
//   · the migration's seed (`20260915_contact_record.sql` §5b mirrors it in SQL, and the contact-seed
//     harness proves the two produce identical rows for every LAWNS customer), and
//   · every app writer that still thinks in flat fields — OCR capture, checkout, the customer
//     editor — through `writeContactEdit`.
// RULES: a phone field is a phone, as written. A street field that is PHONE-BEARING (`phonesInText`)
// goes to the phone list — non-primary when a primary is already held — and never to the address
// list. The first remaining street is line 1, the next line 2; the legacy `address_line1` is a
// candidate (`legacy_street`) only when no billing street survives. City/state/ZIP stay on the address even when
// the street moved away, so a customer never loses their town. An email field is `splitEmails`.

/** The flat contact fields, as `customers` holds them. `legacy_street` is the value of the legacy
 *  street column, read ONLY by the migration seed (it is dropped by 20260915b). */
export interface FlatContact {
  phone?: string | null;
  email?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  legacy_street?: string | null;
}

/** Flat fields → the three lists. PURE. `source` prefixes provenance (`migrated:customers` for the seed). */
export function contactRecordFromFlat(f: FlatContact, source = 'migrated:customers'): ContactRecord {
  const findings: ContactFinding[] = [];
  const phones: ContactPhone[] = [];
  const seen = new Set<string>();
  const phone = cleanText(f.phone);
  if (phone !== null) {
    seen.add(normalizePhoneValue(phone));
    phones.push({ label: 'main', value: phone, note: null, is_primary: true, source: `${source}.phone` });
  }
  const lines: [string, string | null | undefined][] = [
    ['billing_line1', f.billing_line1], ['billing_line2', f.billing_line2], ['address_line1', f.legacy_street],
  ];
  for (const [col, v] of lines) {
    const found = phonesInText(v);
    if (!found) continue;
    for (const value of found.phones) {
      const d = normalizePhoneValue(value);
      if (seen.has(d)) continue;
      seen.add(d);
      phones.push({ label: 'other', value, note: found.note, is_primary: phones.length === 0, source: `${source}.${col}` });
      findings.push({ kind: 'phone-recovered-from-address', field: col, reason: CONTACT_FINDING_REASON['phone-recovered-from-address'] });
    }
  }

  const emails: ContactEmail[] = splitEmails(f.email).map((value, i) => ({
    label: 'main', value, is_primary: i === 0, source: `${source}.email`,
  }));
  if (f.email && emailHoldsSeveral(f.email)) {
    findings.push({ kind: 'email-holds-several', field: 'email', reason: CONTACT_FINDING_REASON['email-holds-several'] });
  }

  const streets: string[] = [];
  for (const v of [f.billing_line1, f.billing_line2]) {
    const c = cleanText(v);
    if (c !== null && phonesInText(c) === null && !streets.some(x => x.toLowerCase() === c.toLowerCase())) streets.push(c);
  }
  if (streets.length === 0) {
    const legacy = cleanText(f.legacy_street);
    if (legacy !== null && phonesInText(legacy) === null) streets.push(legacy);
  }
  const place = { city: cleanText(f.billing_city), state: cleanText(f.billing_state), zip: cleanText(f.billing_zip) };
  const addresses: ContactAddress[] = [];
  const line1 = streets[0] ?? null, line2 = streets[1] ?? null;
  if (line1 !== null || line2 !== null || place.city !== null || place.state !== null || place.zip !== null) {
    addresses.push({ kind: 'billing', label: 'Billing', line1, line2, ...place, is_default: true, source: `${source}.billing_*` });
  }
  return { phones, emails, addresses, findings };
}

/** A whole-run tally. One counter per finding kind, plus the list sizes. */
export interface ContactRecordTally {
  recordsWithPhones: number;
  recordsWithEmails: number;
  recordsWithAddresses: number;
  phoneRows: number;
  emailRows: number;
  addressRows: number;
  recordsWithSeveralPhones: number;
  recordsWithSeveralAddresses: number;
  findings: Record<ContactFindingKind, number>;
}

/** An empty tally. Declared as a TOTAL `Record`, so a new finding kind without a counter fails
 *  to compile rather than going silently uncounted — #331's `BRANCH_TALLY_KEY` discipline. */
export function emptyContactTally(): ContactRecordTally {
  return {
    recordsWithPhones: 0, recordsWithEmails: 0, recordsWithAddresses: 0,
    phoneRows: 0, emailRows: 0, addressRows: 0,
    recordsWithSeveralPhones: 0, recordsWithSeveralAddresses: 0,
    findings: {
      'address-line-unreadable': 0,
      'email-holds-several': 0,
      'phone-recovered-from-address': 0,
      'no-street-found': 0,
    },
  };
}

/** Fold one record's contact lists into a running tally. */
export function tallyContactRecord(t: ContactRecordTally, r: ContactRecord): ContactRecordTally {
  const next: ContactRecordTally = { ...t, findings: { ...t.findings } };
  if (r.phones.length > 0) next.recordsWithPhones++;
  if (r.emails.length > 0) next.recordsWithEmails++;
  if (r.addresses.length > 0) next.recordsWithAddresses++;
  next.phoneRows += r.phones.length;
  next.emailRows += r.emails.length;
  next.addressRows += r.addresses.length;
  if (r.phones.length > 1) next.recordsWithSeveralPhones++;
  if (r.addresses.length > 1) next.recordsWithSeveralAddresses++;
  for (const f of r.findings) next.findings[f.kind]++;
  return next;
}

// ── THE SEED RULE — `20260911b` §4, AS CODE RATHER THAN AS A COMMENT (ledger #335, 2026-09-16) ──
// 🔴 §4 FORBADE HISTORY AS THE SOURCE, NOT A SEED. Its reason was AGAVE LD LLC: four spellings of
// one yard across eighteen invoices would become four curated sites. That hazard lives in the
// SOURCE — delivery and order rows — and a seed that reads one existing value per customer out of
// `customers` cannot produce it. Until 2026-09-16 the tests enforced "nothing seeds", which was
// both stricter than the rule and blind to its reason, and it is what let `20260915` install a
// derivation over three empty tables. Both corpus tests now read the rule from HERE, so the
// sentence exists once (STD-011) and a third reader cannot drift from the first two.

/** The migrations permitted to seed a contact list, each with its reason. A DECLARATION, asserted
 *  both directions by `customerAddresses.test.ts` §F: an undeclared seeder fails, and so does a
 *  declared one that no longer seeds (tech-debt #73 — a list nobody re-derives rots). */
export const DECLARED_CONTACT_SEEDERS: Readonly<Record<string, string>> = {
  '20260915_contact_record.sql':
    'the contact-record MOVE — one existing flat value per customer, column to row (ledger #335)',
};

/** The three lists. */
export const CONTACT_LIST_TABLES = ['customer_addresses', 'customer_emails', 'customer_phones'] as const;

/** Tables that are HISTORY — what happened on an order — and so may never be a contact seed's
 *  source. Named rather than inferred: a table that belongs here is a decision, not a pattern. */
export const HISTORY_TABLES = ['deliveries', 'orders', 'order_items', 'order_service_selections', 'invoices'] as const;

/** Drop `--` comment lines — the same stripping every corpus probe here uses, so a migration that
 *  DISCUSSES a seed at length is not reported as one that performs it. */
export function stripSqlComments(sql: string): string {
  return sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
}

/** Every statement in `sql` that seeds one of `tables`. Split on `;` — sufficient for this corpus,
 *  whose seeds carry no semicolon inside a literal; a seed that did would be read as two halves. */
export function contactSeedStatements(sql: string, tables: readonly string[] = CONTACT_LIST_TABLES): string[] {
  const seed = new RegExp(`\\b(insert\\s+into|copy)\\s+(public\\.)?(${tables.join('|')})\\b`, 'i');
  return stripSqlComments(sql).split(';').map(s => s.trim()).filter(s => seed.test(s));
}

/** Why a seed statement breaks `20260911b` §4, in words — or null when it does not. Two halves,
 *  and both are needed: a statement reading `FROM public.deliveries` fails the first, and one
 *  reading `FROM public.customers c JOIN public.deliveries d` passes the first and fails the
 *  second. */
export function historySourceViolation(stmt: string): string | null {
  if (!/\bfrom\s+(public\.)?customers\b/i.test(stmt)) return 'does not read FROM public.customers';
  const named = HISTORY_TABLES.filter(t => new RegExp(`\\b(public\\.)?${t}\\b`, 'i').test(stmt));
  if (named.length > 0) return `names history: ${named.join(', ')}`;
  return null;
}
