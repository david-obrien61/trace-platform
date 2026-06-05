/**
 * Two-pass JSON extractor shared across all AI gateway responses.
 * Pass 1: strip markdown fences, direct JSON.parse.
 * Pass 2: regex fallback for the target shape ({ } or [ ]).
 * Throws with raw text in the message on total failure.
 */
export function parseTwoPass(text: string, shape: 'object' | 'array'): any {
  const stripped = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const pattern = shape === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match   = stripped.match(pattern);
    if (!match) throw new Error(`parseTwoPass: no JSON ${shape} found in: ${stripped.slice(0, 200)}`);
    return JSON.parse(match[0]);
  }
}
