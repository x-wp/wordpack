import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import { mkdirSync, rmSync } from 'node:fs';
import { Assets } from 'webpack-assets-manifest';
import { WordPackEnv } from '../config';
import { buildAssetConfig } from '../services/asset-config.service';
import { buildCompileConfig } from '../services/compile-config.service';
import { buildEntryConfig } from '../services/entry-config.service';
import { buildManifestConfig } from '../services/manifest-config.service';
import { buildOptimizeConfig } from '../services/optimize-config.service';
import { buildSharedConfig } from '../services/shared-config.service';
import { loadUserConfig, parseUserEnv } from '../services/user-config.service';

export async function buildConfig(
  webpackEnv: Record<string, string> | WordPackEnv,
  wpwpConfig: string = 'wpwp.config.ts',
): Promise<Configuration[]> {
  try {
    const res: Configuration[] = [];
    const env = parseUserEnv(webpackEnv);
    const cfg = await loadUserConfig(wpwpConfig, env);
    const sharedAssets: Assets = Object.create(null);

    cfg.bundles.forEach((bundle) =>
      res.push(
        merge(
          buildSharedConfig(cfg),
          buildManifestConfig(cfg, sharedAssets),
          buildEntryConfig(cfg, bundle),
          buildCompileConfig(cfg, bundle),
          buildOptimizeConfig(cfg, bundle),
          cfg.override,
          bundle.override,
        ),
      ),
    );

    res.push(buildAssetConfig(cfg, sharedAssets));

    const distDir = cfg.path('dist', 'root');
    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });

    return res;
  } catch (e) {
    return Promise.reject(e);
  }
}
