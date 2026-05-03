# Pipeline: how `buildConfig` runs

This walks through `lib/functions/build-config.ts:7-41` in the order it
executes. If you're just trying to understand what fields exist, read
[configuration.md](./configuration.md) first; this page is about the
internals.

## Signature

```ts
export async function buildConfig(
  webpackEnv: Record<string, string> | WordPackEnv,
  wpwpConfig: string = 'wpwp.config.ts',
): Promise<Configuration[]>
```

Returns `Promise<Configuration[]>` — one element per bundle plus one
`AssetCopy` element at the end. Errors are wrapped by `webpack-cli` when the
returned promise rejects.

## Step 1 — Env intake

```ts
const env = Svc.UserConfig.env(webpackEnv);
```

`UserConfig.env` at `lib/services/user-config.service.ts:8-14` runs
`transformAndValidateSync(WordPackEnv, webpackEnv, { transformer: { excludeExtraneousValues: true } })`.
That:

- keeps only fields decorated with `@Expose()` — `basePath`, `production`,
  `watch` (and `WEBPACK_WATCH` which the `watch` transform reads from);
- resolves `basePath` to an absolute path against `process.cwd()`
  (`wordpack-env.ts:8`);
- coerces `production` / `watch` into booleans with sane defaults.

This function is pure and synchronous despite the async ancestors; it's
safe to call at any time.

## Step 2 — Config discovery

```ts
const cfg = await Svc.UserConfig.load(wpwpConfig, env);
```

`UserConfig.load` (`user-config.service.ts:16-31`) does three things:

1. **Resolve the path.** If `wpwpConfig` is already an existing file
   relative to `env.base`, use that. Otherwise delegate to `findFile`
   (`user-config.service.ts:33-43`), which tries each location from
   `possiblePaths` in order and throws `WebpackError` if none exists.

   ```ts
   possiblePaths = [
     '',                  // <basePath>/wpwp.config.ts
     'assets',            // <basePath>/assets/wpwp.config.ts
     'assets/wordpack',
     'assets/webpack',
     'assets/build',
   ]
   ```
2. **Read and validate.** `readFile` (`user-config.service.ts:57-72`) does
   a dynamic `await import(cfgPath)`. For `.ts` files, this works because
   `ts-node` is a production dependency and webpack-cli registers it for
   TypeScript config. The user's default export is merged with the already-
   validated env:

   ```ts
   const configObj = { ...configOpts, ...instanceToPlain(env) };
   ```

   **Env wins on key collisions**, so `--env production` trumps a
   `production: false` in the file. Then
   `transformAndValidateSync(WordPackConfig, configObj)` runs, applying all
   decorators (`@Type`, `@Transform`, `@ValidateNested`, etc.).

3. **Production override.** Back in `load`, after validation:

   ```ts
   if (env.production) {
     config.sourceMaps = false;
   }
   ```

   This is the only mutation `buildConfig` performs on the config instance.
   A user who explicitly wants source maps in production cannot get them
   through the config file alone.

Any error inside `readFile` — failed import, invalid decorator match,
missing required field — is re-thrown as
`WebpackError('Error parsing configuration file <path>')` with no detail.
If you're debugging a real validation failure, comment out the
`try/catch` at `user-config.service.ts:61-71` to see the underlying
`class-validator` errors.

## Step 3 — Per-bundle merge

```ts
cfg.bundles.forEach((bundle) =>
  res.push(
    merge(
      Svc.SharedConfig.build(cfg),
      Svc.ManifestConfig.build(cfg),
      Svc.EntryConfig.build(cfg, bundle),
      Svc.CompileConfig.build(cfg, bundle),
      Svc.OptimizeConfig.build(cfg, bundle),
      cfg.override,
      bundle.override,
    ),
  ),
);
```

`merge` is webpack-merge's default strategy: arrays concatenate, objects
recurse, scalars overwrite. Order matters — each slice overrides keys from
earlier ones. The rationale for the specific order:

| Slot | Service | Why here |
|------|---------|----------|
| 1 | `SharedConfig` | Bedrock: `devtool`, `context`, `externals`, `mode`, `target`, `stats`, `FriendlyErrorsWebpackPlugin` (with `silentSuccess: true`). Cached statically across bundles. |
| 2 | `ManifestConfig` | Adds the per-bundle `WebpackAssetsManifest` plugin (shared `Assets` object). Separated so it can be toggled by the single `cfg.manifest` flag. |
| 3 | `EntryConfig` | Sets `name`, `entry`, `output` and the bundle-specific `WebpackBarPlugin`. Must come before `CompileConfig` because `CompileConfig.getCssConfig` uses `bundle.entry` keys to decide the CSS output directory. |
| 4 | `CompileConfig` | Loaders + `MiniCssExtractPlugin` + `CssUrlRelativePlugin` + `WebpackRemoveEmptyScriptsPlugin`. |
| 5 | `OptimizeConfig` | `splitChunks` and minimizers. Disabled in watch mode (`getChunkConfig`). |
| 6 | `cfg.override` | User's global webpack overrides. |
| 7 | `bundle.override` | User's per-bundle overrides. Wins over everything. |

Each `.build()` returns a `Partial<Configuration>`. See [services.md](./services.md)
for the exact shape of each slice.

## Step 4 — AssetCopy tail config

```ts
res.push(Svc.AssetConfig.build(cfg));
```

`AssetConfig.build` (`lib/services/asset-config.service.ts:12-18`) returns a
separate webpack config with `name: 'AssetCopy'`, no entry points, and a
`CopyPlugin` that mirrors `images.src/` into `images.dist/` — but with a
filter that skips files already present in the destination
(`filterAssets`, `asset-config.service.ts:53-59`). That way images referenced
from SCSS (emitted by the `asset/resource` rule inside each bundle) aren't
overwritten by raw copies.

It also declares

```ts
dependencies: cfg.bundles.map(({ name }) => name)
```

so webpack-cli sequences it *after* all bundle configs have completed. This
matters because only the `AssetCopy` manifest plugin sets `writeToDisk: true`
— the in-memory `Assets` object is only fully populated once every bundle
has run.

In production mode the asset config also picks up
`OptimizeConfig.getImageMinimizers(cfg.imageMin)` so copied images are
minified on the way through.

## Step 5 — Synchronous dist wipe

```ts
const distDir = cfg.path('dist', 'root');
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
```

This runs *inside* `buildConfig`, before `return res`. Implications:

- It happens at config-construction time, not as a webpack plugin hook.
  Re-running `buildConfig` alone (e.g. in a test) clears the dist
  directory even if webpack never runs.
- Because it's synchronous and placed after the configs are built, it
  runs even on an empty `bundles` list — but not when `UserConfig.load`
  throws, since the `try/catch` in `buildConfig` converts that into a
  rejected promise first.
- Consumers who want to preserve files between builds need to use a
  different output path; the library does not expose a "no-clean" flag.

See [open-questions.md](./open-questions.md#dist-wipe-timing) for further
notes.

## Step 6 — Error path

The whole body runs inside

```ts
try { … return res; } catch (e) { return Promise.reject(e); }
```

Anything thrown — config validation, dynamic import failure, service build —
surfaces as a rejected promise. webpack-cli reports that as a build failure.

## Caveats and shared state

The services cache shared instances in static fields. When debugging, keep
these in mind:

- `SharedConfig.sharedCfg` (`shared-config.service.ts:8,10`) — the first
  call builds the shared webpack slice and all subsequent bundles reuse
  it. Because `webpack-merge` concatenates plugin arrays, every bundle
  ends up with the *same* `FriendlyErrorsWebpackPlugin` *instance* appended
  to its plugins array. Webpack handles that fine, but don't mutate the
  plugin between bundles.
- `ManifestConfig.asts` (`manifest-config.service.ts:12,28`) — a shared
  `Assets` object with `Object.create(null)` prototype. All
  `WebpackAssetsManifest` instances across all bundles and the
  AssetCopy config write into this one object, which is how a single
  `assets.json` aggregates everything.
- `OptimizeConfig.{jsMin, cssMin, imageMin}` — each is lazily allocated
  on first call and reused. Passing a different `cfg.imageMin` in a later
  call would *not* rebuild the minimizer array; the first
  `getImageMinimizers(options)` wins. This matters if you're embedding
  `buildConfig` inside a longer-running process and think you're varying
  image options per build.

## Exit criteria

A successful run returns an array of `Configuration` of length
`cfg.bundles.length + 1`. Webpack multi-compiler then builds each
configuration according to the declared `dependencies`, emitting the
directory tree described in [architecture.md](./architecture.md#what-the-build-produces).
