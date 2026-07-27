import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { MediaService, MEDIA_FOLDERS } from './media.service';
import type { MediaFolder, UploadFile } from './media.service';

const UPLOAD_LIMIT = 64 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'STAFF')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMIT } }))
  async upload(
    @UploadedFile() file: UploadFile,
    @Query('folder') folder: MediaFolder,
    @Query('entityId') entityId?: string,
  ) {
    if (!MEDIA_FOLDERS.includes(folder)) throw new BadRequestException('Invalid folder');
    return this.media.upload(folder, file, entityId);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'STAFF')
  @Delete()
  async remove(@Body('key') key: string) {
    await this.media.remove(key);
    return { deleted: true };
  }
}
