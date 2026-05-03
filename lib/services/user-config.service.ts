import {
  WordPackConfig,
  WordPackConfigSchema,
  WordPackEnv,
  WordPackEnvSchema,
} from '../config';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { WebpackError } from 'webpack';
import { z } from 'zod';
import { require as tsxRequire } from 'tsx/cjs/api';

export class UserConfig {
  static env(webpackEnv: Record<string, string> | WordPackEnv): WordPackEnv {
    return WordPackEnvSchema.parse(webpackEnv);
  }

  static async load(
    cfgPath: string,
    env: WordPackEnv,
  ): Promise<WordPackConfig> {
    cfgPath = existsSync(path.posix.resolve(env.base, cfgPath))
      ? path.posix.resolve(env.base, cfgPath)
      : UserConfig.findFile(env.base, cfgPath);

    const config = await UserConfig.readFile(cfgPath, env);
    config.cfgPath = cfgPath;

    if (env.production) {
      config.sourceMaps = false;
    }

    return config;
  }

  private static findFile(rootDir: string, cfgPath: string): string {
    const cfgName = path.posix.basename(cfgPath);
    const cfgLocs = this.possiblePaths(rootDir, cfgName);
    const cfgFile = cfgLocs.find((p) => existsSync(p));

    if (!cfgFile) {
      throw new WebpackError(`Cannot find configuration file ${cfgName}`);
    }

    return cfgFile;
  }

  private static possiblePaths(rootDir: string, cfgName: string): string[] {
    const dirs = [
      '',
      'assets',
      'assets/wordpack',
      'assets/webpack',
      'assets/build',
    ];

    return dirs.map((d) => path.posix.resolve(rootDir, d, cfgName));
  }

  private static async readFile(
    cfgPath: string,
    env: WordPackEnv,
  ): Promise<WordPackConfig> {
    try {
      const mod = tsxRequire(cfgPath, __filename) as
        | { default?: Record<string, unknown>; __esModule?: boolean }
        | Record<string, unknown>
        | undefined;
      const configOpts = (
        mod && '__esModule' in mod && mod.__esModule ? mod.default : mod
      ) as Record<string, unknown>;
      const configObj = {
        ...configOpts,
        basePath: env.basePath,
        production: env.production,
        watch: env.watch,
        WEBPACK_WATCH: env.WEBPACK_WATCH,
      };

      return WordPackConfigSchema.parse(configObj);
    } catch (e) {
      const detail =
        e instanceof z.ZodError
          ? z.prettifyError(e)
          : e instanceof Error
            ? e.stack ?? e.message
            : JSON.stringify(e, null, 2);
      throw new WebpackError(
        `Error parsing configuration file ${cfgPath}:\n${detail}`,
      );
    }
  }
}
