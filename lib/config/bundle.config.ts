import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsInstance,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import type { Configuration } from 'webpack';
import * as path from 'node:path';

export class BundleConfig {
  @IsString()
  name!: string;

  @IsString({ each: true })
  files!: string[];

  @IsBoolean()
  splitChunks: boolean = true;

  @IsOptional()
  @IsInstance(RegExp)
  @Type(() => RegExp)
  @ValidateIf((o: BundleConfig) => o.splitChunks === true)
  chunkTest: RegExp = /[\\/]node_modules[\\/]/;

  @Min(10)
  @IsPositive()
  @IsInt()
  @ValidateIf((o: BundleConfig) => o.splitChunks === true)
  chunkMinSize: number = 5000;

  @IsHexColor()
  @IsOptional()
  color?: string;

  @IsObject()
  @IsOptional()
  override: Partial<Configuration> = {};

  hasStyles(): boolean {
    return this.files.some((f) => f.match(/\.s?css$/i));
  }

  hasScripts(): boolean {
    return this.files.some((f) => f.match(/(\.[tj]sx?)$/i));
  }

  get entry(): Record<string, string[]> {
    return this.files.reduce(
      (obj, file) => {
        const base = path.basename(file, path.extname(file));
        obj[base] ??= [];
        obj[base].push(file);

        return obj;
      },
      {} as Record<string, string[]>,
    );
  }
}
