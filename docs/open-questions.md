# Open questions

A running log of observations that *look* suspicious or dead but aren't
confirmed bugs. None of these are claims — they're flags to investigate
before anyone refactors. Each is annotated with a source anchor so you
can verify in-repo.

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

Source: [`lib/functions/build-config.ts`](../lib/functions/build-config.ts).

```ts
res.push(Svc.AssetConfig.build(cfg));

const distDir = cfg.path('dist', 'root');
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

return res;
```

The wipe runs as a side effect while `buildConfig` is still assembling
its return value — *before* webpack has seen the config. Consequences:

- Programmatic callers that invoke `buildConfig` to inspect config
  (without running webpack) still wipe `dist/`.
- If webpack later fails, `dist/` is already empty.
- There is no escape hatch. Consumers who want to preserve some output
  (e.g. long-lived PHP files next to webpack assets) must put them
  outside `dist/`.

A webpack plugin hook (`CleanWebpackPlugin`, or webpack 5's native
`output.clean: true`) would make the intent more discoverable and let it
honor webpack's dry-run semantics, but changing this is a behavior shift,
not a cleanup.

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
