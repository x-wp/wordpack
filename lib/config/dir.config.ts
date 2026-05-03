import { z } from 'zod';

export const DirMapSchema = z.object({
  src: z.string(),
  dist: z.string(),
});

export type DirMap = z.infer<typeof DirMapSchema>;

const dirOrString = (def: string | DirMap) =>
  z.union([DirMapSchema, z.string()]).default(def);

export const PathConfigSchema = z.object({
  root: dirOrString({ src: 'assets', dist: 'dist' }),
  scripts: dirOrString('scripts'),
  styles: dirOrString('styles'),
  images: dirOrString('images'),
  fonts: dirOrString('fonts'),
});

export type PathConfig = z.infer<typeof PathConfigSchema>;
