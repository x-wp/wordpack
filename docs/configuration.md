# Configuration reference

This page documents every field a consumer can set. The library layers two
sources together:

1. **Env** — flags coming from `webpack --env foo=bar` (parsed into `WordPackEnv`).
2. **File** — the default export of `wpwp.config.ts` (parsed into `WordPackConfig`).

At load time the env is spread *after* the file, so **env values win on key
collisions** (`lib/services/user-config.service.ts:62-63`). That lets you
override `basePath`, `production`, or `watch` from the CLI without touching
the config file.

## `WordPackEnv` (env flags)

Source: [`lib/config/wordpack-env.ts:5-37`](../lib/config/wordpack-env.ts).

| Field | Type | Default | Transform | Notes |
|-------|------|---------|-----------|-------|
| `basePath` | `string` | — (required) | `path.posix.resolve(process.cwd(), value || '')` | Becomes the absolute project root. Pass via `--env basePath=./project`. |
| `production` | `boolean` | `false` | `value || false` | Pass via `--env production`. Forces `sourceMaps = false` after load. |
| `watch` | `boolean` | `false` | `obj.WEBPACK_WATCH || value || false` | Picks up `WEBPACK_WATCH` that webpack-cli sets when `--watch` is used. |

Methods:

- `base` (getter) — alias for `basePath`.
- `prod` (getter) — alias for `production`.
- `resolve(...paths)` — `path.posix.resolve(base, ...paths)`.

## `WordPackConfig` (file)

Source: [`lib/config/wordpack.config.ts:38-162`](../lib/config/wordpack.config.ts).
Extends `WordPackEnv`, so every env field is also available on the loaded
config.

### Filename templates

All three strip any `[ext]` placeholder a user might add — webpack's
`asset/resource` generators and `MiniCssExtractPlugin` append extensions
themselves.

| Field | Default | Purpose |
|-------|---------|---------|
| `imagename` | `'[name]'` | Filename template under `images.dist/`. Used by the SCSS image `asset/resource` rule and by `CopyPlugin`. |
| `fontname` | `'[name]'` | Filename template under `fonts.dist/`. Used by the font `asset/resource` rule. |
| `filename` | `'[name].[contenthash:6]'` | JS/CSS output template. Dev mode uses `'[name]'` instead (see `WordPackConfig.asset`). |

### Required + common

| Field | Type | Default | Decorators | Notes |
|-------|------|---------|------------|-------|
| `bundles` | `BundleConfig[]` | — (required) | `@ValidateNested({ each: true })`, `@Type(() => BundleConfig)` | See below. |
| `manifest` | `string` | `'assets.json'` | `@IsString()` | Output filename for the JSON manifest. A PHP twin (`assets.php`) is written next to it. Set to empty string to disable. |
| `sourceMaps` | `DevtoolString \| false` | `'eval-cheap-source-map'` | `@IsEnum([...])` | Valid: `'eval'`, `'eval-cheap-source-map'`, `'eval-cheap-module-source-map'`, `'eval-source-map'`, `'cheap-source-map'`, `'cheap-module-source-map'`, `'source-map'`, `false`. Forced to `false` when `env.production` is true (`user-config.service.ts:26-28`). |
| `externals` | `webpack ExternalItem` | `[{jquery: 'jQuery', underscore: '_', backbone: 'backbone', lodash: '_'}]` | `@IsNotEmpty()` | Paired with `externalsType: 'window'` in `SharedConfig`. |
| `paths` | `PathConfig` | `new PathConfig()` | `@IsObject()`, `@ValidateNested()`, `@Type(() => PathConfig)` | See [PathConfig](#pathconfig). |
| `imageMin` | `Partial<SharpEncodeOptions>` | `{}` | `@IsObject()` | Merged on top of the defaults in `OptimizeConfig.getImageMinimizers`. |
| `override` | `Partial<Configuration>` | `{}` | `@IsObject()` | Extra webpack config merged into *every* bundle (last before per-bundle override). |

### Advanced / less common

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `globalChunks` | `string[]` | `['awesome-notifications']` | Not currently consumed by any service — see [open-questions.md](./open-questions.md). |
| `multimode` | `boolean` | `true` | Not currently consumed — see [open-questions.md](./open-questions.md). |

### Helper methods

The loaded config exposes path helpers used throughout the services:

| Method | Returns |
|--------|---------|
| `root(which)` | `dir(which, 'root')` |
| `images(which)`, `scripts(which)`, `styles(which)`, `fonts(which)` | `dir(which, kind)` |
| `path(which, dir)` | Absolute path: `resolve(basePath, paths.root[which], paths[dir][which])`. When `dir === 'root'`, only the root is appended. |
| `dir(which, dir)` | Raw string from `paths`. If `paths[dir]` is a plain string, that string is returned for *both* `'src'` and `'dist'`. |
| `mode` (getter) | `'production'` when `prod`, else `'development'`. |
| `asset` (getter) | `filename` in prod, `'[name]'` in dev. Used in output filename templates to skip hashes during watch/dev. |
| `isCI` (getter) | `process.env.CI !== undefined`. Controls `fancy`/`basic` flags on `WebpackBarPlugin`. |

`which` is `'src' | 'dist'`. `dir` is a key of `PathConfig`.

## `PathConfig`

Source: [`lib/config/dir.config.ts:1-19`](../lib/config/dir.config.ts).

```ts
class DirMap { src: string; dist: string; }

class PathConfig {
  root:    DirMap | string = { src: 'assets', dist: 'dist' };
  scripts: DirMap | string = 'scripts';
  styles:  DirMap | string = 'styles';
  images:  DirMap | string = 'images';
  fonts:   DirMap | string = 'fonts';
}
```

Each key accepts either:

- a `DirMap` — `{src, dist}` when source and output dirnames differ (e.g.
  `{src: 'scripts', dist: 'js'}` — what the test fixture uses);
- a `string` — same name for both sides.

Fields are `@Allow()`-only (no strict validation), so unexpected types pass
through silently. Coercion happens inside `WordPackConfig.dir(which, dir)`.

## `BundleConfig`

Source: [`lib/config/bundle.config.ts:17-76`](../lib/config/bundle.config.ts).

| Field | Type | Default | Decorators | Notes |
|-------|------|---------|------------|-------|
| `name` | `string` | — (required) | `@IsString()` | Webpack config `name`, bundle output subdir, webpackbar label. |
| `files` | `string[]` | — (required) | `@IsString({ each: true })` | Relative to `paths.root.src`. Grouped into webpack entries by basename-without-extension (see `entry` getter). |
| `splitChunks` | `boolean` | `true` | `@IsBoolean()` | Disables vendor chunk extraction when `false`. Also suppressed whenever `cfg.watch` is true (`optimize-config.service.ts:61`). |
| `chunkTest` | `RegExp` | `/[\\/]node_modules[\\/]/` | `@IsInstance(RegExp)`, `@Type(() => RegExp)`, validated only if `splitChunks` | Passed as `cacheGroups.vendor.test`. |
| `chunkMinSize` | `number` | `5000` | `@Min(10)`, `@IsPositive()`, `@IsInt()`, validated only if `splitChunks` | `cacheGroups.vendor.minSize`. The test fixture sets `100` to force splitting of small bundles. |
| `color` | `string?` | — | `@IsHexColor()`, `@IsOptional()` | Overrides the deterministic `Colorizer.stringToColor` pick. |
| `override` | `Partial<Configuration>` | `{}` | `@IsObject()`, `@IsOptional()` | Merged last, after global `cfg.override`. |
| `chunkId` | `string` | `'vendor-[name]'` | — | Computed getter `chunkName` substitutes `[name]` with the bundle name. Currently not consumed by any service — see [open-questions.md](./open-questions.md). |

Helper methods:

- `hasStyles()` — any file matches `/\.s?css$/i`. Used by
  `CompileConfig.getCssConfig` and `OptimizeConfig.getStyleConfig`.
- `hasScripts()` — any file matches `/(\.[tj]sx?)$/i`. Used by
  `CompileConfig.getJsConfig` / `getNoScriptConfig` and
  `OptimizeConfig.getScriptConfig`.
- `entry` (getter) — `files.reduce((obj, file) => { obj[basename(file, ext)].push(file); return obj })`.
  This is what `EntryConfig.build` passes to webpack as `entry`.

## Interfaces (user-facing shapes)

`lib/interfaces/*.ts` expose TypeScript interfaces that are a *superset*, not
an exact mirror, of the classes above:

- `WordPackEnvInterface` — all fields optional.
- `WordPackConfigInterface` — `bundles` required; most others optional. A
  simplified `externals?: Record<string, string>` (instead of the full
  webpack union).
- `BundleConfigInterface` — includes extra optional fields (`chunkName`,
  `globalChunks`, `entry`) that the class either computes as getters or
  doesn't expose at all. See [open-questions.md](./open-questions.md#bundle-config-interface-drift).

The default export of `@x-wp/wordpack` (`buildConfig`) is the function, and
the `WordPackConfig` / `BundleConfig` names re-exported from `lib/index.ts`
are the *interface* aliases, not the classes.

## Validation pipeline

Both layers go through `class-transformer-validator`'s `transformAndValidateSync`:

- `UserConfig.env(webpackEnv)` uses
  `transformer: { excludeExtraneousValues: true }`, so only `@Expose()`-decorated
  fields survive. That explicitly excludes `WEBPACK_WATCH`, which is read via
  the `watch` field's transform.
- `UserConfig.readFile(cfgPath, env)` merges the user's object with
  `instanceToPlain(env)` (env wins) and validates against `WordPackConfig`.
  Any decorator violation throws `WebpackError('Error parsing configuration file …')`.

Next: see [conventions.md](./conventions.md) for how these fields translate
into an on-disk source layout.
