import { Configuration } from 'webpack';
import { existsSync } from 'node:fs';
import CopyPlugin from 'copy-webpack-plugin';
import merge from 'webpack-merge';
import WebpackBarPlugin from 'webpackbar';
import { Assets } from 'webpack-assets-manifest';
import { WordPackConfig } from '../config';
import { getImageMinimizers } from './optimize-config.service';
import { getManifestPlugin } from './manifest-config.service';
import { manifestFileWriter } from '../functions/manifest-utils';

export function buildAssetConfig(
  cfg: WordPackConfig,
  sharedAssets: Assets,
): Partial<Configuration> {
  return merge(
    getCoreConfig(cfg),
    getManifestConfig(cfg, sharedAssets),
    getOptimizeConfig(cfg),
  );
}

function getCoreConfig(cfg: WordPackConfig): Configuration {
  return {
    name: 'AssetCopy',
    context: cfg.path('src', 'root'),
    mode: cfg.mode,
    entry: {},
    output: {
      path: cfg.path('dist', 'root'),
    },
    stats: false,
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: `${cfg.images('src')}/`,
            to: `${cfg.images('dist')}/[path]${cfg.imagename}[ext]`,
            force: false,
            noErrorOnMissing: false,
            toType: 'template',
            filter: (rp) => filterAssets(cfg, rp),
          },
        ],
      }),
      new WebpackBarPlugin({
        fancy: !cfg.isCI,
        basic: cfg.isCI,
        name: 'AssetCopy',
      }),
    ],
    dependencies: cfg.bundles.map(({ name }) => name),
  };
}

function filterAssets(cfg: WordPackConfig, rp: string): boolean {
  return !existsSync(
    rp
      .replace(cfg.root('src'), cfg.root('dist'))
      .replace(cfg.images('src'), cfg.images('dist')),
  );
}

function getOptimizeConfig(cfg: WordPackConfig): Configuration {
  if (!cfg.prod) {
    return {};
  }

  return {
    optimization: {
      minimize: true,
      minimizer: getImageMinimizers(cfg.imageMin),
    },
  };
}

function getManifestConfig(
  cfg: WordPackConfig,
  sharedAssets: Assets,
): Configuration {
  if (!cfg.manifest) {
    return {};
  }
  return {
    plugins: [
      getManifestPlugin({
        output: cfg.manifest,
        assets: sharedAssets,
        writeToDisk: true,
        done: manifestFileWriter,
      }),
    ],
  };
}
