import { z } from 'zod';
import path from 'node:path';

export const baseEnvFields = {
  basePath: z.string(),
  production: z.boolean().default(false),
  watch: z.boolean().default(false),
  WEBPACK_WATCH: z.boolean().optional(),
};

type BaseEnvShape = {
  basePath: string;
  production: boolean;
  watch: boolean;
  WEBPACK_WATCH?: boolean;
};

export function applyEnvLogic<T extends BaseEnvShape>(o: T): T {
  return {
    ...o,
    basePath: path.posix.resolve(process.cwd(), o.basePath || ''),
    watch: Boolean(o.WEBPACK_WATCH || o.watch || false),
  };
}

export class WordPackEnv {
  basePath: string;
  production: boolean;
  watch: boolean;
  WEBPACK_WATCH?: boolean;

  get base(): string {
    return this.basePath;
  }

  get prod(): boolean {
    return this.production;
  }

  resolve(...paths: string[]): string {
    return path.posix.resolve(this.base, ...paths);
  }
}

export const WordPackEnvSchema = z
  .object(baseEnvFields)
  .transform(applyEnvLogic)
  .transform((data) => Object.assign(new WordPackEnv(), data));

export type WordPackEnvInterface = z.input<typeof WordPackEnvSchema>;
