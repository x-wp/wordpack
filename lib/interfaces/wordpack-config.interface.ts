import { SharpEncodeOptions } from 'image-minimizer-webpack-plugin/types/utils';
import { PathConfig } from '../config/dir.config';
import { BundleConfigInterface } from './bundle-config.interface';

export interface WordPackConfigInterface {
  paths?: Partial<PathConfig>;
  manifest?: string;
  filename?: string;
  imagename?: string;
  fontname?: string;
  bundles: BundleConfigInterface[];
  externals?: Record<string, string>;
  sourceMaps?: string | false;
  imageMin?: Partial<SharpEncodeOptions>;
}
