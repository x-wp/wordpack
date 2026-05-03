import FriendlyErrorsWebpackPlugin from '@x-wp/friendly-errors-webpack-plugin';
import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import { WordPackConfig } from '../config';

export class SharedConfig {
  private static sharedCfg: Configuration;
  static build(cfg: WordPackConfig): Configuration {
    return (this.sharedCfg ??= merge(
      SharedConfig.getCoreConfig(cfg),
      SharedConfig.getCacheConfig(cfg),
      SharedConfig.getWatchConfig(cfg),
      SharedConfig.getProdConfig(cfg),
    ));
  }
  private static getCoreConfig(cfg: WordPackConfig): Configuration {
    return {
      devtool: cfg.sourceMaps,
      context: cfg.path('src', 'root'),
      externalsType: 'window',
      externals: cfg.externals,
      mode: 'development',
      target: 'web',

      stats: false,
      optimization: {
        removeEmptyChunks: true,
      },
      plugins: [
        new FriendlyErrorsWebpackPlugin({
          clearConsole: false,
          silentSuccess: true,
        }),
      ],
    };
  }

  private static getCacheConfig(cfg: WordPackConfig): Configuration {
    if (cfg.prod) {
      return {};
    }

    return {
      cache: {
        type: 'filesystem',
        buildDependencies: cfg.cfgPath ? { config: [cfg.cfgPath] } : {},
      },
    };
  }

  private static getWatchConfig(cfg: WordPackConfig): Configuration {
    if (!cfg.watch) {
      return {};
    }

    return {
      watch: true,
      watchOptions: {
        ignored: /node_modules/,
        aggregateTimeout: 600,
        poll: 1000,
      },
    };
  }

  private static getProdConfig(cfg: WordPackConfig): Configuration {
    if (!cfg.prod) {
      return {};
    }

    return {
      devtool: false,
      mode: 'production',
      optimization: {
        minimize: true,
      },
    };
  }
}
