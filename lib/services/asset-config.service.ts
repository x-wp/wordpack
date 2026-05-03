import { Configuration } from 'webpack';
import { WordPackConfig } from '../config';
import { existsSync } from 'node:fs';
import CopyPlugin from 'copy-webpack-plugin';
import merge from 'webpack-merge';
import { OptimizeConfig } from './optimize-config.service';
import { ManifestConfig } from './manifest-config.service';
import { manifestFileWriter } from '../functions/manifest-utils';
import WebpackBarPlugin from 'webpackbar';

export class AssetConfig {
  static build(cfg: WordPackConfig): Partial<Configuration> {
    return merge(
      AssetConfig.getCoreConfig(cfg),
      AssetConfig.getManifestConfig(cfg),
      AssetConfig.getOptimizeConfig(cfg),
    );
  }

  private static getCoreConfig(cfg: WordPackConfig): Configuration {
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
              filter: (rp) => this.filterAssets(cfg, rp),
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

  static filterAssets(cfg: WordPackConfig, rp: string): boolean {
    return !existsSync(
      rp
        .replace(cfg.root('src'), cfg.root('dist'))
        .replace(cfg.images('src'), cfg.images('dist')),
    );
  }

  private static getOptimizeConfig(cfg: WordPackConfig): Configuration {
    if (!cfg.prod) {
      return {};
    }

    return {
      optimization: {
        minimize: true,
        minimizer: OptimizeConfig.getImageMinimizers(cfg.imageMin),
      },
    };
  }

  private static getManifestConfig(cfg: WordPackConfig): Configuration {
    if (!cfg.manifest) {
      return {};
    }
    return {
      plugins: [
        ManifestConfig.getManifestPlugin({
          output: cfg.manifest,
          writeToDisk: true,
          done: manifestFileWriter,
        }),
      ],
    };
  }
}
