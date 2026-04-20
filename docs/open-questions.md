# Open questions

A running log of observations that *look* suspicious or dead but aren't
confirmed bugs. None of these are claims — they're flags to investigate
before anyone refactors. Each is annotated with a source anchor so you
can verify in-repo.

## `WordPackConfig.globalChunks` appears unused

Source: [`lib/config/wordpack.config.ts:108-109`](../lib/config/wordpack.config.ts).

```ts
@IsString({ each: true })
globalChunks: string[] = ['awesome-notifications'];
```

No reader for `cfg.globalChunks` exists anywhere under `lib/services/` or
`lib/functions/`. The default implies an intent around keeping
`awesome-notifications` out of split chunks (it's also the only item in the
test `package.json` not referenced by a bundle), but that wiring isn't
present.

**Before removing:** grep the consumer projects that depend on
`@x-wp/wordpack`. If nobody sets it from outside, it's safe to delete
alongside the interface drift noted below.

## `WordPackConfig.multimode` appears unused

Source: [`lib/config/wordpack.config.ts:87-89`](../lib/config/wordpack.config.ts).

```ts
@IsBoolean()
@IsOptional()
multimode: boolean = true;
```

Not referenced by any service. The field name hints at a planned toggle for
single-vs-multi-config builds, but the library always emits multi-config
today (one per bundle plus AssetCopy).

## `BundleConfig.chunkId` / `chunkName` are inert

Sources:
[`lib/config/bundle.config.ts:33-36`](../lib/config/bundle.config.ts),
[`lib/config/bundle.config.ts:60-62`](../lib/config/bundle.config.ts).

```ts
chunkId: string = 'vendor-[name]';

get chunkName(): string {
  return this.chunkId.replace('[name]', this.name);
}
```

Neither is consumed anywhere. `OptimizeConfig.getChunkConfig` derives
vendor chunk names from `module.identifier()` via
`OptimizeConfig.chunkName(module)` at `optimize-config.service.ts:30-51`,
completely independent of `bundle.chunkId`. The field may be leftover from
an earlier split-chunks design.

## `resolve.extensions: ['jsx', ...]` missing a leading dot

Source: [`lib/services/compile-config.service.ts:61`](../lib/services/compile-config.service.ts).

```ts
resolve: {
  extensions: ['jsx', '.tsx', '.ts', '.js'],
},
```

The first entry is `'jsx'` — no leading `.` — while the other three follow
the webpack convention. Webpack skips entries that don't start with a dot
during module resolution, so the effective list is
`['.tsx', '.ts', '.js']`. Likely a typo that has gone unnoticed because
nobody writes `import Foo from './foo.jsx'` inside this codebase; the
`.tsx`/`.ts`/`.js` fallbacks cover real-world cases.

## `BundleConfigInterface` drifts from the class

Source: [`lib/interfaces/bundle-config.interface.ts`](../lib/interfaces/bundle-config.interface.ts).

```ts
export interface BundleConfigInterface {
  name: string;
  files: string[];
  splitChunks?: boolean;
  chunkTest?: RegExp;
  chunkName?: string;         // ← computed getter on the class; not an input
  chunkMinSize?: number;
  globalChunks?: string[];    // ← field on WordPackConfig, not BundleConfig
  override?: Partial<Configuration>;
  color?: string;
  entry?: Record<string, string[]>; // ← computed getter on the class
}
```

Three fields in the interface don't map to inputs the class accepts:

- `chunkName` is a getter that returns `chunkId.replace('[name]', name)`.
- `globalChunks` belongs on `WordPackConfig`.
- `entry` is a getter derived from `files`.

Consumers typing `wpwp.config.ts` against `BundleConfig` (the interface
alias re-exported from `lib/index.ts`) see these as valid optional
properties and may set them expecting them to do something. They don't.

## Pending `chunkFilename` edit in the working tree

Source: [`lib/services/optimize-config.service.ts:53-55`](../lib/services/optimize-config.service.ts).

As of the current working tree:

```ts
static chunkFilename(cfg: WordPackConfig): string {
  return `${cfg.scripts('dist')}/[name].[contenthash:6].js`;
}
```

But the committed HEAD is:

```ts
return `${cfg.scripts('dist')}/[name].js`;
```

(See `git diff lib/services/optimize-config.service.ts`.) The unstaged
change adds content-hashed chunk filenames, which aligns chunks with the
bundle-level `filename: '[name].[contenthash:6]'` default. This doc set
describes the working-tree behavior; until the edit is committed, shipped
releases still emit hashless chunk filenames.

## `buildConfig` wipes `dist/` synchronously during config generation

Source: [`lib/functions/build-config.ts:35`](../lib/functions/build-config.ts).

```ts
res.push(Svc.AssetConfig.build(cfg));

fs.emptyDirSync(cfg.path('dist', 'root'));

return res;
```

The `fs.emptyDirSync` runs as a side effect while `buildConfig` is still
assembling its return value — *before* webpack has seen the config.
Consequences:

- Programmatic callers that invoke `buildConfig` to inspect config
  (without running webpack) still wipe `dist/`.
- If webpack later fails, `dist/` is already empty.
- There is no escape hatch. Consumers who want to preserve some output
  (e.g. long-lived PHP files next to webpack assets) must put them
  outside `dist/`.

A webpack plugin hook (`CleanWebpackPlugin`, or a `done` callback)
would make the intent more discoverable and let it honor webpack's dry-run
semantics, but changing this is a behavior shift, not a cleanup.

## Static caches may leak across process-level `buildConfig` calls

Sources:
[`lib/services/shared-config.service.ts:8`](../lib/services/shared-config.service.ts),
[`lib/services/manifest-config.service.ts:11-12`](../lib/services/manifest-config.service.ts),
[`lib/services/optimize-config.service.ts:15-17`](../lib/services/optimize-config.service.ts).

Each of `SharedConfig.sharedCfg`, `ManifestConfig.{mfs, asts}`, and
`OptimizeConfig.{jsMin, cssMin, imageMin}` is cached on the class. If a
host process calls `buildConfig` more than once (e.g. a test runner or an
IDE plugin driving multiple projects), the second call reuses the first
call's state. That includes `imageMin` — the first call's `cfg.imageMin`
options win.

Not a problem for the single-invocation `webpack-cli` flow, but worth
knowing if this library ever runs in a longer-lived process.
