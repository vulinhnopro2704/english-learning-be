import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiCursorPaginatedResponse,
  ApiCreatedEntityResponse,
  ApiMessageResponse,
  ApiOkEntityResponse,
  ApiStandardErrorResponses,
} from '@english-learning/nest-api-docs';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserFilterDto } from './dtos/user-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with optional filters' })
  @ApiCursorPaginatedResponse({
    description: 'Paginated list of users',
    itemType: UserResponseDto,
    includeTotal: true,
  })
  @ApiStandardErrorResponses({ statuses: [401, 422, 500] })
  findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEntityResponse({ type: UserResponseDto, description: 'User found' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedEntityResponse({
    type: UserResponseDto,
    description: 'User created',
  })
  @ApiStandardErrorResponses({ statuses: [401, 409, 422, 500] })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkEntityResponse({ type: UserResponseDto, description: 'User updated' })
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiMessageResponse('User deleted')
  @ApiStandardErrorResponses({ statuses: [401, 404, 422, 500] })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.remove(id);
  }
}
