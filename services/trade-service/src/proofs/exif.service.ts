import { Injectable, Logger } from '@nestjs/common';

// exifr is ESM-only — use dynamic import bypass
const dynamicImport = new Function('specifier', 'return import(specifier)');

export interface ExifResult {
  hasExif: boolean;
  dateTimeOriginal?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  cameraMake?: string;
  cameraModel?: string;
  software?: string;
  flags: string[]; // warning flags for moderators
}

@Injectable()
export class ExifService {
  private readonly logger = new Logger(ExifService.name);
  private exifr: { parse: (buffer: Buffer, options?: Record<string, unknown>) => Promise<Record<string, unknown> | null> } | null = null;

  async onModuleInit() {
    try {
      const mod = await dynamicImport('exifr');
      this.exifr = mod.default || mod;
      this.logger.log('exifr loaded successfully');
    } catch (err) {
      this.logger.warn(`Failed to load exifr: ${err}. EXIF extraction disabled.`);
    }
  }

  async extractMetadata(buffer: Buffer, mimeType: string): Promise<ExifResult> {
    const flags: string[] = [];

    // Only process images (JPEG, TIFF, HEIC, WebP)
    if (!mimeType.startsWith('image/')) {
      return { hasExif: false, flags: [] };
    }

    if (!this.exifr) {
      return { hasExif: false, flags: ['exif_library_unavailable'] };
    }

    try {
      const data = await this.exifr.parse(buffer, {
        pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model', 'Software', 'CreateDate', 'ModifyDate'],
      });

      if (!data) {
        flags.push('no_exif_data');
        return { hasExif: false, flags };
      }

      const result: ExifResult = {
        hasExif: true,
        flags,
      };

      // Extract fields
      const dateStr = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
      if (dateStr) {
        result.dateTimeOriginal = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr);

        // Flag if photo is older than 7 days
        const photoDate = dateStr instanceof Date ? dateStr : new Date(String(dateStr));
        const daysDiff = (Date.now() - photoDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 7) {
          flags.push('photo_older_than_7_days');
        }
      } else {
        flags.push('no_date_in_exif');
      }

      if (data.GPSLatitude !== undefined) result.gpsLatitude = Number(data.GPSLatitude);
      if (data.GPSLongitude !== undefined) result.gpsLongitude = Number(data.GPSLongitude);
      if (data.Make) result.cameraMake = String(data.Make);
      if (data.Model) result.cameraModel = String(data.Model);

      if (data.Software) {
        result.software = String(data.Software);
        const sw = result.software.toLowerCase();
        // Flag AI generation tools
        if (sw.includes('dall-e') || sw.includes('midjourney') || sw.includes('stable diffusion') ||
            sw.includes('comfyui') || sw.includes('automatic1111') || sw.includes('ai')) {
          flags.push('ai_tool_detected');
        }
      }

      return result;
    } catch (err) {
      this.logger.warn(`EXIF extraction failed: ${err}`);
      return { hasExif: false, flags: ['exif_parse_error'] };
    }
  }
}
