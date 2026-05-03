import { Configuration, PathData } from 'webpack';
import merge from 'webpack-merge';
import { BundleConfig, WordPackConfig } from '../config';
import WebpackRemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssUrlRelativePlugin from 'css-url-relative-plugin';
import { Options } from 'sass';

export class CompileConfig {
  static build(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Partial<Configuration> {
    return merge(
      this.getJsConfig(cfg, bundle),
      this.getCssConfig(cfg, bundle),
      this.getNoScriptConfig(bundle),
    );
  }

  private static getJsConfig(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Configuration {
    if (!bundle.hasScripts()) {
      return {};
    }

    return {
      module: {
        rules: [
          {
            test: /\.[tj]sx?$/,
            include: [cfg.path('src', 'scripts')],
            exclude: [/node_modules(?![/|\\](bootstrap|foundation-sites))/],
            use: {
              loader: 'swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                    decorators: true,
                  },
                  transform: {
                    legacyDecorator: true,
                    decoratorMetadata: true,
                  },
                  target: 'es2017',
                },
              },
            },
          },
        ],
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
      },
    };
  }

  private static getCssConfig(
    cfg: WordPackConfig,
    bundle: BundleConfig,
  ): Configuration {
    if (!bundle.hasStyles()) {
      return {};
    }

    return {
      module: {
        rules: [
          {
            test: /\.(sa|sc|c)ss$/i,
            include: cfg.path('src', 'styles'),
            use: [
              {
                loader: MiniCssExtractPlugin.loader,
              },
              {
                loader: 'css-loader',
                options: {
                  importLoaders: 1,
                  sourceMap: true,
                },
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: ['postcss-preset-env'],
                  },
                  sourceMap: true,
                },
              },
              {
                loader: 'resolve-url-loader',
                options: {
                  sourceMap: true,
                },
              },
              {
                loader: 'sass-loader',
                options: {
                  api: 'modern-compiler',
                  sourceMap: true,
                  sassOptions: {
                    outputStyle: 'expanded',
                    quietDeps: true,
                  } as Options<'sync'>,
                },
              },
            ],
          },
          {
            test: /\.(png|svg|jpg|jpeg|gif|ico|avif)$/i,
            type: 'asset/resource',
            generator: {
              filename: `${cfg.images('dist')}/${cfg.imagename}[ext]`,
            },
          },
          {
            test: /\.(ttf|otf|eot|woff2?)$/,
            type: 'asset/resource',
            generator: {
              filename: `${cfg.fonts('dist')}/${cfg.fontname}[ext]`,
            },
          },
        ],
      },
      resolve: {
        extensions: ['.scss', '.css'],
      },
      plugins: [
        new MiniCssExtractPlugin({
          filename: ({ chunk }: PathData) =>
            this.cssName(chunk?.name, bundle, cfg),
        }),
        new CssUrlRelativePlugin(),
      ],
    };
  }

  private static getNoScriptConfig(bundle: BundleConfig): Configuration {
    if (bundle.hasScripts() && !bundle.hasStyles()) {
      return {};
    }

    return {
      plugins: [new WebpackRemoveEmptyScriptsPlugin()],
    };
  }

  static cssName(
    chunkId: string | undefined,
    { name, entry }: BundleConfig,
    cfg: WordPackConfig,
  ): string {
    const dir = Object.keys(entry).includes(chunkId || '') ? name : 'vendor';

    return `${cfg.styles('dist')}/${dir}/${cfg.asset}.css`;
  }
}
