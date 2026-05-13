import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ExternalDataService {
  private readonly logger = new Logger(ExternalDataService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getCategoryRiskWeight(categoryId: string): Promise<number> {
    const listingUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${listingUrl}/categories/by-id/${categoryId}`),
      );
      return parseFloat(data.riskWeight ?? '0.5');
    } catch (err) {
      this.logger.warn(`Could not fetch category ${categoryId}, defaulting weight to 0.5: ${err}`);
      return 0.5;
    }
  }

  async getListingDetails(listingId: string): Promise<{ categoryId: string; declaredValue: number }> {
    const listingUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${listingUrl}/listings/${listingId}`),
      );
      return {
        categoryId: data.categoryId,
        declaredValue: parseFloat(data.declaredValue ?? '0'),
      };
    } catch (err) {
      this.logger.warn(`Could not fetch listing ${listingId}, using defaults: ${err}`);
      return { categoryId: '', declaredValue: 1000 };
    }
  }

  async getUserTrustScore(userId: string): Promise<number> {
    const userUrl = this.config.get<string>('USER_SERVICE_URL', 'http://user-service:3002');
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${userUrl}/profiles/${userId}/trust`),
      );
      return parseFloat(data.score ?? '50');
    } catch (err) {
      this.logger.warn(`Could not fetch trust score for ${userId}, defaulting to 50: ${err}`);
      return 50;
    }
  }

  async getUserDisputeCount(userId: string): Promise<number> {
    const disputeUrl = this.config.get<string>('DISPUTE_SERVICE_URL', 'http://dispute-service:3007');
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${disputeUrl}/disputes/user/${userId}/count`),
      );
      return parseInt(data.count ?? '0', 10);
    } catch {
      this.logger.warn(`Could not fetch dispute count for ${userId}, defaulting to 0`);
      return 0;
    }
  }
}
