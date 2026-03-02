import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';
import { UpdateUserDto } from './dtos/update-user.dto.js';
import { UserFilterDto } from './dtos/user-filter.dto.js';
import { hash } from 'bcryptjs';
import { uuidv7 } from 'uuidv7';
import type { Prisma } from '../../generated/prisma/client.js';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: UserFilterDto) {
    const take = filter.take ?? 20;

    const where: Prisma.UserWhereInput = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.role) {
      where.role = filter.role;
    }

    const findManyArgs: Prisma.UserFindManyArgs = {
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
    const nextCursor = hasMore && data.length > 0 ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        id: uuidv7(),
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
      },
      select: USER_SELECT,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const data: Prisma.UserUpdateInput = { ...dto };
    if (dto.password) {
      data.password = await hash(dto.password, 12);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    return user;
  }

  async remove(id: string) {
    await this.findById(id);

    await this.prisma.user.delete({ where: { id } });

    return { message: `User with ID ${id} deleted successfully` };
  }
}
