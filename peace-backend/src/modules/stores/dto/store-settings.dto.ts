import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @IsObject()
  settings!: Record<string, unknown>;
}

export class UpdateIntegrationsDto {
  @IsObject()
  integrations!: Record<string, Record<string, string>>;
}
