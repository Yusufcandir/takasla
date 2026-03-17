import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './category.entity';

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async findAll(): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<CategoryEntity> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async findBySlug(slug: string): Promise<CategoryEntity> {
    const cat = await this.categoryRepo.findOne({ where: { slug } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(name: string, slug: string, riskWeight: number, parentId?: string): Promise<CategoryEntity> {
    return this.categoryRepo.save({ name, slug, riskWeight, parentId });
  }

  async seed(): Promise<void> {
    const count = await this.categoryRepo.count();
    if (count > 0) {
      // Update existing categories with baseFee if missing (migration for existing data)
      await this.updateBaseFees();
      return;
    }

    const categories = [
      { name: 'Luxury Watches', slug: 'luxury-watches', riskWeight: 1.0, baseFee: 500.0 },
      { name: 'Collectibles', slug: 'collectibles', riskWeight: 0.9, baseFee: 300.0 },
      { name: 'Signed Memorabilia', slug: 'signed-memorabilia', riskWeight: 0.95, baseFee: 350.0 },
      { name: 'Rare Electronics', slug: 'rare-electronics', riskWeight: 0.7, baseFee: 250.0 },
      { name: 'High-End Fashion', slug: 'high-end-fashion', riskWeight: 0.8, baseFee: 200.0 },
      { name: 'Electronics', slug: 'electronics', riskWeight: 0.5, baseFee: 100.0 },
      { name: 'Clothing', slug: 'clothing', riskWeight: 0.3, baseFee: 50.0 },
      { name: 'Books & Media', slug: 'books-media', riskWeight: 0.2, baseFee: 25.0 },
      { name: 'Sports Equipment', slug: 'sports-equipment', riskWeight: 0.4, baseFee: 75.0 },
      { name: 'Other', slug: 'other', riskWeight: 0.5, baseFee: 100.0 },
    ];

    await this.categoryRepo.save(categories);
  }

  private async updateBaseFees(): Promise<void> {
    const feeMap: Record<string, number> = {
      'luxury-watches': 500.0,
      'collectibles': 300.0,
      'signed-memorabilia': 350.0,
      'rare-electronics': 250.0,
      'high-end-fashion': 200.0,
      'electronics': 100.0,
      'clothing': 50.0,
      'books-media': 25.0,
      'sports-equipment': 75.0,
      'other': 100.0,
    };

    try {
      for (const [slug, baseFee] of Object.entries(feeMap)) {
        await this.categoryRepo.update({ slug }, { baseFee });
      }
    } catch {
      // Column may not exist yet on first boot — TypeORM synchronize will add it, then next restart succeeds
    }
  }
}
