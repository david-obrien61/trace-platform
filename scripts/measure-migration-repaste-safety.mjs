/**
 * ── repaste — PER-FILE re-paste safety census of the 2026-09 migration corpus ──────
 * PURPOSE:      Measure, per migration file, whether a SECOND paste is safe — by counting
 *               the DDL forms that are NOT idempotent against the guards that make them so.
 *               The bootstrap block asserts safety for three files and assumes it elsewhere;
 *               this derives it from the SQL. Comments are stripped first so a form named
 *               only in prose cannot be counted as a statement ([[R-33]]).
 * DEPENDENCIES: node; supabase/migrations/*.sql. Reads only.
 * OUTPUTS:      A per-file table on stdout: hazards (re-paste errors) and guards.
 * Run: node scripts/measure-migration-repaste-safety.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
const DIR = 'supabase/migrations';
const files = readdirSync(DIR).filter(f => /^202609/.test(f)).sort();

// Statement forms that ERROR on a second paste unless individually guarded.
const HAZARD = [
  ['CREATE POLICY',            /\bCREATE\s+POLICY\b/gi,                    /\bDROP\s+POLICY\s+IF\s+EXISTS\b/gi],
  ['CREATE TRIGGER',           /\bCREATE\s+TRIGGER\b/gi,                   /\bDROP\s+TRIGGER\s+IF\s+EXISTS\b/gi],
  ['CREATE TABLE (unguarded)', /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, null],
  ['CREATE INDEX (unguarded)', /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS|CONCURRENTLY\s+IF)/gi, null],
  ['ADD COLUMN (unguarded)',   /\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi, null],
  ['ADD CONSTRAINT',           /\bADD\s+CONSTRAINT\b/gi,                   /\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\b/gi],
  ['CREATE TYPE',              /\bCREATE\s+TYPE\b/gi,                      /\bDROP\s+TYPE\s+IF\s+EXISTS\b/gi],
];
// Forms that are inherently safe to repeat.
const SAFE = [
  ['ADD COLUMN IF NOT EXISTS', /\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/gi],
  ['CREATE INDEX IF NOT EXISTS', /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi],
  ['CREATE TABLE IF NOT EXISTS', /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi],
  ['CREATE OR REPLACE FUNCTION', /\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/gi],
  ['CREATE OR REPLACE VIEW', /\bCREATE\s+OR\s+REPLACE\s+VIEW\b/gi],
  ['ALTER COLUMN DROP NOT NULL', /\bALTER\s+COLUMN\s+\S+\s+DROP\s+NOT\s+NULL\b/gi],
];
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
const n = (re, s) => (s.match(re) || []).length;

for (const f of files) {
  const sql = strip(readFileSync(`${DIR}/${f}`, 'utf8'));
  const haz = [], safe = [];
  for (const [label, re, guard] of HAZARD) {
    const c = n(re, sql); if (!c) continue;
    const g = guard ? n(guard, sql) : 0;
    haz.push(`${label} ×${c}${guard ? ` (drop-if-exists ×${g})` : ''}${guard && g >= c ? ' GUARDED' : ' UNGUARDED'}`);
  }
  for (const [label, re] of SAFE) { const c = n(re, sql); if (c) safe.push(`${label} ×${c}`); }
  const unguarded = haz.filter(h => h.endsWith('UNGUARDED')).length;
  console.log(`\n${f}`);
  console.log(`  RE-PASTE: ${unguarded ? '🔴 NO — errors on a second paste' : '✅ YES — safe'}`);
  if (haz.length)  console.log(`  hazards: ${haz.join(' · ')}`);
  if (safe.length) console.log(`  guarded: ${safe.join(' · ')}`);
  if (!haz.length && !safe.length) console.log(`  (no DDL matched — inspect by hand)`);
}
