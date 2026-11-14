import { Injectable, HttpStatus } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { uuidv7 } from 'uuidv7';
import { PrismaService } from '../../database/prisma.service';
import { ApiException } from '../../common/exceptions/api.exception';
import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dtos';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  phoneNumber: true,
  gender: true,
  hobbies: true,
  funFact: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: UserFilterDto) {
    const take = filter.take ?? 20;
    const where: any = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.role) {
      where.role = filter.role;
    }

    const findManyArgs: any = {
      where,
      take: take + 1,
      orderBy: { id: 'asc' },
      select: USER_SELECT,
    };

    if (filter.cursor) {
      findManyArgs.cursor = { id: filter.cursor };
      findManyArgs.skip = 1;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany(findManyArgs),
      this.prisma.user.count({ where }),
    ]);

    const hasMore = users.length > take;
    const data = hasMore ? users.slice(0, take) : users;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        total,
        limit: take,
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new ApiException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'USER_NOT_FOUND',
        message: `User with ID '${id}' not found`,
      });
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiException({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'EMAIL_ALREADY_EXISTS',
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        id: uuidv7(),
        email,
        password: hashedPassword,
        name: dto.name?.trim() || null,
        role: (dto.role as any) || 'USER',
        emailVerifiedAt: new Date(),
        hobbies: [],
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.role !== undefined ? { role: dto.role as any } : {}),
      },
      select: USER_SELECT,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: `User '${id}' deleted successfully` };
  }
}
