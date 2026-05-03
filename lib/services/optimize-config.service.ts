import * as path from 'node:path';
import { Configuration, Module, WebpackPluginInstance } from 'webpack';
import { BundleConfig, WordPackConfig } from '../config';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import {
  SharpEncodeOptions,
  SharpOptions,
  SvgoOptions,
} from 'image-minimizer-webpack-plugin/types/utils';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import merge from 'webpack-merge';

export function buildOptimizeConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Partial<Configuration> {
  return merge(
    getChunkConfig(cfg, bundle),
    getStyleConfig(cfg, bundle),
    getScriptConfig(cfg, bundle),
  );
}

export function chunkName(module: Module): string {
  const mpath = module.identifier().split('/node_modules/');
  const split = (mpath.pop() as string).split('/');
  const vendor = split.shift() as string;
  const ident = split.shift() as string;
  const parts: string[] = [vendor.replace('@', '')];

  if (module.identifier().startsWith('css|')) {
    return parts.join('');
  }

  parts.push(path.sep);
  parts.push(vendor.replace('@', ''));

  if (vendor.startsWith('@')) {
    parts.push('-');
    parts.push(ident);
  }

  return parts.join('');
}

export function chunkFilename(cfg: WordPackConfig): string {
  return `${cfg.scripts('dist')}/[name].js`;
}

function getChunkConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Partial<Configuration> {
  if (cfg.watch || !bundle.splitChunks) {
    return {};
  }

  return {
    optimization: {
      splitChunks: {
        hidePathInfo: true,
        cacheGroups: {
          vendor: {
            priority: 10,
            reuseExistingChunk: true,
            chunks: 'all',
            filename: () => chunkFilename(cfg),
            name: (m: Module) => chunkName(m),
            test: bundle.chunkTest,
            minChunks: 1,
            minSize: bundle.chunkMinSize,
          },
          default: false,
          defaultVendors: false,
        },
      },
    },
  };
}

function getStyleConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Partial<Configuration> {
  if (!cfg.prod || !bundle.hasStyles()) {
    return {};
  }

  return {
    optimization: {
      minimize: true,
      minimizer: [...getCssMinimizers(), ...getImageMinimizers(cfg.imageMin)],
    },
  };
}

function getScriptConfig(
  cfg: WordPackConfig,
  bundle: BundleConfig,
): Partial<Configuration> {
  if (!cfg.prod || !bundle.hasScripts()) {
    return {};
  }

  return {
    optimization: {
      minimize: true,
      minimizer: [...getJsMinimizers()],
    },
  };
}

export function getJsMinimizers(): WebpackPluginInstance[] {
  return [
    new TerserPlugin({
      extractComments: false,
      minify: TerserPlugin.swcMinify,
      terserOptions: {
        format: {
          comments: false,
          ascii_only: true,
        },
        compress: {
          drop_console: true,
        },
      },
    }),
  ];
}

export function getCssMinimizers(): WebpackPluginInstance[] {
  return [new CssMinimizerPlugin()];
}

export function getImageMinimizers(
  options: Partial<SharpEncodeOptions>,
): WebpackPluginInstance[] {
  return [
    new ImageMinimizerPlugin<SharpOptions>({
      exclude: /\.svg$/,
      minimizer: {
        implementation: ImageMinimizerPlugin.sharpMinify,
        options: {
          encodeOptions: merge(
            {
              jpeg: {
                progressive: true,
                trellisQuantisation: true,
                optimiseScans: true,
              },
              webp: {
                lossless: true,
              },
              avif: {
                lossless: true,
              },
              png: {
                compressionLevel: 8,
                adaptiveFiltering: true,
              },
              gif: {},
            },
            options,
          ),
        },
      },
    }),
    new ImageMinimizerPlugin<SvgoOptions>({
      include: /\.svg$/,
      minimizer: {
        implementation: ImageMinimizerPlugin.svgoMinify,
        options: {
          encodeOptions: {
            multipass: true,
            plugins: ['preset-default'],
          },
        },
      },
    }),
  ];
}
