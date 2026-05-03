import { z } from 'zod';
import {
  Configuration,
  ExternalItemFunctionData,
  ExternalItemObjectKnown,
  ExternalItemObjectUnknown,
  ExternalItemValue,
} from 'webpack';
import { SharpEncodeOptions } from 'image-minimizer-webpack-plugin/types/utils';
import {
  WordPackEnv,
  baseEnvFields,
  applyEnvLogic,
} from './wordpack-env';
import { BundleConfig, BundleConfigSchema } from './bundle.config';
import { DirMap, PathConfig, PathConfigSchema } from './dir.config';

type ExternalItem =
  | string
  | RegExp
  | (ExternalItemObjectKnown & ExternalItemObjectUnknown)
  | ((
      data: ExternalItemFunctionData,
      callback: (
        err?: null | Error,
        result?: string | boolean | string[] | { [index: string]: any },
      ) => void,
    ) => void)
  | ((data: ExternalItemFunctionData) => Promise<ExternalItemValue>);

type ExternalsType =
  | string
  | RegExp
  | ExternalItem[]
  | (ExternalItemObjectKnown & ExternalItemObjectUnknown)
  | ((
      data: ExternalItemFunctionData,
      callback: (
        err?: null | Error,
        result?: string | boolean | string[] | { [index: string]: any },
      ) => void,
    ) => void)
  | ((data: ExternalItemFunctionData) => Promise<ExternalItemValue>);

type DirType = keyof DirMap;

const SOURCE_MAP_VALUES = [
  'eval',
  'eval-cheap-source-map',
  'eval-cheap-module-source-map',
  'eval-source-map',
  'cheap-source-map',
  'cheap-module-source-map',
  'source-map',
] as const;

const stripExt = (v: string) => v.replace('[ext]', '');

export class WordPackConfig extends WordPackEnv {
  imagename: string;
  fontname: string;
  filename: string;
  manifest: string;
  bundles: BundleConfig[];
  externals: ExternalsType;
  paths: PathConfig;
  sourceMaps: string | false;
  override: Partial<Configuration>;
  imageMin: Partial<SharpEncodeOptions>;
  cfgPath: string = '';

  root(which: DirType): string {
    return this.dir(which, 'root');
  }

  images(which: DirType): string {
    return this.dir(which, 'images');
  }

  scripts(which: DirType): string {
    return this.dir(which, 'scripts');
  }

  styles(which: DirType): string {
    return this.dir(which, 'styles');
  }

  fonts(which: DirType): string {
    return this.dir(which, 'fonts');
  }

  path(which: DirType, dir: keyof PathConfig): string {
    return dir === 'root'
      ? this.resolve(this.dir(which, 'root'))
      : this.resolve(this.dir(which, 'root'), this.dir(which, dir));
  }

  dir(which: DirType, dir: keyof PathConfig): string {
    if (typeof this.paths[dir] === 'string') {
      return this.paths[dir] as string;
    }

    return (this.paths[dir] as DirMap)[which];
  }

  get mode(): 'production' | 'development' {
    return this.prod ? 'production' : 'development';
  }

  get asset(): string {
    return this.prod ? this.filename : '[name]';
  }

  get isCI(): boolean {
    return process.env.CI !== undefined;
  }
}

export const WordPackConfigSchema = z
  .object({
    ...baseEnvFields,
    imagename: z.string().default('[name]').transform(stripExt),
    fontname: z.string().default('[name]').transform(stripExt),
    filename: z
      .string()
      .default('[name].[contenthash:6]')
      .transform(stripExt),
    manifest: z.string().default('assets.json'),
    bundles: z.array(BundleConfigSchema),
    externals: z
      .custom<ExternalsType>((v) => v !== undefined && v !== null, {
        message: 'externals must not be empty',
      })
      .default([
        {
          jquery: 'jQuery',
          underscore: '_',
          backbone: 'backbone',
          lodash: '_',
        },
      ]),
    paths: PathConfigSchema.prefault({}),
    sourceMaps: z
      .union([z.literal(false), z.enum(SOURCE_MAP_VALUES)])
      .default('eval-cheap-source-map'),
    override: z.record(z.string(), z.unknown()).default({}),
    imageMin: z.record(z.string(), z.unknown()).default({}),
  })
  .transform(applyEnvLogic)
  .transform((data) => Object.assign(new WordPackConfig(), data));

export type WordPackConfigInterface = z.input<typeof WordPackConfigSchema>;
