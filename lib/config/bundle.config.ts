import { z } from 'zod';
import type { Configuration } from 'webpack';
import * as path from 'node:path';

export class BundleConfig {
  name: string;
  files: string[];
  splitChunks: boolean;
  chunkTest: RegExp;
  chunkMinSize: number;
  color?: string;
  override: Partial<Configuration>;

  hasStyles(): boolean {
    return this.files.some((f) => f.match(/\.s?css$/i));
  }

  hasScripts(): boolean {
    return this.files.some((f) => f.match(/(\.[tj]sx?)$/i));
  }

  get entry(): Record<string, string[]> {
    return this.files.reduce(
      (obj, file) => {
        const base = path.basename(file, path.extname(file));
        obj[base] ??= [];
        obj[base].push(file);

        return obj;
      },
      {} as Record<string, string[]>,
    );
  }
}

export const BundleConfigSchema = z
  .object({
    name: z.string(),
    files: z.array(z.string()),
    splitChunks: z.boolean().default(true),
    chunkTest: z.instanceof(RegExp).default(/[\\/]node_modules[\\/]/),
    chunkMinSize: z.number().int().min(10).positive().default(5000),
    color: z
      .string()
      .regex(/^#([0-9a-f]{3}){1,2}$/i, 'must be a hex color')
      .optional(),
    override: z.record(z.string(), z.unknown()).default({}),
  })
  .transform((data) => Object.assign(new BundleConfig(), data));

export type BundleConfigInterface = z.input<typeof BundleConfigSchema>;
