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

export class OptimizeConfig {
  private static imageMin: WebpackPluginInstance[];
  private static cssMin: WebpackPluginInstance[];
  private static jsMin: WebpackPluginInstance[];

  static build(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Partial<Configuration> {
    return merge(
      this.getChunkConfig(cfg, bundle),
      this.getStyleConfig(cfg, bundle),
      this.getScriptConfig(cfg, bundle),
    );
  }

  static chunkName(module: Module): string {
    const mpath = module.identifier().split('/node_modules/');
    const split = (mpath.pop() as string).split('/');
    const vendor = split.shift() as string;
    const ident = split.shift() as string;
    const parts: string[] = [vendor.replace('@', '')];

    if (module.identifier().startsWith('css|')) {
      return parts.join('');
    }

    // parts.push('../');
    parts.push(path.sep);
    parts.push(vendor.replace('@', ''));

    if (vendor.startsWith('@')) {
      parts.push('-');
      parts.push(ident);
    }

    return parts.join('');
  }

  static chunkFilename(cfg: WordPackConfig): string {
    return `${cfg.scripts('dist')}/[name].js`;
  }

  private static getChunkConfig(
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
              filename: () => OptimizeConfig.chunkFilename(cfg),
              name: (m: Module) => OptimizeConfig.chunkName(m),
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

  private static getStyleConfig(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Partial<Configuration> {
    if (!cfg.prod || !bundle.hasStyles()) {
      return {};
    }

    return {
      optimization: {
        minimize: true,
        minimizer: [
          ...this.getCssMinimizers(),
          ...this.getImageMinimizers(cfg.imageMin),
        ],
      },
    };
  }

  private static getScriptConfig(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Partial<Configuration> {
    if (!cfg.prod || !bundle.hasScripts()) {
      return {};
    }

    return {
      optimization: {
        minimize: true,
        minimizer: [...this.getJsMinimizers()],
      },
    };
  }

  static getJsMinimizers(): WebpackPluginInstance[] {
    return (this.jsMin ??= [
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
    ]);
  }

  static getCssMinimizers(): WebpackPluginInstance[] {
    return (this.cssMin ??= [new CssMinimizerPlugin()]);
  }

  static getImageMinimizers(
    options: Partial<SharpEncodeOptions>,
  ): WebpackPluginInstance[] {
    return (this.imageMin ??= [
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
    ]);
  }
}
