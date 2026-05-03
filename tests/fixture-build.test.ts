import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import webpack, { Stats } from 'webpack';
import buildConfig from '../lib';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'test');

function runWebpack(configs: Parameters<typeof webpack>[0]): Promise<Stats> {
  return new Promise((resolve, reject) => {
    webpack(configs, (err, stats) => {
      if (err) return reject(err);
      if (!stats) return reject(new Error('webpack returned no stats'));
      if (stats.hasErrors()) {
        return reject(new Error(stats.toString({ errors: true, all: false })));
      }
      resolve(stats);
    });
  });
}

describe('fixture build', () => {
  it('produces a stable assets.json manifest', async () => {
    const configs = await buildConfig({ basePath: FIXTURE_ROOT });
    await runWebpack(configs);

    const manifestPath = path.join(FIXTURE_ROOT, 'dist', 'assets.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest).toMatchSnapshot();
  });
});
