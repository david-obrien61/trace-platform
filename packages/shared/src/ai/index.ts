// Server-side AI gateway — safe to import in Vercel API handlers.
// Do NOT import in browser/Vite bundles (pulls in @anthropic-ai/sdk).
// For Ignition OS client-side AI routing, use AIEngine.ts directly.
export type { CapabilityConfig } from './capabilities';
export { CAPABILITIES } from './capabilities';
export { executeCapability } from './execute';
export type { ExecuteOpts } from './execute';
export { parseTwoPass } from './parseJson';
