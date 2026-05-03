# Development

Working on the library itself.

## Repo layout

```
/
├── lib/                          ← TypeScript sources (rootDir)
│   ├── index.ts
│   ├── functions/                ← buildConfig + manifest-utils
│   ├── config/                   ← decorated config classes
│   ├── interfaces/               ← user-facing TS interfaces
│   ├── services/                 ← webpack-config builder classes
│   └── @types/                   ← ambient shims for untyped deps
├── dist/                         ← tsc output (outDir); published to npm
├── test/                         ← smoke-test harness
│   ├── webpack.config.ts
│   ├── wpwp.config.ts
│   ├── assets/                   ← sample source tree
│   ├── dist/                     ← last built snapshot (checked in)
│   ├── test.html
│   ├── tsconfig.json
│   ├── .browserslistrc
│   └── package.json
├── .github/workflows/release.yml ← semantic-release CI
├── .beads/                       ← beads issue tracker metadata
├── .vscode/
├── .editorconfig
├── .eslintrc.js
├── .prettierrc
├── .prettierignore
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md                     ← currently empty
```

## Scripts

From `package.json`:

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run build` | `rm -rf dist && tsc -p tsconfig.json` | Compile `lib/` to `dist/`. |
| `npm run watch` | `rm -rf dist && tsc -w -p tsconfig.json` | Incremental rebuild on save. |
| `npm test` | `webpack --config test/webpack.config.ts --env basePath=./test` | End-to-end smoke test (dev mode). |
| `npm run test:prod` | `webpack --config test/webpack.config.ts --env production basePath=./test` | Same, production mode: hashes, minification, image compression. |
| `npm run test:watch` | `webpack --config test/webpack.config.ts --watch --env basePath=./test` | Watch mode. |

The tests are non-assertive — they exercise the pipeline end-to-end and
emit to `test/dist/`; you eyeball the result (and diff against the
checked-in snapshot) to confirm nothing regressed.

## TypeScript

`tsconfig.json`:

- `"module": "CommonJS"` — dist is published as CJS.
- `"target": "ES2021"`.
- `"strict": true`, but `noImplicitAny`, `strictPropertyInitialization`,
  `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables` are all
  relaxed to accommodate the class-validator decorator patterns.
- `"emitDecoratorMetadata": true` and `"experimentalDecorators": true` —
  required for `class-transformer` / `class-validator`.
- `"typeRoots": ["./node_modules/@types", "./lib/@types"]` so the shim
  files resolve during compilation.
- `"rootDir": "./lib"`, `"outDir": "./dist"`.
- `"sourceMap": true`, `"declaration": true`, `"allowJs": true`.
- `"exclude": ["node_modules", "**/*.spec.ts", "test"]` — `test/` is not
  compiled by the library's `tsc`; `ts-node` handles it at test time.

## Lint and format

- `.eslintrc.js` — `@typescript-eslint/recommended` + `plugin:prettier/recommended`,
  `import` plugin, single-quote strings, trailing-comma `'always-multiline'`
  (except for functions). `ignorePatterns: ['.eslintrc.js', 'test/**/*']`.
- `.prettierrc` — two keys: `singleQuote: true`, `trailingComma: 'all'`.
- `.editorconfig` — 2-space indent, LF line endings, UTF-8, trim trailing
  whitespace, final newline.
- `.prettierignore` — just `dist`.

No `lint` or `format` script is wired up. If you're submitting changes,
run `npx eslint lib --ext .ts` and `npx prettier --check lib` manually.

## Test harness

`test/` doubles as the fixture for the smoke test *and* a reference
implementation that matches the docs:

- `test/webpack.config.ts` — the one-line shim documented in
  [conventions.md](./conventions.md#webpackconfigts).
- `test/wpwp.config.ts` — one active `admin` bundle plus several commented
  examples for other scenarios (`frontend`, `advanced`, `split-test`,
  `basic`, `css-only`, `js-only`). Uses `paths: { scripts: {src: 'scripts',
  dist: 'js'}, styles: {src: 'styles', dist: 'css'} }` and sets
  `sourceMaps: false`.
- `test/assets/` — `scripts/`, `styles/`, `images/`, `fonts/`. Includes
  an `autoload/_fonts.scss` partial imported by `metabox.scss` that
  declares the Titillium Web `@font-face` rules using relative `url()`s
  back into `../../fonts/`.
- `test/dist/` — the last built snapshot (checked in) so PRs can diff
  against it. Includes `assets.json` and `assets.php`.
- `test/test.html` — a manual smoke page with a few buttons and script
  includes; not automated.
- `test/tsconfig.json` — minimal (CJS, ES2019, `esModuleInterop`); used
  by `ts-node` when webpack-cli loads `test/webpack.config.ts` and
  `test/wpwp.config.ts`.
- `test/.browserslistrc` — `last 1 version`.
- `test/package.json` — carries the runtime deps used by the test sources
  (`jquery`, `@uppy/*`, `@fortawesome/fontawesome-free`,
  `awesome-notifications`) plus a few `@types/*`. No scripts; the harness
  runs from the repo root.

## CI

`.github/workflows/release.yml` triggers on pushes to `master`, `next`,
`beta`, and `*.x` branches:

1. Checkout with full history using `OBLAKBOT_PAT`.
2. Import GPG key (`OBLAKBOT_GPG_KEY` / `OBLAKBOT_GPG_PASS`) and set git
   user to the key owner for signed commits.
3. `actions/setup-node@v4` with the repo's LTS pin, npm cache enabled.
4. `npm clean-install` and `npm audit signatures`.
5. `npm run build` (TypeScript compile).
6. `cycjimmy/semantic-release-action` with `@semantic-release/github` to
   publish.

Secrets in play: `GITHUB_TOKEN`, `NPM_TOKEN`, plus the GPG/PAT pair.
`package.json` sets `"publishConfig": { "access": "public", "provenance":
true }` so npm receives provenance metadata.

## Engines and peer deps

- `engines.node`: `>=20`.
- `peerDependencies`: `webpack: ^5.94`, `webpack-cli: ^5.1`.
- `optionalDependencies`: `sass-embedded: ^1.79` — faster SASS compiler;
  `sass` picks it up automatically when installed.
- Production deps include the full loader / plugin stack: `swc-loader`
  + `@swc/core`, `css-loader`, `postcss-loader`, `sass-loader`,
  `mini-css-extract-plugin`, `terser-webpack-plugin` (using
  `TerserPlugin.swcMinify`), `css-minimizer-webpack-plugin`,
  `image-minimizer-webpack-plugin`, `copy-webpack-plugin`,
  `webpack-remove-empty-scripts`, `css-url-relative-plugin`,
  `webpack-assets-manifest`, `webpackbar`, `@x-wp/friendly-errors-webpack-plugin`.
- Validation stack: `class-validator`, `class-transformer`,
  `class-transformer-validator`, `reflect-metadata`.
- Dynamic config loading: `ts-node`.

## Publishing

The package declares `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`,
and `"files": ["dist"]`. Only `dist/` ships; the `lib/` source and `test/`
harness stay in the repo.

Semantic-release decides the version from the commit message prefixes.
The commits in this repo use conventional prefixes: `feat:`, `fix:`,
`chore:`, etc.

## Beads

The project uses [beads](https://github.com/beads-lang/beads) for issue
tracking (`.beads/` directory). See `CLAUDE.md` / `AGENTS.md` at the repo
root for the workflow; commands are under `bd ready`, `bd show`,
`bd create`, `bd close`.
