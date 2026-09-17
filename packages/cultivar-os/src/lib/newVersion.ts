// ============================================================
// newVersion — is the deployed build newer than the one this page is running? (#313, ledger #345)
// PURPOSE:      A page left open across a deploy keeps running the old code, and on 2026-09-17 that
//               voided an owner test. The build writes `/version.json` (vite.config.ts); this reads
//               it and decides. PURE decision + one fetch, so the rule is testable without a browser.
// DEPENDENCIES: fetch (injected in tests).
// OUTPUTS:      shouldOfferReload · fetchDeployedVersion · VERSION_CHECK_MIN_GAP_MS
// ============================================================

interface DeployedVersion { sha: string; builtAt?: string; env?: string }

/** Checks closer together than this are skipped — navigation can fire several times a second. */
export const VERSION_CHECK_MIN_GAP_MS = 30_000;

/**
 * Offer a reload only when BOTH ids are real and they differ. A local build ('dev'), an unreadable
 * file, or a malformed id never prompts — a false "new version" would teach people to ignore it.
 */
export function shouldOfferReload(running: string, deployed: DeployedVersion | null): boolean {
  if (!deployed || typeof deployed.sha !== 'string') return false;
  const isSha = (s: string) => /^[0-9a-f]{7}$/.test(s);
  if (!isSha(running) || !isSha(deployed.sha)) return false;
  return running !== deployed.sha;
}

export async function fetchDeployedVersion(fetcher: typeof fetch = fetch): Promise<DeployedVersion | null> {
  try {
    const res = await fetcher(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as DeployedVersion;
    return body && typeof body.sha === 'string' ? body : null;
  } catch {
    return null;
  }
}
