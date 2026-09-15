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
//               and NOT taken.
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
  /** One email field appears to hold more than one address. TAKEN WHOLE, never split. */
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
    'this email field looks like it holds more than one address; it was imported whole and NOT split — separate them in QuickBooks and re-import',
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

/** Every value in an address block that reads as a phone, with the line it came from. */
function phonesInBlock(block: Record<string, unknown> | null, path: string): { value: string; field: string }[] {
  if (!block || typeof block !== 'object') return [];
  const out: { value: string; field: string }[] = [];
  for (const line of ADDRESS_LINES) {
    const v = str(block[line]);
    if (v !== null && classifyValueShape(v) === 'phone') out.push({ value: v, field: `${path}.${line}` });
  }
  return out;
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
    if (shape !== 'street' && shape !== 'phone') out.push(`${path}.${line}`);
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
    const shape = classifyValueShape(v);
    // A phone is NOT a second address line — it has already been taken into the phone list, and
    // carrying it here too would put one value in two places (STD-011) with only one of them true.
    if (shape === 'phone') continue;
    return v;
  }
  return null;
}

/** The comparable identity of an address — street plus city plus postcode, case-folded. */
function addressKey(a: ContactAddress): string {
  return [a.line1, a.city, a.zip].map(v => (v ?? '').trim().toLowerCase()).join('|');
}

/**
 * Does this email field hold more than one address? DETECTION ONLY — the value is never split.
 *
 * ⚠️ Splitting on a comma is a GUESS about intent, and a wrong split silently mails an invoice to
 * the wrong person. One LAWNS record carries three addresses in one field; it is imported whole
 * and reported, which is what lets the owner fix it at source.
 */
export function emailHoldsSeveral(value: string): boolean {
  return value.split(/[;,]|\s+/).filter(p => p.includes('@')).length > 1;
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
  const offerPhone = (value: string, label: PhoneLabel, source: string) => {
    const norm = normalizePhoneValue(value);
    // A "number" with fewer than 7 digits is an extension, a house number or a typo — not a
    // reachable phone. Taking it would put an unusable value on the record wearing the word phone.
    if (norm.length < 7 || seenPhone.has(norm)) return;
    seenPhone.add(norm);
    phones.push({ label, value, is_primary: phones.length === 0, source });
  };

  for (const { path, label } of PHONE_FIELDS) {
    const v = str((raw[path] as { FreeFormNumber?: unknown } | null)?.FreeFormNumber);
    if (v !== null) offerPhone(v, label, `quickbooks:${path}`);
  }

  const bill = (raw.BillAddr ?? null) as Record<string, unknown> | null;
  const ship = (raw.ShipAddr ?? null) as Record<string, unknown> | null;

  for (const { value, field } of [...phonesInBlock(bill, 'BillAddr'), ...phonesInBlock(ship, 'ShipAddr')]) {
    const before = phones.length;
    // 🔴 LABELLED `other`, NOT `main`. A number typed into a street line is a number whose KIND we
    // do not know — asserting it is the main line would be inventing a fact. `source` records
    // exactly where it came from, which is the part that is true.
    offerPhone(value, 'other', `quickbooks:${field}`);
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
    emails.push({ label: 'main', value: primaryEmail, is_primary: true, source: 'quickbooks:PrimaryEmailAddr' });
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
