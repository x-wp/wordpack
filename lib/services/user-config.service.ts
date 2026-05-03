import { WordPackConfig, WordPackEnv } from '../config';
import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { transformAndValidateSync } from 'class-transformer-validator';
import { WebpackError } from 'webpack';
import { instanceToPlain } from 'class-transformer';
export class UserConfig {
  static env(webpackEnv: Record<string, string> | WordPackEnv): WordPackEnv {
    return transformAndValidateSync(WordPackEnv, webpackEnv, {
      transformer: {
        excludeExtraneousValues: true,
      },
    }) as WordPackEnv;
  }

  static async load(
    cfgPath: string,
    env: WordPackEnv,
  ): Promise<WordPackConfig> {
    cfgPath = existsSync(path.posix.resolve(env.base, cfgPath))
      ? path.posix.resolve(env.base, cfgPath)
      : UserConfig.findFile(env.base, cfgPath);

    const config = await UserConfig.readFile(cfgPath, env);

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
      const configOpts = (await import(cfgPath)).default;
      const configObj = { ...configOpts, ...instanceToPlain(env) };

      return transformAndValidateSync(
        WordPackConfig,
        configObj,
      ) as WordPackConfig;
    } catch (e) {
      const detail =
        e instanceof Error
          ? e.stack ?? e.message
          : JSON.stringify(e, null, 2);
      throw new WebpackError(
        `Error parsing configuration file ${cfgPath}:\n${detail}`,
      );
    }
  }
}
