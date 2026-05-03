import type { WordPackConfigInterface, BundleConfigInterface } from './config';
import { buildConfig } from './functions';

export type {
  WordPackConfigInterface as WordPackConfig,
  BundleConfigInterface as BundleConfig,
};
export default buildConfig;
