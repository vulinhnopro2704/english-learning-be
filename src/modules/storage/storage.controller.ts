import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser } from '../../common/types/api.types';
import { CreateFileDto } from './dtos/create-file.dto';
import {
  DownloadUrlResponseDto,
  FileListResponseDto,
  FileResponseDto,
  UploadSignatureResponseDto,
} from './dtos/file-response.dto';
import { IngestRemoteAudioDto } from './dtos/ingest-remote-audio.dto';
import { IngestBase64AudioDto } from './dtos/ingest-base64-audio.dto';
import { ListFilesQueryDto } from './dtos/list-files-query.dto';
import {
  DownloadUrlQueryDto,
  UploadSignatureDto,
} from './dtos/upload-signature.dto';
import { StorageService } from './storage.service';

@Controller('files')
@ApiTags('Files & Storage')
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-signature')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create Cloudinary upload signature for direct upload',
  })
  @ApiBody({ type: UploadSignatureDto })
  @ApiOkResponse({ type: UploadSignatureResponseDto })
  createUploadSignature(@Body() dto: UploadSignatureDto) {
    return this.storageService.createUploadSignature(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Persist uploaded file metadata' })
  @ApiBody({ type: CreateFileDto })
  @ApiCreatedResponse({ type: FileResponseDto })
  createFile(
    @Body() dto: CreateFileDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.storageService.createFile(dto, user);
  }

  @Post('ingest-remote-audio')
  @ApiOperation({
    summary:
      'Fetch remote audio URL, upload to Cloudinary, and persist metadata',
  })
  @ApiBody({ type: IngestRemoteAudioDto })
  @ApiCreatedResponse({ type: FileResponseDto })
  ingestRemoteAudio(
    @Body() dto: IngestRemoteAudioDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.storageService.ingestRemoteAudio(dto, user);
  }

  @Post('ingest-base64')
  @ApiOperation({
    summary: 'Upload base64 audio to Cloudinary and persist metadata',
  })
  @ApiBody({ type: IngestBase64AudioDto })
  @ApiCreatedResponse({ type: FileResponseDto })
  ingestBase64Audio(
    @Body() dto: IngestBase64AudioDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.storageService.ingestBase64Audio(dto, user);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Generate signed download URL' })
  @ApiParam({ name: 'id', description: 'File id (UUID)' })
  @ApiQuery({
    name: 'expiresInSeconds',
    required: false,
    description: 'Optional signed URL ttl in seconds (60..3600)',
  })
  @ApiOkResponse({ type: DownloadUrlResponseDto })
  getDownloadUrl(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DownloadUrlQueryDto,
  ) {
    return this.storageService.getDownloadUrl(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by id' })
  @ApiParam({ name: 'id', description: 'File id (UUID)' })
  @ApiOkResponse({ type: FileResponseDto })
  getFileById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.storageService.getFileById(id);
  }

  @Get()
  @ApiOperation({ summary: 'List file metadata with cursor pagination' })
  @ApiOkResponse({ type: FileListResponseDto })
  listFiles(@Query() query: ListFilesQueryDto) {
    return this.storageService.listFiles(query);
  }
}
