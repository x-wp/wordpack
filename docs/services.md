# Services

Every class under `lib/services/` is a stateless (or statically-cached)
builder that returns a slice of webpack config. `buildConfig` merges those
slices together with `webpack-merge`. This page documents each class —
input, output shape, and any non-obvious behavior.

The services barrel is [`lib/services/index.ts`](../lib/services/index.ts); it
re-exports every class below.

## `UserConfig` — config discovery, loading, validation

Source: [`lib/services/user-config.service.ts:1-73`](../lib/services/user-config.service.ts).

| Method | Signature | Purpose |
|--------|-----------|---------|
| `static env(webpackEnv)` | `(Record<string, string> \| WordPackEnv) ⇒ WordPackEnv` | Parses and validates env flags. `transformer: { excludeExtraneousValues: true }` discards anything not `@Expose()`-d on `WordPackEnv`. |
| `static async load(cfgPath, env)` | `(string, WordPackEnv) ⇒ Promise<WordPackConfig>` | Resolves the config path, calls `readFile`, then forces `sourceMaps = false` when `env.production`. |
| `private static findFile(rootDir, cfgPath)` | `(string, string) ⇒ string` | Tries each location in `possiblePaths`; throws `WebpackError` when none exist. |
| `private static possiblePaths(rootDir, cfgName)` | `(string, string) ⇒ string[]` | `['', 'assets', 'assets/wordpack', 'assets/webpack', 'assets/build']` joined against `rootDir`. |
| `private static async readFile(cfgPath, env)` | `(string, WordPackEnv) ⇒ Promise<WordPackConfig>` | Dynamic `await import(cfgPath)` (ts-node for `.ts`), merges `{ ...configOpts, ...instanceToPlain(env) }`, validates against `WordPackConfig`. Wraps any error as `WebpackError('Error parsing configuration file …')`. |

Key behavior to remember:

- Env fields win over file fields because of the spread order in
  `readFile`.
- The `try/catch` inside `readFile` throws away the underlying validation
  detail. If you're debugging, temporarily comment it out.

## `SharedConfig` — base webpack settings

Source: [`lib/services/shared-config.service.ts`](../lib/services/shared-config.service.ts).

Returned slice:

```ts
{
  devtool: cfg.sourceMaps,
  context: cfg.path('src', 'root'),
  externalsType: 'window',
  externals: cfg.externals,
  mode: 'development',              // overridden by getProdConfig in prod
  target: 'web',
  stats: false,
  optimization: { removeEmptyChunks: true },
  plugins: [new FriendlyErrorsWebpackPlugin({
    clearConsole: false,
    silentSuccess: true,
  })],
  // When !cfg.prod (dev/watch):
  cache: {
    type: 'filesystem',
    buildDependencies: { config: [cfg.cfgPath] },  // invalidates on wpwp.config.ts change
  },
  // When cfg.watch:
  watch: true,
  watchOptions: { ignored: /node_modules/, aggregateTimeout: 600, poll: 1000 },
  // When cfg.prod:
  devtool: false,
  mode: 'production',
  optimization: { minimize: true },
}
```

Static cache: `this.sharedCfg ??= merge(core, watch, prod)` — built once
per `buildConfig` call, reused across all bundles. That means a single
`FriendlyErrorsWebpackPlugin` instance is appended to every bundle's plugins
array after webpack-merge concatenation. `silentSuccess: true` mutes the
per-compile "Compiled successfully" banner so that webpackbar (which
already shows per-bundle status) is the single source of success output.

## `ManifestConfig` — shared asset manifest

Source: [`lib/services/manifest-config.service.ts:10-43`](../lib/services/manifest-config.service.ts).

| Method | Purpose |
|--------|---------|
| `static build(cfg)` | Returns `{}` when `!cfg.manifest`; otherwise `{ plugins: [getManifestPlugin({ output: cfg.manifest })] }`. |
| `static getManifestPlugin(options = {})` | Lazily creates the shared `asts` object (`Object.create(null)`) and returns a new `WebpackAssetsManifest` with that object, `merge: true`, `sortManifest: true`, `customize: manifestEntryFormatter`, and `writeToDisk: false` by default. |

Two non-obvious points:

1. Every bundle gets a *different* `WebpackAssetsManifest` instance, but
   they all share the same `asts` object. That's how cross-bundle
   deduplication works — the final manifest aggregates every emitted
   asset.
2. Only `AssetConfig` passes `writeToDisk: true` (along with the
   `manifestFileWriter` `done` hook), so `assets.json` and `assets.php`
   only exist on disk after the tail config runs.

### `manifestEntryFormatter`

Source: [`lib/functions/manifest-utils.ts:6-10`](../lib/functions/manifest-utils.ts).

```ts
({ key, value }) => ({ key: `${dirname(value)}/${basename(key)}`, value })
```

So a webpack asset whose key starts as `list-page.js` and whose value is
`js/admin/list-page.abc123.js` becomes

```json
"js/admin/list-page.js": "js/admin/list-page.abc123.js"
```

in the manifest — the key reflects the output directory while keeping the
original (unhashed) filename, which is what downstream WordPress code needs
to look up assets by stable name.

### `manifestFileWriter`

Source: [`lib/functions/manifest-utils.ts:12-34`](../lib/functions/manifest-utils.ts).

Called via `done:` on the `AssetCopy` manifest plugin. Writes a `.php` file
alongside the JSON manifest. Format:

```php
<?php
return array(
    'js/admin/list-page.js'   => 'js/admin/list-page.abc123.js',
    'css/admin/list-page.css' => 'css/admin/list-page.abc123.css',
    ...
);
```

Keys are padded to the width of the longest key for readability
(`findLongest`, line 36). The output path is derived by replacing `.json`
with `.php` on the manifest plugin's output path.

## `EntryConfig` — per-bundle entry, output, progress bar

Source: [`lib/services/entry-config.service.ts:8-49`](../lib/services/entry-config.service.ts).

Returned slice (merged from `getCoreConfig` and `getBarConfig`):

```ts
{
  name: bundle.name,
  entry: bundle.entry,                           // basename-grouped map
  output: {
    path: cfg.path('dist', 'root'),
    publicPath: '',
    filename: `${cfg.scripts('dist')}/${bundle.name}/${cfg.asset}.js`,
  },
  optimization: { moduleIds: 'deterministic' },
  plugins: [
    new WebpackBarPlugin({
      name: camelcase(bundle.name),
      fancy: !cfg.isCI,
      basic: cfg.isCI,
      color: bundle.color || Colorizer.stringToColor(bundle.name),
    }),
  ],
}
```

`cfg.asset` is `'[name]'` in dev (skip hashes for faster builds) and
`cfg.filename` (default `'[name].[contenthash:6]'`) in prod.

## `CompileConfig` — loaders, MiniCssExtract, asset rules

Source: [`lib/services/compile-config.service.ts:9-170`](../lib/services/compile-config.service.ts).

`build()` merges three sub-slices:

1. **`getJsConfig(cfg, bundle)`** — returns `{}` if `!bundle.hasScripts()`.
   Otherwise:
   ```ts
   {
     module: { rules: [{
       test: /\.[tj]sx?$/,
       include: [cfg.path('src', 'scripts')],
       exclude: [/node_modules(?![/|\\](bootstrap|foundation-sites))/],
       use: {
         loader: 'swc-loader',
         options: {
           env: {
             mode: 'usage',
             coreJs: '3.38',
             targets: resolveBrowserTargets(cfg),  // browserslist
           },
           jsc: {
             parser: { syntax: 'typescript', tsx: true, decorators: true },
             transform: { legacyDecorator: true, decoratorMetadata: true },
           },
         },
       },
     }]},
     resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'] },
   }
   ```

   **Polyfills**: `env.mode: 'usage'` auto-injects `core-js@3.38`
   polyfills per file based on the API usage SWC sees. Targets come
   from a `browserslist()` call rooted at `cfg.path('src', 'root')`
   — that resolves the consumer's `.browserslistrc` (or
   `package.json#browserslist`) regardless of where webpack is invoked
   from. With no browserslist file, browserslist's own `defaults`
   query (`> 0.5%, last 2 versions, Firefox ESR, not dead`) applies
   and the bundle stays modern. Note: SWC's env reads browserslist
   from `process.cwd()` by default, which is fragile in monorepos —
   that's why we resolve and pass `targets` explicitly.

   `bootstrap` and `foundation-sites` are whitelisted from the
   `node_modules` exclusion so their SCSS mixins / JS helpers can be
   transpiled alongside project code.

2. **`getCssConfig(cfg, bundle)`** — returns `{}` if `!bundle.hasStyles()`.
   Otherwise defines three rules plus two plugins:

   - **SCSS/CSS rule** (`test: /\.(sa|sc|c)ss$/i`, `include: cfg.path('src', 'styles')`)
     — loader chain, right-to-left:

     | Order | Loader | Options |
     |-------|--------|---------|
     | 1 (innermost) | `sass-loader` | `api: 'modern-compiler'`, `sourceMap: true`, `sassOptions: { outputStyle: 'expanded', quietDeps: true }` |
     | 2 | `resolve-url-loader` | `sourceMap: true` |
     | 3 | `postcss-loader` | `postcssOptions: { plugins: ['postcss-preset-env'] }`, `sourceMap: true` |
     | 4 | `css-loader` | `importLoaders: 1`, `sourceMap: true` |
     | 5 (outermost) | `MiniCssExtractPlugin.loader` | — |

     All four `sourceMap: true` toggles ensure error messages map back to
     the original SCSS, even though CSS is extracted and minified
     downstream.

   - **Image rule** (`test: /\.(png|svg|jpg|jpeg|gif|ico|avif)$/i`, `type: 'asset/resource'`)
     emits to `${cfg.images('dist')}/${cfg.imagename}[ext]`.
   - **Font rule** (`test: /\.(ttf|otf|eot|woff2?)$/`, `type: 'asset/resource'`)
     emits to `${cfg.fonts('dist')}/${cfg.fontname}[ext]`.

   Plugins:

   - `new MiniCssExtractPlugin({ filename: ({chunk}) => cssName(chunk?.name, bundle, cfg) })`
     — dynamic filename. `cssName` (line 161) returns
     `${cfg.styles('dist')}/${dir}/${cfg.asset}.css`, where `dir` is the
     bundle name if `chunk?.name` matches an entry key, otherwise
     `'vendor'`.
   - `new CssUrlRelativePlugin()` — rewrites CSS `url()` references to
     paths relative to the CSS file's final location. Type shim at
     [`lib/@types/css-url-relative-plugin.d.ts`](../lib/@types/css-url-relative-plugin.d.ts).

3. **`getNoScriptConfig(bundle)`** — returns `{}` only when the bundle is
   scripts-only. In every other case (styles-only *or* scripts+styles) it
   adds `new WebpackRemoveEmptyScriptsPlugin()`. The condition in the
   source is inverted from what you might expect: `if (hasScripts && !hasStyles) return {}` → plugin *added* everywhere else.

## `OptimizeConfig` — split chunks and minification

Source: [`lib/services/optimize-config.service.ts:14-191`](../lib/services/optimize-config.service.ts).

`build()` merges three sub-slices:

1. **`getChunkConfig(cfg, bundle)`** — returns `{}` when
   `cfg.watch || !bundle.splitChunks`. Otherwise:

   ```ts
   {
     optimization: {
       splitChunks: {
         hidePathInfo: true,
         cacheGroups: {
           vendor: {
             priority: 10,
             reuseExistingChunk: true,
             chunks: 'all',
             filename: () => OptimizeConfig.chunkFilename(cfg),
             name:     (m) => OptimizeConfig.chunkName(m),
             test: bundle.chunkTest,
             minChunks: 1,
             minSize: bundle.chunkMinSize,
           },
           default: false,
           defaultVendors: false,
         },
       },
     },
   }
   ```

   - `chunkFilename(cfg)` currently returns
     `${cfg.scripts('dist')}/[name].[contenthash:6].js` — *uncommitted
     edit*; HEAD still ships `${cfg.scripts('dist')}/[name].js` without the
     hash. See [open-questions.md](./open-questions.md#pending-chunkfilename-edit).
   - `chunkName(module)` (line 30) derives names from
     `module.identifier()`. Splits on `/node_modules/`, takes the last
     segment, and extracts a `<vendor>/<vendor>[-subpackage]` path (with
     leading `@` stripped for scoped packages). For CSS modules
     (`identifier().startsWith('css|')`) it returns just the vendor name.
     Combined with the filename template, this produces
     `js/<vendor>/<vendor>.<hash>.js` in the output.

2. **`getStyleConfig(cfg, bundle)`** — returns `{}` unless `cfg.prod &&
   bundle.hasStyles()`. Otherwise injects `CssMinimizerPlugin` plus the
   image minimizers (so images referenced from SCSS and emitted via the
   `asset/resource` rule are compressed).

3. **`getScriptConfig(cfg, bundle)`** — returns `{}` unless `cfg.prod &&
   bundle.hasScripts()`. Otherwise injects `TerserPlugin` with
   `extractComments: false`, `format: { comments: false, ascii_only: true }`,
   and `compress: { drop_console: true }`.

### Minimizer factories

All three minimizer arrays are lazy-built and cached on the class:

- `static getJsMinimizers()` → `[TerserPlugin(...)]` (settings above).
- `static getCssMinimizers()` → `[new CssMinimizerPlugin()]`.
- `static getImageMinimizers(options)` → two `ImageMinimizerPlugin`
  instances:
  1. Sharp minifier, excludes `/\.svg$/`, merges defaults
     (`jpeg: { progressive, trellisQuantisation, optimiseScans }`,
     `webp: { lossless }`, `avif: { lossless }`,
     `png: { compressionLevel: 8, adaptiveFiltering }`, `gif: {}`)
     with the user-supplied `options` (`cfg.imageMin`).
  2. SVGO minifier, includes `/\.svg$/`, `multipass: true`,
     `plugins: ['preset-default']`.

Because the array is cached, the **first** call's `options` determines the
sharp encoder settings for the rest of the process. In practice
`buildConfig` calls `getImageMinimizers(cfg.imageMin)` twice (once for
style-config minimizers, once for asset-config minimizers), both with the
same `cfg`, so this is harmless — but keep it in mind if embedding the
library.

## `AssetConfig` — image copy and manifest flush

Source: [`lib/services/asset-config.service.ts:11-88`](../lib/services/asset-config.service.ts).

Returns one self-contained webpack config with no entry points. Merged
from three sub-slices:

1. **`getCoreConfig(cfg)`**:
   ```ts
   {
     name: 'AssetCopy',
     context: cfg.path('src', 'root'),
     mode: cfg.mode,
     entry: {},
     output: { path: cfg.path('dist', 'root') },
     stats: false,
     plugins: [
       new CopyPlugin({
         patterns: [{
           from: `${cfg.images('src')}/`,
           to:   `${cfg.images('dist')}/[path]${cfg.imagename}[ext]`,
           force: false,
           noErrorOnMissing: false,
           toType: 'template',
           filter: (rp) => AssetConfig.filterAssets(cfg, rp),
         }],
       }),
       new WebpackBarPlugin({ fancy: !cfg.isCI, basic: cfg.isCI, name: 'AssetCopy' }),
     ],
     dependencies: cfg.bundles.map(({ name }) => name),
   }
   ```

   `filterAssets(cfg, rp)` (line 53) skips any file whose absolute source
   path, when rewritten from `root.src → root.dist` and
   `images.src → images.dist`, already exists on disk. That prevents
   `CopyPlugin` from clobbering images webpack already emitted via the
   SCSS `asset/resource` rule.

2. **`getManifestConfig(cfg)`** — returns `{}` if `!cfg.manifest`, else
   registers *the* manifest plugin that actually writes to disk:

   ```ts
   ManifestConfig.getManifestPlugin({
     output: cfg.manifest,
     writeToDisk: true,
     done: manifestFileWriter,
   })
   ```

3. **`getOptimizeConfig(cfg)`** — returns `{}` unless `cfg.prod`. In prod,
   adds `optimization.minimize: true` plus
   `OptimizeConfig.getImageMinimizers(cfg.imageMin)`.

## `Colorizer` — deterministic bar color from a string

Source: [`lib/services/colorizer.service.ts:3-48`](../lib/services/colorizer.service.ts).

Pure utility — no state.

```ts
Colorizer.stringToColor(str, bgColor = '000')
```

1. Hashes `str` into a 6-digit hex via a rolling bit-shift (`charCode + (hash << 9) - hash`).
2. Checks YIQ contrast against `bgColor`: `Math.abs(bgYiq - fgYiq) >= 128`.
3. If contrast fails, recursively hashes `str + '-10102010'` until a
   high-contrast color is found (deterministic retry — the same input
   always yields the same output).

Used by `EntryConfig.getBarConfig` to pick a webpackbar color when the
consumer doesn't set `bundle.color`.

## Ambient module shims

`css-url-relative-plugin` ships without typings; we declare its shape inline
so the library compiles in strict mode:

| Shim | Package | What it declares |
|------|---------|------------------|
| [`lib/@types/css-url-relative-plugin.d.ts`](../lib/@types/css-url-relative-plugin.d.ts) | `css-url-relative-plugin` | `CssUrlRelativePlugin` class with `apply(compiler)` and an options object with `root?: string`. |

`tsconfig.json`'s `typeRoots` entry `"./lib/@types"` is what makes them
resolvable during compilation.
