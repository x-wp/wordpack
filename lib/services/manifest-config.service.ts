import { Configuration, WebpackPluginInstance } from 'webpack';
import WebpackAssetsManifest, {
  Assets,
  Options,
} from 'webpack-assets-manifest';
import { manifestEntryFormatter } from '../functions/manifest-utils';
import { WordPackConfig } from '../config';

export function buildManifestConfig(
  cfg: WordPackConfig,
  sharedAssets: Assets,
): Configuration {
  if (!cfg.manifest) {
    return {};
  }

  return {
    plugins: [
      getManifestPlugin({
        output: cfg.manifest,
        assets: sharedAssets,
      }),
    ],
  };
}

export function getManifestPlugin(
  options: Options = {},
): WebpackPluginInstance {
  const defs: Options = {
    output: 'assets.json',
    space: 2,
    merge: true,
    sortManifest: true,
    writeToDisk: false,
    customize: manifestEntryFormatter,
  };

  return new WebpackAssetsManifest({ ...defs, ...options });
}
