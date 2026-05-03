import type { Configuration } from 'webpack';

export interface BundleConfigInterface {
  name: string;
  files: string[];
  splitChunks?: boolean;
  chunkTest?: RegExp;
  chunkMinSize?: number;
  override?: Partial<Configuration>;
  color?: string;
}
