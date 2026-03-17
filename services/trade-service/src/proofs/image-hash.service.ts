import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { ProofImageHashEntity } from './proof-image-hash.entity';

@Injectable()
export class ImageHashService {
  private readonly logger = new Logger(ImageHashService.name);

  constructor(
    @InjectRepository(ProofImageHashEntity)
    private readonly hashRepo: Repository<ProofImageHashEntity>,
  ) {}

  /**
   * Compute a simple average perceptual hash from image buffer.
   * Uses sharp to resize to 8x8 grayscale, then computes hash based on average pixel value.
   */
  async computePerceptualHash(buffer: Buffer): Promise<string | null> {
    try {
      // Dynamic import sharp (may not be available in all environments)
      const sharp = require('sharp');
      const { data } = await sharp(buffer)
        .resize(8, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Compute average
      const pixels = Array.from(data as Buffer);
      const avg = pixels.reduce((sum, p) => sum + p, 0) / pixels.length;

      // Build hash: 1 if pixel > average, 0 otherwise
      let hash = '';
      for (const pixel of pixels) {
        hash += pixel > avg ? '1' : '0';
      }

      // Convert binary string to hex
      let hexHash = '';
      for (let i = 0; i < hash.length; i += 4) {
        hexHash += parseInt(hash.substring(i, i + 4), 2).toString(16);
      }

      return hexHash;
    } catch (err) {
      this.logger.warn(`Failed to compute perceptual hash: ${err}`);
      return null;
    }
  }

  /**
   * Compute Hamming distance between two hex hash strings.
   */
  hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 64; // max distance
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
      // Count set bits in XOR result
      let bits = xor;
      while (bits > 0) {
        distance += bits & 1;
        bits >>= 1;
      }
    }
    return distance;
  }

  /**
   * Store hash and check for near-duplicates from different trades/users.
   * Returns duplicate info if found.
   */
  async storeAndCheckDuplicate(
    phash: string,
    sha256: string,
    tradeId: string,
    userId: string,
    fileName: string,
  ): Promise<{ isDuplicate: boolean; duplicateOfTradeId?: string; distance?: number }> {
    // First check for exact SHA256 match (identical file)
    const exactMatch = await this.hashRepo.findOne({
      where: { sha256, tradeId: Not(tradeId) },
    });

    if (exactMatch) {
      const entity = this.hashRepo.create({
        phash, sha256, tradeId, userId, fileName,
        isDuplicate: true,
        duplicateOfTradeId: exactMatch.tradeId,
      });
      await this.hashRepo.save(entity);
      this.logger.warn(`Exact duplicate found: file ${fileName} in trade ${tradeId} matches trade ${exactMatch.tradeId}`);
      return { isDuplicate: true, duplicateOfTradeId: exactMatch.tradeId, distance: 0 };
    }

    // Check for perceptual near-duplicates (Hamming distance < 5)
    // For efficiency, load recent hashes and compare in-memory
    const recentHashes = await this.hashRepo.find({
      where: { tradeId: Not(tradeId) },
      order: { createdAt: 'DESC' },
      take: 5000, // check against last 5000 images
    });

    let closestMatch: ProofImageHashEntity | null = null;
    let closestDistance = 64;

    for (const existing of recentHashes) {
      const dist = this.hammingDistance(phash, existing.phash);
      if (dist < 5 && dist < closestDistance) {
        closestDistance = dist;
        closestMatch = existing;
      }
    }

    const isDuplicate = closestMatch !== null;
    const entity = this.hashRepo.create({
      phash, sha256, tradeId, userId, fileName,
      isDuplicate,
      duplicateOfTradeId: closestMatch?.tradeId,
    });
    await this.hashRepo.save(entity);

    if (isDuplicate) {
      this.logger.warn(
        `Perceptual duplicate found: ${fileName} in trade ${tradeId} ` +
        `matches trade ${closestMatch!.tradeId} (distance: ${closestDistance})`,
      );
    }

    return {
      isDuplicate,
      duplicateOfTradeId: closestMatch?.tradeId,
      distance: closestDistance < 64 ? closestDistance : undefined,
    };
  }
}
