import { describe, expect, it } from 'vitest';
import buildConfig from '../lib';
import { normalize } from './utils/normalize';

describe('buildConfig — development', () => {
  it('matches snapshot', async () => {
    const configs = await buildConfig({ basePath: './test' });

    expect(configs).toHaveLength(2);
    expect(normalize(configs)).toMatchSnapshot();
  });
});
