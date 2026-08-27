/**
 * pgQuery — the ONE catalog/SQL seam for maintenance scripts.
 * PURPOSE:      run SQL against the live project via the Supabase Management API.
 * DEPENDENCIES: SUPABASE_PAT in the process environment. Never read from a file, never logged.
 * OUTPUTS:      sql(query) → array of rows.
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'bgobkjcopcxusjsetfob';

export async function sql(query) {
  const PAT = process.env.SUPABASE_PAT;
  if (!PAT) throw new Error('SUPABASE_PAT absent — refusing to run. Catalog access is the gate (§6 r17).');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(`SQL ${res.status}: ${JSON.stringify(body)}`);
  return body;
}
