import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
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
import { ApiStandardErrorResponses } from '@english-learning/nest-api-docs';
import { CurrentUserDecorator } from '../common/auth/current-user.decorator';
import { TrustedHeadersAuthGuard } from '../common/auth/trusted-headers-auth.guard';
import type { CurrentUser } from '../common/auth/current-user.interface';
import { CreateFileDto } from './dto/create-file.dto';
import {
  DownloadUrlResponseDto,
  FileListResponseDto,
  FileResponseDto,
  UploadSignatureResponseDto,
} from './dto/file-response.dto';
import { IngestRemoteAudioDto } from './dto/ingest-remote-audio.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import {
  DownloadUrlQueryDto,
  UploadSignatureDto,
} from './dto/upload-signature.dto';
import { FilesService } from './files.service';

@Controller('files')
@ApiTags('files')
@ApiBearerAuth()
@UseGuards(TrustedHeadersAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-signature')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create Cloudinary upload signature for direct upload',
  })
  @ApiBody({ type: UploadSignatureDto })
  @ApiOkResponse({ type: UploadSignatureResponseDto })
  @ApiStandardErrorResponses({ statuses: [400, 401, 422, 500] })
  createUploadSignature(@Body() dto: UploadSignatureDto) {
    return this.filesService.createUploadSignature(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Persist uploaded file metadata' })
  @ApiBody({ type: CreateFileDto })
  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiStandardErrorResponses({ statuses: [401, 409, 422, 500] })
  createFile(
    @Body() dto: CreateFileDto,
    @CurrentUserDecorator() user: CurrentUser,
  ) {
    return this.filesService.createFile(dto, user);
  }

  @Post('ingest-remote-audio')
  @ApiOperation({
    summary:
      'Fetch remote audio URL, upload to Cloudinary, and persist metadata',
  })
  @ApiBody({ type: IngestRemoteAudioDto })
  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiStandardErrorResponses({ statuses: [400, 401, 409, 422, 500] })
  ingestRemoteAudio(
    @Body() dto: IngestRemoteAudioDto,
    @CurrentUserDecorator() user: CurrentUser,
  ) {
    return this.filesService.ingestRemoteAudio(dto, user);
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
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  getDownloadUrl(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: DownloadUrlQueryDto,
  ) {
    return this.filesService.getDownloadUrl(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by id' })
  @ApiParam({ name: 'id', description: 'File id (UUID)' })
  @ApiOkResponse({ type: FileResponseDto })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  getFileById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.filesService.getFileById(id);
  }

  @Get()
  @ApiOperation({ summary: 'List file metadata with cursor pagination' })
  @ApiOkResponse({ type: FileListResponseDto })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  listFiles(@Query() query: ListFilesQueryDto) {
    return this.filesService.listFiles(query);
  }
}
