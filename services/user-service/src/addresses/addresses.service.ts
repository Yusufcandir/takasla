import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressEntity } from './address.entity';

const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(AddressEntity)
    private readonly addressRepo: Repository<AddressEntity>,
  ) {}

  async findAllByUser(userId: string): Promise<AddressEntity[]> {
    return this.addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, data: Partial<AddressEntity>): Promise<AddressEntity> {
    const count = await this.addressRepo.countBy({ userId });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException(`Maximum ${MAX_ADDRESSES} addresses allowed`);
    }

    if (data.isDefault) {
      await this.addressRepo.update({ userId }, { isDefault: false });
    }

    // If this is the first address, make it default
    const isFirst = count === 0;

    const address = this.addressRepo.create({
      ...data,
      userId,
      isDefault: data.isDefault || isFirst,
    });

    return this.addressRepo.save(address);
  }

  async update(userId: string, addressId: string, data: Partial<AddressEntity>): Promise<AddressEntity> {
    const address = await this.addressRepo.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    if (data.isDefault && !address.isDefault) {
      await this.addressRepo.update({ userId }, { isDefault: false });
    }

    Object.assign(address, data);
    return this.addressRepo.save(address);
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const address = await this.addressRepo.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    await this.addressRepo.remove(address);

    // If removed address was default, make the most recent one default
    if (address.isDefault) {
      const remaining = await this.addressRepo.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      if (remaining) {
        remaining.isDefault = true;
        await this.addressRepo.save(remaining);
      }
    }
  }

  async setDefault(userId: string, addressId: string): Promise<AddressEntity> {
    const address = await this.addressRepo.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    await this.addressRepo.update({ userId }, { isDefault: false });
    address.isDefault = true;
    return this.addressRepo.save(address);
  }
}
