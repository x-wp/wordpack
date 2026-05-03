import WebpackAssetsManifest, { Entry } from 'webpack-assets-manifest';
import * as path from 'node:path';
import { writeFileSync } from 'node:fs';

export function manifestEntryFormatter({ key, value }: Entry): Entry | false {
  key = `${path.dirname(value)}/${path.basename(key)}`;

  return { key, value };
}

export function manifestFileWriter(mfs: WebpackAssetsManifest): void {
  const tmpl = `<?php
/**
 * Asset manifest file.
 *
 * Auto-generated via WordPack.
 *
 * @package eXtended WordPress
 * @subpackage Assets
 */

return array(
{{{entries}}}
);
`;
  const assets = Object.keys(mfs.assets).sort();
  const length = findLongest(assets);
  const entries = assets.map((k) => parseEntry(k, mfs.assets[k], length));

  const content = tmpl.replace('{{{entries}}}', entries.join('\n'));

  writeFileSync(mfs.getOutputPath().replace('.json', '.php'), content);
}

function findLongest(entries: string[]): number {
  return entries.reduce((l, k) => Math.max(l, k.length), 0);
}

function parseEntry(key: string, val: unknown, length: number): string {
  return `    '${key}'${' '.repeat(length - key.length)} => '${val}',`;
}
