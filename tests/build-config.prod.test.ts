import { describe, expect, it } from 'vitest';
import buildConfig from '../lib';
import { normalize } from './utils/normalize';

describe('buildConfig — production', () => {
  it('matches snapshot', async () => {
    const configs = await buildConfig({
      basePath: './test',
      production: true,
    } as unknown as Record<string, string>);

    expect(configs).toHaveLength(2);
    expect(normalize(configs)).toMatchSnapshot();
  });
});
