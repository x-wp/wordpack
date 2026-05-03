import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.posix.resolve(REPO_ROOT, 'test');

const placeholders: Array<[string, string]> = [
  [FIXTURE_ROOT, '<FIXTURE>'],
  [REPO_ROOT, '<REPO>'],
];

function replacePaths(s: string): string {
  let out = s;
  for (const [from, to] of placeholders) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

// Volatile fields whose contents change with the environment (browserslist
// queries, dependency versions, etc.). Replaced with a stable placeholder so
// snapshots survive across machines and time.
const REDACT_KEYS = new Set(['targets']);

function normalizeInner(
  value: unknown,
  parentKey: string | null,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return replacePaths(value);

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (value instanceof RegExp) {
    return `[RegExp: ${value.source}${value.flags ? '/' + value.flags : ''}]`;
  }

  if (typeof value !== 'object') return value;

  if (parentKey && REDACT_KEYS.has(parentKey)) {
    return `<REDACTED:${parentKey}>`;
  }

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => normalizeInner(v, null, seen));
  }

  const ctorName = (value as object).constructor?.name;
  if (ctorName && ctorName !== 'Object') {
    return { __plugin: ctorName };
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as object).sort()) {
    out[key] = normalizeInner((value as Record<string, unknown>)[key], key, seen);
  }
  return out;
}

export function normalize(value: unknown): unknown {
  return normalizeInner(value, null, new WeakSet());
}
