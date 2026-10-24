import type { PrismaClient, User, UserRole, UserStatus } from '@zyvo/database';

export interface CreateUserData {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  status?: UserStatus;
}

export interface UpdateUserData {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  passwordHash?: string | null;
  role?: UserRole;
  status?: UserStatus;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone: data.phone ?? null,
        email: data.email ?? null,
        name: data.name ?? null,
        passwordHash: data.passwordHash ?? null,
        role: data.role ?? 'PASSENGER',
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
