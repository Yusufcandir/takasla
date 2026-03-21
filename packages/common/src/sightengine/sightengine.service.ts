import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SightEngineService implements OnModuleInit {
  private readonly logger = new Logger(SightEngineService.name);
  private apiUser: string | undefined;
  private apiSecret: string | undefined;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiUser = this.config.get<string>('SIGHTENGINE_API_USER');
    this.apiSecret = this.config.get<string>('SIGHTENGINE_API_SECRET');
    this.configured = !!(this.apiUser && this.apiSecret);
    if (this.configured) {
      this.logger.log('SightEngine AI detection configured');
    } else {
      this.logger.warn('SightEngine not configured — AI image detection disabled');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Check a single image buffer for AI-generated content.
   * Returns the ai_generated score (0.0 - 1.0), or null if not configured or on error.
   */
  async checkImage(buffer: Buffer, filename: string): Promise<number | null> {
    if (!this.configured) return null;

    try {
      const blob = new Blob([buffer]);
      const formData = new FormData();
      formData.append('media', blob, filename);
      formData.append('models', 'genai');
      formData.append('api_user', this.apiUser!);
      formData.append('api_secret', this.apiSecret!);

      const response = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        this.logger.error(`SightEngine HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json() as {
        status: string;
        type?: { ai_generated?: number };
      };

      if (data.status !== 'success') {
        this.logger.error(`SightEngine API error: ${JSON.stringify(data)}`);
        return null;
      }

      const score = data.type?.ai_generated ?? null;
      if (score !== null) {
        this.logger.log(`AI score for ${filename}: ${score.toFixed(3)}`);
      }
      return score;
    } catch (err) {
      this.logger.error(`SightEngine check failed for ${filename}: ${err}`);
      return null;
    }
  }
}
