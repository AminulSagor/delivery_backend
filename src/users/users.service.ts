import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return await this.usersRepository.save(user);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { phone } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findByPhoneOrEmail(phoneOrEmail: string): Promise<User | null> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .where('user.phone = :phoneOrEmail OR user.email = :phoneOrEmail', {
        phoneOrEmail,
      })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { id } });
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      refresh_token: refreshToken ?? undefined,
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { refresh_token: refreshToken },
    });
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
    const user = await this.findById(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    return user;
  }

  async updatePassword(userId: string, hash: string): Promise<void> {
    await this.usersRepository.update(userId, { password_hash: hash });
  }

  async updateOtp(userId: string, otp: string, expiresAt: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      reset_otp: otp,
      reset_otp_expires: expiresAt,
    });
  }

  async updatePasswordAndClearOtp(userId: string, hash: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password_hash: hash,
      reset_otp: null,
      reset_otp_expires: null,
    });
  }
}
