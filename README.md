<div align="center">

# wordpack

[![npm](https://img.shields.io/npm/v/@x-wp/wordpack?logo=npm)](https://www.npmjs.com/package/@x-wp/wordpack)
![Webpack Peer Dep](https://img.shields.io/npm/dependency-version/@x-wp/wordpack/peer/webpack?logo=webpack&logoColor=fff)
[![Release](https://github.com/x-wp/wordpack/actions/workflows/release.yml/badge.svg)](https://github.com/x-wp/wordpack/actions/workflows/release.yml)  
![npm downloads](https://img.shields.io/npm/dm/@x-wp/wordpack)
![GitHub](https://img.shields.io/github/license/x-wp/wordpack)
[![Codecov](https://img.shields.io/codecov/c/github/x-wp/wordpack?logo=codecov&color=%23F01F7A)](https://codecov.io/gh/x-wp/wordpack)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

</div>

wordpack is an opinionated webpack-based bundler toolkit for WordPress themes
and plugins. It abstracts the boilerplate of multi-bundle webpack
configuration — TypeScript and Sass compilation, asset optimization, manifest
generation, WordPress-aware externals — behind a small `wpwp.config.ts` file,
so the project's own webpack config stays a one-liner.

## Getting started

### Installation

```bash
npm install --save-dev @x-wp/wordpack webpack webpack-cli
```

Requires Node.js ≥ 20.

### Basic usage

wordpack uses two files: a webpack config that delegates to `buildConfig`, and
a `wpwp.config.ts` that describes the bundles you want to build.

`webpack.config.ts`:

```ts
import buildConfig from '@x-wp/wordpack';

export default async (env: Record<string, string>) => buildConfig(env);
```

`wpwp.config.ts`:

```ts
import { WordPackConfig } from '@x-wp/wordpack';

const config: WordPackConfig = {
  bundles: [
    {
      name: 'admin',
      files: [
        './styles/admin/metabox.scss',
        './scripts/admin/list-page.ts',
      ],
    },
  ],
};

export default config;
```

Then run webpack as you normally would — `production` and `basePath` come in
through webpack's `--env` flags:

```bash
# development build
npx webpack --env basePath=./

# production build
npx webpack --env production --env basePath=./
```

## Configuration

### Top-level options (`wpwp.config.ts`)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `bundles` | `BundleConfig[]` | _(required)_ | Entry-point groups to build. See below. |
| `filename` | `string` | `[name].[contenthash:6]` | Output filename pattern for emitted JS. |
| `imagename` | `string` | `[name]` | Filename pattern for emitted images. |
| `fontname` | `string` | `[name]` | Filename pattern for emitted fonts. |
| `manifest` | `string` | `assets.json` | Filename of the assets manifest written to the dist root. |
| `sourceMaps` | `false \| <devtool>` | `eval-cheap-source-map` | Webpack devtool to use, or `false` to disable. Accepts the standard `eval-*` / `*-source-map` values. |
| `externals` | `object` | `{ jquery: 'jQuery', underscore: '_', backbone: 'backbone', lodash: '_' }` | Webpack externals — pre-loaded with WP globals so you can `import $ from 'jquery'` without bundling it. |
| `paths` | `PathConfig` | _see below_ | Source/dist directory layout. |
| `imageMin` | `Sharp options` | `{}` | Encoder options forwarded to `image-minimizer-webpack-plugin` (Sharp). |
| `override` | `Partial<Configuration>` | `{}` | Low-level webpack config merged in last. Escape hatch for anything wordpack doesn't expose. |

### Bundle options

Each entry in `bundles` describes one logical group of assets — typically one
per WordPress screen or front-end surface (e.g. `admin`, `frontend`,
`block-editor`).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | _(required)_ | Bundle identifier. Used in chunk names and the CLI progress bar. |
| `files` | `string[]` | _(required)_ | Entry files for this bundle, relative to the appropriate src root in `paths`. |
| `splitChunks` | `boolean` | `true` | Extract a vendor chunk for this bundle. |
| `chunkTest` | `RegExp` | `/[\\/]node_modules[\\/]/` | Modules matching this pattern go into the vendor chunk. |
| `chunkMinSize` | `number` | `5000` | Minimum size in bytes before a vendor chunk is emitted. |
| `color` | `string` (hex) | — | Colour for this bundle's CLI progress bar (webpackbar). |
| `override` | `Partial<Configuration>` | `{}` | Per-bundle webpack overrides, merged on top of the global `override`. |

### Paths

`paths` controls where wordpack looks for sources and where it writes the
build. The defaults assume a typical WordPress plugin layout:

```ts
paths: {
  root:    { src: 'assets', dist: 'dist' },
  scripts: { src: 'scripts', dist: 'js' },
  styles:  { src: 'styles',  dist: 'css' },
  images:  { src: 'images',  dist: 'images' },
  fonts:   { src: 'fonts',   dist: 'fonts' },
}
```

Any entry can be shortened to a single string when the source and dist
folders share a name:

```ts
paths: {
  scripts: 'js',           // src/dist both 'js'
  styles:  { src: 'sass', dist: 'css' },
}
```

### Overrides

When you need to reach past wordpack's surface, both the top-level config and
each bundle accept an `override` that is merged into the generated webpack
config (top-level merges into every bundle, bundle-level merges into that
bundle only):

```ts
const config: WordPackConfig = {
  bundles: [
    {
      name: 'admin',
      files: ['./scripts/admin/list-page.ts'],
      override: {
        resolve: {
          alias: { '@admin': path.resolve(__dirname, 'assets/scripts/admin') },
        },
      },
    },
  ],
  override: {
    performance: { hints: false },
  },
};
```

## Contributing

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and releases are cut automatically by [semantic-release](https://semantic-release.gitbook.io/) from the `master`, `next`, `beta`, and `*.x` branches. Every push whose commit history contains a release-triggering type publishes a new version to npm and tags the release.

### Commit type → release bump

| Commit type | Release bump |
| --- | --- |
| `feat` | minor |
| `fix` | patch |
| `perf` | patch |
| any type with a `BREAKING CHANGE:` footer | major |
| anything else (`chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`) | none |

This is the [Angular preset](https://github.com/semantic-release/commit-analyzer#commit-types) that semantic-release applies by default. When in doubt, prefix your commit with `chore:` or `docs:` — those won't trigger a release.
