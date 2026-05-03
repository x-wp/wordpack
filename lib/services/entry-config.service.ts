import { Configuration } from 'webpack';
import { BundleConfig, WordPackConfig } from '../config';
import merge from 'webpack-merge';
import WebpackBarPlugin from 'webpackbar';
import { stringToColor } from './colorizer.service';

const toCamel = (s: string): string =>
  s.replace(/[-_\s.]+(.)?/g, (_, c: string | undefined) =>
    c ? c.toUpperCase() : '',
  );

export function buildEntryConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Configuration {
  return merge(getCoreConfig(cfg, bundle), getBarConfig(cfg, bundle));
}

function getCoreConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Configuration {
  return {
    name: bundle.name,
    entry: bundle.entry,
    output: {
      path: cfg.path('dist', 'root'),
      publicPath: '',
      filename: `${cfg.scripts('dist')}/${bundle.name}/${cfg.asset}.js`,
    },
    optimization: {
      moduleIds: 'deterministic',
    },
  };
}

function getBarConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Configuration {
  return {
    plugins: [
      new WebpackBarPlugin({
        name: toCamel(bundle.name),
        fancy: !cfg.isCI,
        basic: cfg.isCI,
        color: bundle.color || stringToColor(bundle.name),
      }),
    ],
  };
}
