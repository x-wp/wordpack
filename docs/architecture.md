# @x-wp/wordpack — Architecture

A webpack-5 wrapper that turns a single `wpwp.config.ts` file into a multi-config
webpack build tailored for WordPress themes and plugins. Each logical "bundle"
becomes its own webpack `Configuration`; a trailing `AssetCopy` config copies
any leftover images and writes the shared asset manifest as both JSON and PHP.

The package is published as `@x-wp/wordpack`. Consumers point `webpack-cli` at a
thin shim that calls the default export (`buildConfig(env)`) and webpack does
the rest.

## Documentation map

| File | Audience | What's in it |
|------|----------|--------------|
| [architecture.md](./architecture.md) (this file) | everyone | Overview, mental model, end-to-end lifecycle |
| [configuration.md](./configuration.md) | consumers | `WordPackConfig` / `BundleConfig` / `PathConfig` reference |
| [conventions.md](./conventions.md) | consumers | Source-tree layout, manifest consumption, env flags |
| [pipeline.md](./pipeline.md) | maintainers | Step-by-step walkthrough of `buildConfig` |
| [services.md](./services.md) | maintainers | Every `lib/services/*` class and what webpack slice it emits |
| [development.md](./development.md) | maintainers | Repo layout, scripts, TS/ESLint, CI |
| [open-questions.md](./open-questions.md) | maintainers | Fields/behaviors that look vestigial — not claims, just flags |

## Mental model

1. **One config file, many webpack configs.** The user writes one
   `wpwp.config.ts`. The library expands it into `bundles.length + 1` webpack
   configurations — one per bundle plus one named `AssetCopy`.
2. **Each bundle is a mini-webpack-app.** It has its own entry points, output
   directory, webpackbar, split-chunk rules, and minimizers.
3. **Manifest is shared.** Every bundle's `WebpackAssetsManifest` instance
   writes into the same in-memory `Assets` object; only the trailing
   `AssetCopy` config flushes it to disk as `assets.json` and `assets.php`.
4. **Decorators everywhere.** User config is validated and defaulted by
   `class-validator` / `class-transformer`. Both the env (`WordPackEnv`) and
   the file (`WordPackConfig`) go through `transformAndValidateSync`.

## Source layout

```
lib/
├── index.ts              ← public entry: `buildConfig` + type aliases
├── functions/            ← the `buildConfig` orchestrator + manifest helpers
├── config/               ← decorated config classes (WordPackEnv, WordPackConfig, BundleConfig, PathConfig)
├── interfaces/           ← user-facing TS interfaces (permissive shapes)
├── services/             ← the eight classes that build webpack config slices
├── plugins/              ← custom webpack plugins (OnlyFriendlyErrorsPlugin)
└── @types/               ← ambient module shims for untyped upstream packages
```

See [services.md](./services.md) for a class-by-class breakdown of
`lib/services/` and [configuration.md](./configuration.md) for the fields a
consumer sets.

## End-to-end lifecycle

```
┌───────────────────────────────────────────────────────────────────────┐
│ npm test → webpack --config test/webpack.config.ts --env basePath=./test
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ test/webpack.config.ts                                                │
│   export default async (env) => buildConfig(env)                      │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ lib/functions/build-config.ts  (buildConfig)                          │
│                                                                       │
│  1. env = UserConfig.env(webpackEnv)                                  │
│       └─ transformAndValidateSync(WordPackEnv, …)                     │
│  2. cfg = await UserConfig.load('wpwp.config.ts', env)                │
│       ├─ possiblePaths → search 5 locations under env.base            │
│       ├─ await import(cfgPath)  (ts-node for .ts)                     │
│       ├─ merge:  { ...userConfig, ...instanceToPlain(env) }           │
│       │          ── env wins on key collisions ──                     │
│       └─ transformAndValidateSync(WordPackConfig, …)                  │
│                                                                       │
│  3. for each bundle:                                                  │
│       merge(                                                          │
│         SharedConfig.build(cfg),        ← mode, devtool, externals    │
│         ManifestConfig.build(cfg),      ← asset manifest plugin       │
│         EntryConfig.build(cfg, bundle), ← entry, output, webpackbar   │
│         CompileConfig.build(cfg, bundle),← loaders + MiniCssExtract   │
│         OptimizeConfig.build(cfg, bundle),← split chunks + minimizers │
│         cfg.override,                   ← global webpack overrides    │
│         bundle.override,                ← per-bundle overrides        │
│       ) → push to Configuration[]                                     │
│                                                                       │
│  4. push AssetConfig.build(cfg)                                       │
│       └─ name: 'AssetCopy', dependencies: [all bundle names],         │
│          copies images.src → images.dist, writes manifest to disk     │
│                                                                       │
│  5. fs.emptyDirSync(cfg.path('dist', 'root'))                         │
│       ── synchronous side effect, before webpack runs ──              │
│                                                                       │
│  6. return Configuration[]                                            │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ webpack multi-compiler                                                │
│   runs each Configuration (bundles first by dependency order, then    │
│   AssetCopy last), emitting:                                          │
│     dist/js/<bundle>/<name>.<hash>.js                                 │
│     dist/css/<bundle>/<name>.<hash>.css                               │
│     dist/js/<vendor>/<vendor>.<hash>.js                               │
│     dist/images/**, dist/fonts/**                                     │
│     dist/assets.json  +  dist/assets.php                              │
└───────────────────────────────────────────────────────────────────────┘
```

Anchors: [`lib/functions/build-config.ts:7-41`](../lib/functions/build-config.ts),
[`lib/services/user-config.service.ts:1-73`](../lib/services/user-config.service.ts).
See [pipeline.md](./pipeline.md) for each step in detail.

## Public API

`lib/index.ts` exports three things:

```ts
import 'reflect-metadata';
import buildConfig from '@x-wp/wordpack';
import { WordPackConfig, BundleConfig } from '@x-wp/wordpack';
```

- `buildConfig(env, wpwpConfig?)` — default export. Async, returns
  `Promise<Configuration[]>`.
- `WordPackConfig` — type alias for `WordPackConfigInterface`.
- `BundleConfig` — type alias for `BundleConfigInterface`.

Note that the exported types are the *interfaces* (permissive input shapes),
not the decorated classes. Consumers typing their `wpwp.config.ts` against
`WordPackConfig` only see the permissive shape; see
[configuration.md](./configuration.md) for the full class-validated rules.

## What the build produces

Given the checked-in test fixture at `test/wpwp.config.ts` (one `admin`
bundle, `splitChunks: true`), a production build produces:

- `dist/js/admin/list-page.<hash>.js` — the bundle entry
- `dist/js/<vendor>/<vendor>.<hash>.js` — each vendor chunk matching
  `chunkTest`, named by `OptimizeConfig.chunkName(module)`
- `dist/css/admin/{metabox,list-page,cte}.<hash>.css` — extracted SCSS
- `dist/css/vendor/<vendor>.<hash>.css` — CSS from split-chunk vendors, if any
- `dist/images/**` — copied via CopyPlugin, minified (sharp + SVGO) in prod
- `dist/fonts/**` — emitted by `asset/resource` rules
- `dist/assets.json` and `dist/assets.php` — manifest twins

A real snapshot of that output lives in `test/dist/` for reference.
