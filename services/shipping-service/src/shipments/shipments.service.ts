import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ShipmentEntity } from './shipment.entity';
import { ShipmentEventEntity } from './shipment-event.entity';
import { ShipmentStatus, QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { CarrierProviderService } from '../carriers/carrier-provider.service';
import { ShippingAddress } from '../carriers/carrier-provider.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ShipmentsService implements OnModuleInit {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @InjectRepository(ShipmentEntity)
    private readonly shipmentRepo: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentEventEntity)
    private readonly eventRepo: Repository<ShipmentEventEntity>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly carrierProviderService: CarrierProviderService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // Subscribe to addresses_ready events from trade-service — creates Leg 1 shipments (user → center)
    await this.rabbitMQService.subscribe(
      QUEUES.SHIPPING_ON_TRADE,
      [ROUTING_KEYS.SHIPPING.ADDRESSES_READY],
      async (msg: Record<string, unknown>) => {
        const {
          tradeId, partyAId, partyBId, listingAId, listingBId,
          partyAAddress, partyBAddress,
          centerAId, centerBId, centerAAddress, centerBAddress,
        } = msg as {
          tradeId: string;
          partyAId: string;
          partyBId: string;
          listingAId: string;
          listingBId: string;
          partyAAddress: ShippingAddress;
          partyBAddress: ShippingAddress;
          centerAId?: string;
          centerBId?: string;
          centerAAddress?: ShippingAddress;
          centerBAddress?: ShippingAddress;
        };

        // Check if Leg 1 shipments already exist for this trade
        const existing = await this.shipmentRepo.findBy({ tradeId });
        const leg1Exists = existing.some(s => s.leg === 'to_center');
        if (leg1Exists || existing.length >= 2) {
          this.logger.log(`Leg 1 shipments already exist for trade ${tradeId}, skipping`);
          return;
        }

        this.logger.log(`Creating Leg 1 shipments for trade ${tradeId} (user → center)`);

        const [valueA, valueB, weightA, weightB] = await Promise.all([
          this.fetchListingDeclaredValue(listingAId),
          this.fetchListingDeclaredValue(listingBId),
          this.fetchListingWeightGrams(listingAId),
          this.fetchListingWeightGrams(listingBId),
        ]);

        // Leg 1, Shipment 1: Party A sends item A → Center A
        const recipientAddressA = centerAAddress || partyBAddress;
        await this.createShipment({
          tradeId,
          senderId: partyAId,
          recipientId: centerAId || partyBId,
          listingId: listingAId,
          senderAddress: partyAAddress,
          recipientAddress: recipientAddressA,
          insuranceAmount: valueA,
          declaredWeightGrams: weightA,
          leg: centerAId ? 'to_center' : 'direct',
          centerId: centerAId,
          legOrder: 1,
        });

        // Leg 1, Shipment 2: Party B sends item B → Center B
        const recipientAddressB = centerBAddress || partyAAddress;
        await this.createShipment({
          tradeId,
          senderId: partyBId,
          recipientId: centerBId || partyAId,
          listingId: listingBId,
          senderAddress: partyBAddress,
          recipientAddress: recipientAddressB,
          insuranceAmount: valueB,
          declaredWeightGrams: weightB,
          leg: centerBId ? 'to_center' : 'direct',
          centerId: centerBId,
          legOrder: 1,
        });

        this.logger.log(`Leg 1 shipments created for trade ${tradeId}`);
      },
    );

    // Subscribe to center.both_verified — creates Leg 2 shipments (center → recipient)
    await this.rabbitMQService.subscribe(
      QUEUES.SHIPPING_ON_CENTER,
      [ROUTING_KEYS.CENTER.BOTH_VERIFIED],
      async (msg: Record<string, unknown>) => {
        const {
          tradeId, partyAId, partyBId, listingAId, listingBId,
          centerAId, centerBId, partyAAddress, partyBAddress,
        } = msg as {
          tradeId: string;
          partyAId: string;
          partyBId: string;
          listingAId: string;
          listingBId: string;
          centerAId: string;
          centerBId: string;
          partyAAddress: ShippingAddress;
          partyBAddress: ShippingAddress;
        };

        // Check if Leg 2 shipments already exist
        const existing = await this.shipmentRepo.findBy({ tradeId });
        const leg2Exists = existing.some(s => s.leg === 'to_recipient');
        if (leg2Exists) {
          this.logger.log(`Leg 2 shipments already exist for trade ${tradeId}, skipping`);
          return;
        }

        this.logger.log(`Creating Leg 2 shipments for trade ${tradeId} (center → recipient)`);

        // Get center addresses from Leg 1 shipments
        const leg1Shipments = existing.filter(s => s.leg === 'to_center');
        const shipmentToA = leg1Shipments.find(s => s.listingId === listingAId);
        const shipmentToB = leg1Shipments.find(s => s.listingId === listingBId);

        const [valueA, valueB, weightA, weightB] = await Promise.all([
          this.fetchListingDeclaredValue(listingAId),
          this.fetchListingDeclaredValue(listingBId),
          this.fetchListingWeightGrams(listingAId),
          this.fetchListingWeightGrams(listingBId),
        ]);

        // Build center address from Leg 1 recipient address (the center)
        const centerAAddr: ShippingAddress = shipmentToA ? {
          name: shipmentToA.recipientName || '',
          street: shipmentToA.recipientStreet || '',
          city: shipmentToA.recipientCity || '',
          state: shipmentToA.recipientState || '',
          postalCode: shipmentToA.recipientPostalCode || '',
          country: shipmentToA.recipientCountry || '',
          phone: shipmentToA.recipientPhone || '',
          district: shipmentToA.recipientDistrict,
        } : partyAAddress;

        const centerBAddr: ShippingAddress = shipmentToB ? {
          name: shipmentToB.recipientName || '',
          street: shipmentToB.recipientStreet || '',
          city: shipmentToB.recipientCity || '',
          state: shipmentToB.recipientState || '',
          postalCode: shipmentToB.recipientPostalCode || '',
          country: shipmentToB.recipientCountry || '',
          phone: shipmentToB.recipientPhone || '',
          district: shipmentToB.recipientDistrict,
        } : partyBAddress;

        // Leg 2, Shipment 1: Center A sends item A → Party B (item A goes to party B)
        const leg2Ship1 = await this.createShipment({
          tradeId,
          senderId: centerAId,
          recipientId: partyBId,
          listingId: listingAId,
          senderAddress: centerAAddr,
          recipientAddress: partyBAddress,
          insuranceAmount: valueA,
          declaredWeightGrams: weightA,
          leg: 'to_recipient',
          centerId: centerAId,
          legOrder: 2,
        });

        // Leg 2, Shipment 2: Center B sends item B → Party A (item B goes to party A)
        const leg2Ship2 = await this.createShipment({
          tradeId,
          senderId: centerBId,
          recipientId: partyAId,
          listingId: listingBId,
          senderAddress: centerBAddr,
          recipientAddress: partyAAddress,
          insuranceAmount: valueB,
          declaredWeightGrams: weightB,
          leg: 'to_recipient',
          centerId: centerBId,
          legOrder: 2,
        });

        this.logger.log(`Leg 2 shipments created for trade ${tradeId}`);

        // Auto-purchase labels for Leg 2 (platform-managed shipments from centers)
        await this.autoBuyLabel(leg2Ship1);
        await this.autoBuyLabel(leg2Ship2);
      },
    );

    // Subscribe to center.verification_rejected — creates return shipments (center → sender)
    await this.rabbitMQService.subscribe(
      QUEUES.SHIPPING_ON_CENTER,
      [ROUTING_KEYS.CENTER.VERIFICATION_REJECTED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, partyAId, partyBId, listingAId, listingBId } = msg as {
          tradeId: string;
          partyAId: string;
          partyBId: string;
          listingAId: string;
          listingBId: string;
        };

        // Find Leg 1 shipments that were delivered to centers
        const existing = await this.shipmentRepo.findBy({ tradeId });
        const leg1 = existing.filter(s => s.leg === 'to_center');
        const hasReturn = existing.some(s => s.leg === 'return');
        if (hasReturn || leg1.length === 0) {
          this.logger.log(`Return shipments already exist or no Leg 1 for trade ${tradeId}, skipping`);
          return;
        }

        this.logger.log(`Creating return shipments for rejected trade ${tradeId}`);

        for (const shipment of leg1) {
          if (shipment.status !== 'DELIVERED') continue; // Only return items that reached center

          // Return: center → original sender (swap sender/recipient from Leg 1)
          const senderAddr: ShippingAddress = {
            name: shipment.recipientName || '',
            street: shipment.recipientStreet || '',
            city: shipment.recipientCity || '',
            state: shipment.recipientState || '',
            postalCode: shipment.recipientPostalCode || '',
            country: shipment.recipientCountry || '',
            phone: shipment.recipientPhone || '',
            district: shipment.recipientDistrict,
          };
          const recipientAddr: ShippingAddress = {
            name: shipment.senderName || '',
            street: shipment.senderStreet || '',
            city: shipment.senderCity || '',
            state: shipment.senderState || '',
            postalCode: shipment.senderPostalCode || '',
            country: shipment.senderCountry || '',
            phone: shipment.senderPhone || '',
            district: shipment.senderDistrict,
          };

          await this.createShipment({
            tradeId,
            senderId: shipment.recipientId, // center
            recipientId: shipment.senderId, // original sender
            listingId: shipment.listingId,
            senderAddress: senderAddr,
            recipientAddress: recipientAddr,
            insuranceAmount: 0,
            declaredWeightGrams: null,
            leg: 'return',
            centerId: shipment.centerId,
            legOrder: 3,
          });

          this.logger.log(`Return shipment created for listing ${shipment.listingId} (center → ${shipment.senderId})`);
        }
      },
    );
  }

  private async fetchListingDeclaredValue(listingId: string): Promise<number> {
    try {
      const listingServiceUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
      const res = await fetch(`${listingServiceUrl}/listings/${listingId}`);
      if (!res.ok) return 0;
      const data = await res.json() as { declaredValue?: string };
      return parseFloat(data.declaredValue || '0') || 0;
    } catch {
      this.logger.warn(`Could not fetch declared value for listing ${listingId}`);
      return 0;
    }
  }

  private async fetchListingWeightGrams(listingId: string): Promise<number | null> {
    try {
      const listingServiceUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
      const res = await fetch(`${listingServiceUrl}/listings/${listingId}`);
      if (!res.ok) return null;
      const data = await res.json() as { weightGrams?: number };
      return data.weightGrams || null;
    } catch {
      return null;
    }
  }

  async flagWeightMismatch(shipmentId: string, actualWeightGrams: number): Promise<void> {
    const shipment = await this.shipmentRepo.findOneBy({ id: shipmentId });
    if (!shipment) return;

    shipment.actualWeightGrams = actualWeightGrams;

    if (shipment.declaredWeightGrams && shipment.declaredWeightGrams > 0) {
      const deviation = Math.abs(actualWeightGrams - shipment.declaredWeightGrams) / shipment.declaredWeightGrams;
      if (deviation > 0.3) {
        shipment.weightMismatchFlag = true;
        this.logger.warn(
          `Weight mismatch on shipment ${shipmentId}: declared=${shipment.declaredWeightGrams}g, actual=${actualWeightGrams}g (${Math.round(deviation * 100)}% deviation)`,
        );
      }
    }

    await this.shipmentRepo.save(shipment);
  }

  async createShipment(data: {
    tradeId: string;
    senderId: string;
    recipientId: string;
    listingId?: string;
    senderAddress: ShippingAddress;
    recipientAddress: ShippingAddress;
    insuranceAmount?: number;
    declaredWeightGrams?: number | null;
    leg?: string;
    centerId?: string;
    legOrder?: number;
  }): Promise<ShipmentEntity> {
    const shipment = this.shipmentRepo.create({
      tradeId: data.tradeId,
      senderId: data.senderId,
      recipientId: data.recipientId,
      listingId: data.listingId,
      status: ShipmentStatus.PENDING,
      insuranceAmount: data.insuranceAmount || 0,
      declaredWeightGrams: data.declaredWeightGrams || undefined,
      leg: data.leg || 'direct',
      centerId: data.centerId,
      legOrder: data.legOrder || 1,
      senderName: data.senderAddress.name,
      senderStreet: data.senderAddress.street,
      senderCity: data.senderAddress.city,
      senderState: data.senderAddress.state,
      senderPostalCode: data.senderAddress.postalCode,
      senderCountry: data.senderAddress.country,
      senderPhone: data.senderAddress.phone,
      senderDistrict: data.senderAddress.district,
      senderEmail: data.senderAddress.email,
      senderCountryCode: data.senderAddress.countryCode,
      senderStateCode: data.senderAddress.stateCode,
      senderCityCode: data.senderAddress.cityCode,
      senderNeighbourhood: data.senderAddress.neighbourhood,
      recipientName: data.recipientAddress.name,
      recipientStreet: data.recipientAddress.street,
      recipientCity: data.recipientAddress.city,
      recipientState: data.recipientAddress.state,
      recipientPostalCode: data.recipientAddress.postalCode,
      recipientCountry: data.recipientAddress.country,
      recipientPhone: data.recipientAddress.phone,
      recipientDistrict: data.recipientAddress.district,
      recipientEmail: data.recipientAddress.email,
      recipientCountryCode: data.recipientAddress.countryCode,
      recipientStateCode: data.recipientAddress.stateCode,
      recipientCityCode: data.recipientAddress.cityCode,
      recipientNeighbourhood: data.recipientAddress.neighbourhood,
    });

    const saved = await this.shipmentRepo.save(shipment);

    await this.createEvent(saved.id, ShipmentStatus.PENDING, 'Shipment created, awaiting label purchase');

    return saved;
  }

  async getRates(shipmentId: string) {
    const shipment = await this.shipmentRepo.findOneBy({ id: shipmentId });
    if (!shipment) throw new NotFoundException('Shipment not found');

    if (!shipment.senderName || !shipment.recipientName) {
      throw new BadRequestException('Shipment addresses are incomplete');
    }

    const fromAddress: ShippingAddress = {
      name: shipment.senderName,
      street: shipment.senderStreet || '',
      city: shipment.senderCity || '',
      state: shipment.senderState || '',
      postalCode: shipment.senderPostalCode || '',
      country: shipment.senderCountry || '',
      phone: shipment.senderPhone || '',
      district: shipment.senderDistrict,
      email: shipment.senderEmail,
      countryCode: shipment.senderCountryCode,
      stateCode: shipment.senderStateCode,
      cityCode: shipment.senderCityCode,
      neighbourhood: shipment.senderNeighbourhood,
    };

    const toAddress: ShippingAddress = {
      name: shipment.recipientName,
      street: shipment.recipientStreet || '',
      city: shipment.recipientCity || '',
      state: shipment.recipientState || '',
      postalCode: shipment.recipientPostalCode || '',
      country: shipment.recipientCountry || '',
      phone: shipment.recipientPhone || '',
      district: shipment.recipientDistrict,
      email: shipment.recipientEmail,
      countryCode: shipment.recipientCountryCode,
      stateCode: shipment.recipientStateCode,
      cityCode: shipment.recipientCityCode,
      neighbourhood: shipment.recipientNeighbourhood,
    };

    const provider = this.carrierProviderService.getProvider();

    return provider.getRates(fromAddress, toAddress);
  }

  async buyLabel(shipmentId: string, rateId: string) {
    const shipment = await this.shipmentRepo.findOneBy({ id: shipmentId });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new BadRequestException('Label can only be purchased for PENDING shipments');
    }

    const provider = this.carrierProviderService.getProvider();

    const result = await provider.buyLabel(rateId);

    shipment.status = ShipmentStatus.LABEL_CREATED;
    shipment.trackingNumber = result.trackingNumber;
    shipment.trackingUrl = result.trackingUrl;
    shipment.labelUrl = result.labelUrl;
    shipment.carrierName = result.carrier;
    shipment.carrierCode = result.carrierCode;
    shipment.serviceLevel = result.service;
    shipment.cost = result.cost;
    shipment.currency = result.currency;
    shipment.estimatedDeliveryDate = result.estimatedDeliveryDate;
    shipment.providerShipmentId = result.providerShipmentId;
    shipment.providerTrackerId = result.providerTrackerId;
    shipment.providerType = 'geliver';
    shipment.barcode = result.barcode;

    const saved = await this.shipmentRepo.save(shipment);

    await this.createEvent(saved.id, ShipmentStatus.LABEL_CREATED, `Label created. Tracking: ${result.trackingNumber}`);

    // Publish label created event
    await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.LABEL_CREATED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      shipmentId: saved.id,
      tradeId: saved.tradeId,
      senderId: saved.senderId,
      trackingNumber: result.trackingNumber,
    });

    // Check if both shipments for this trade have labels
    await this.checkAndNotifyBothLabelsReady(saved.tradeId);

    return saved;
  }

  async getByTradeId(tradeId: string): Promise<ShipmentEntity[]> {
    const shipments = await this.shipmentRepo.find({
      where: { tradeId },
      relations: ['events'],
      order: { createdAt: 'ASC' },
    });

    // Poll carrier providers for status updates on active shipments
    // (webhooks can't reach localhost in dev, so we poll on read)
    const activeStatuses = [
      ShipmentStatus.LABEL_CREATED,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.OUT_FOR_DELIVERY,
    ];

    for (const shipment of shipments) {
      if (activeStatuses.includes(shipment.status) && shipment.providerShipmentId && shipment.providerType) {
        await this.syncShipmentStatusFromProvider(shipment);
      }
    }

    // Re-fetch to include any new events added during sync
    const updated = await this.shipmentRepo.find({
      where: { tradeId },
      relations: ['events'],
      order: { createdAt: 'ASC' },
    });

    // Re-publish trade-level shipping events so trade-service can catch up
    // (idempotent — trade-service handlers ignore events for already-advanced states)
    if (updated.length >= 2) {
      const allHaveLabels = updated.every(s => s.status !== ShipmentStatus.PENDING);
      const allInTransitOrBeyond = updated.every(s =>
        [ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED].includes(s.status),
      );
      const allDelivered = updated.every(s => s.status === ShipmentStatus.DELIVERED);

      if (allDelivered) {
        await this.checkAndNotifyBothDelivered(tradeId);
      } else if (allInTransitOrBeyond) {
        await this.checkAndNotifyBothInTransit(tradeId);
      } else if (allHaveLabels) {
        await this.checkAndNotifyBothLabelsReady(tradeId);
      }
    }

    return updated;
  }

  async getById(id: string): Promise<ShipmentEntity> {
    const shipment = await this.shipmentRepo.findOne({
      where: { id },
      relations: ['events'],
    });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // Sync status from provider if active
    const activeStatuses = [
      ShipmentStatus.LABEL_CREATED,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.OUT_FOR_DELIVERY,
    ];
    if (activeStatuses.includes(shipment.status) && shipment.providerShipmentId && shipment.providerType) {
      await this.syncShipmentStatusFromProvider(shipment);
      // Re-fetch with updated events
      return this.shipmentRepo.findOne({
        where: { id },
        relations: ['events'],
      }) as Promise<ShipmentEntity>;
    }

    return shipment;
  }

  async getTracking(shipmentId: string): Promise<ShipmentEventEntity[]> {
    const shipment = await this.shipmentRepo.findOneBy({ id: shipmentId });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // If we have a provider tracker, fetch latest events
    if (shipment.providerTrackerId && shipment.providerType) {
      const provider = this.carrierProviderService.getProviderByName(shipment.providerType);
      if (provider) {
        try {
          const externalEvents = await provider.getTracking(shipment.providerTrackerId);
          // Store any new external events
          for (const ext of externalEvents) {
            const exists = await this.eventRepo.findOne({
              where: { shipmentId, status: ext.status, message: ext.message },
            });
            if (!exists) {
              await this.createEvent(shipmentId, ext.status, ext.message, ext.location, ext.occurredAt);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch external tracking for ${shipmentId}: ${error}`);
        }
      }
    }

    return this.eventRepo.find({
      where: { shipmentId },
      order: { occurredAt: 'ASC' },
    });
  }

  // Handle Geliver webhooks
  async handleGeliverWebhook(event: Record<string, unknown>) {
    const shipmentId = event.shipmentId as string || event.shipment_id as string;
    const status = event.status as string;
    const trackingNumber = event.trackingNumber as string || event.tracking_number as string;

    if (!shipmentId && !trackingNumber) {
      this.logger.warn('Geliver webhook: missing shipment identifier');
      return;
    }

    // Find by provider shipment ID or tracking number
    let shipment = shipmentId
      ? await this.shipmentRepo.findOneBy({ providerShipmentId: shipmentId })
      : null;

    if (!shipment && trackingNumber) {
      shipment = await this.shipmentRepo.findOneBy({ trackingNumber });
    }

    if (!shipment) {
      this.logger.warn(`Geliver webhook: no shipment found for ${shipmentId || trackingNumber}`);
      return;
    }

    // Map Geliver status to our status
    const newStatus = this.mapGeliverStatus(status);
    if (!newStatus) return;

    await this.updateShipmentStatus(shipment, newStatus);

    const message = event.message as string || `Status updated: ${status}`;
    const location = event.location as string || '';
    await this.createEvent(shipment.id, newStatus, message, location);
  }

  async simulateShipmentProgress(shipmentId: string): Promise<ShipmentEntity> {
    const shipment = await this.shipmentRepo.findOneBy({ id: shipmentId });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const statusProgression: ShipmentStatus[] = [
      ShipmentStatus.LABEL_CREATED,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.OUT_FOR_DELIVERY,
      ShipmentStatus.DELIVERED,
    ];

    const currentIndex = statusProgression.indexOf(shipment.status);
    if (currentIndex < 0 || currentIndex >= statusProgression.length - 1) {
      throw new BadRequestException(`Cannot advance from status ${shipment.status}`);
    }

    const messages: Record<string, string> = {
      [ShipmentStatus.IN_TRANSIT]: 'Package picked up by carrier',
      [ShipmentStatus.OUT_FOR_DELIVERY]: 'Package out for delivery',
      [ShipmentStatus.DELIVERED]: 'Package delivered successfully',
    };

    // Advance through all remaining steps to DELIVERED in one go
    for (let i = currentIndex + 1; i < statusProgression.length; i++) {
      const nextStatus = statusProgression[i];
      await this.updateShipmentStatus(shipment, nextStatus);
      await this.createEvent(shipment.id, nextStatus, messages[nextStatus] || `Status: ${nextStatus}`);
    }

    return this.shipmentRepo.findOneBy({ id: shipmentId }) as Promise<ShipmentEntity>;
  }

  async findPendingSimulatedShipments(): Promise<ShipmentEntity[]> {
    return this.shipmentRepo
      .createQueryBuilder('s')
      .where('"trackingNumber" LIKE :prefix', { prefix: 'SIM%' })
      .andWhere('s.status NOT IN (:...finalStatuses)', {
        finalStatuses: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
      })
      .getMany();
  }

  async instantDeliverSimulated(shipment: ShipmentEntity): Promise<void> {
    if (!shipment.shippedAt) {
      shipment.shippedAt = new Date();
    }
    await this.updateShipmentStatus(shipment, ShipmentStatus.DELIVERED);
    await this.createEvent(shipment.id, ShipmentStatus.DELIVERED, 'Simulated: Package delivered instantly');
  }

  // --- Private helpers ---

  private async syncShipmentStatusFromProvider(shipment: ShipmentEntity): Promise<void> {
    const provider = this.carrierProviderService.getProviderByName(shipment.providerType!);
    if (!provider) return;

    try {
      const externalEvents = await provider.getTracking(shipment.providerTrackerId!);
      if (!externalEvents.length) return;

      // Find the most advanced status from external events
      const statusOrder: Record<string, number> = {
        'LABEL_CREATED': 1,
        'IN_TRANSIT': 2,
        'OUT_FOR_DELIVERY': 3,
        'DELIVERED': 4,
        'RETURNED': 5,
        'FAILED': 6,
        'CANCELLED': 7,
      };

      let latestStatus: string | null = null;
      let latestOrder = statusOrder[shipment.status] || 0;

      for (const evt of externalEvents) {
        const evtOrder = statusOrder[evt.status] || 0;
        if (evtOrder > latestOrder) {
          latestStatus = evt.status;
          latestOrder = evtOrder;
        }

        // Store new events
        const exists = await this.eventRepo.findOne({
          where: { shipmentId: shipment.id, status: evt.status, message: evt.message },
        });
        if (!exists) {
          await this.createEvent(shipment.id, evt.status, evt.message, evt.location, evt.occurredAt);
        }
      }

      // Update shipment status if a more advanced status was found
      if (latestStatus && latestStatus !== shipment.status) {
        const newStatus = latestStatus as ShipmentStatus;
        this.logger.log(`Synced shipment ${shipment.id}: ${shipment.status} → ${newStatus}`);
        await this.updateShipmentStatus(shipment, newStatus);
      }
    } catch (error) {
      this.logger.warn(`Failed to sync status for shipment ${shipment.id}: ${error}`);
    }
  }

  private async updateShipmentStatus(shipment: ShipmentEntity, newStatus: ShipmentStatus) {
    shipment.status = newStatus;
    if (newStatus === ShipmentStatus.IN_TRANSIT && !shipment.shippedAt) {
      shipment.shippedAt = new Date();
    }
    if (newStatus === ShipmentStatus.DELIVERED) {
      shipment.deliveredAt = new Date();
    }
    await this.shipmentRepo.save(shipment);

    if (newStatus === ShipmentStatus.IN_TRANSIT) {
      await this.checkAndNotifyBothInTransit(shipment.tradeId);
    }
    if (newStatus === ShipmentStatus.DELIVERED) {
      await this.checkAndNotifyBothDelivered(shipment.tradeId);
    }
  }

  private async createEvent(
    shipmentId: string,
    status: string,
    message: string,
    location?: string,
    occurredAt?: Date,
  ) {
    const event = this.eventRepo.create({
      shipmentId,
      status,
      message,
      location: location || '',
      occurredAt: occurredAt || new Date(),
    });
    return this.eventRepo.save(event);
  }

  private async checkAndNotifyBothLabelsReady(tradeId: string) {
    const shipments = await this.shipmentRepo.findBy({ tradeId });
    // Determine which leg is active (the latest leg with PENDING shipments)
    const leg1 = shipments.filter(s => s.legOrder === 1);
    const leg2 = shipments.filter(s => s.legOrder === 2);
    const activeLeg = leg2.length > 0 && leg2.some(s => s.status === ShipmentStatus.PENDING) ? leg2 : leg1;

    if (activeLeg.length < 2) return;

    const allHaveLabels = activeLeg.every(
      (s) => s.status !== ShipmentStatus.PENDING,
    );

    if (allHaveLabels) {
      const leg = activeLeg[0]?.leg || 'direct';
      this.logger.log(`Both labels ready for trade ${tradeId} (leg=${leg})`);
      await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.LABEL_CREATED, {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        tradeId,
        allLabelsReady: true,
        leg,
      });
    }
  }

  private async checkAndNotifyBothInTransit(tradeId: string) {
    const shipments = await this.shipmentRepo.findBy({ tradeId });
    // Determine which leg to check
    const leg2 = shipments.filter(s => s.legOrder === 2);
    const leg1 = shipments.filter(s => s.legOrder === 1);
    // If leg 2 exists, check leg 2. Otherwise check leg 1.
    const activeLeg = leg2.length >= 2 ? leg2 : leg1;

    if (activeLeg.length < 2) return;

    const allInTransit = activeLeg.every(
      (s) => [ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED].includes(s.status),
    );

    if (allInTransit) {
      const leg = activeLeg[0]?.leg || 'direct';
      this.logger.log(`Both shipments in transit for trade ${tradeId} (leg=${leg})`);
      await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.IN_TRANSIT, {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        tradeId,
        leg,
      });
    }
  }

  private async checkAndNotifyBothDelivered(tradeId: string) {
    const shipments = await this.shipmentRepo.findBy({ tradeId });
    const leg1 = shipments.filter(s => s.legOrder === 1);
    const leg2 = shipments.filter(s => s.legOrder === 2);

    // Check Leg 1 delivery → publish center.item_received
    if (leg1.length >= 2) {
      const allLeg1Delivered = leg1.every((s) => s.status === ShipmentStatus.DELIVERED);
      if (allLeg1Delivered && leg2.length === 0) {
        // Leg 1 both delivered → notify each item arrived at center
        for (const s of leg1) {
          const party = s.senderId === (shipments.find(x => x.legOrder === 1 && x !== s)?.recipientId || '') ? 'B' : 'A';
          // Determine party based on listing
          this.logger.log(`Leg 1 shipment ${s.id} delivered for trade ${tradeId}`);
        }
        // Publish item_received for both parties
        await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.ITEM_RECEIVED, {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          tradeId,
          party: 'A',
        });
        await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.ITEM_RECEIVED, {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          tradeId,
          party: 'B',
        });
        this.logger.log(`Both Leg 1 shipments delivered for trade ${tradeId}, items at centers`);
        return;
      }
    }

    // Check Leg 2 delivery → publish standard shipping.delivered
    if (leg2.length >= 2) {
      const allLeg2Delivered = leg2.every((s) => s.status === ShipmentStatus.DELIVERED);
      if (allLeg2Delivered) {
        this.logger.log(`Both Leg 2 shipments delivered for trade ${tradeId}`);
        await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.DELIVERED, {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          tradeId,
          leg: 'to_recipient',
        });
        return;
      }
    }

    // Fallback for direct shipments (no centers)
    if (leg1.length === 0 && leg2.length === 0) {
      const directShipments = shipments.filter(s => s.leg === 'direct');
      if (directShipments.length >= 2 && directShipments.every(s => s.status === ShipmentStatus.DELIVERED)) {
        this.logger.log(`Both direct shipments delivered for trade ${tradeId}`);
        await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.DELIVERED, {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          tradeId,
          leg: 'direct',
        });
      }
    }
  }

  private async autoBuyLabel(shipment: ShipmentEntity): Promise<void> {
    try {
      const rates = await this.getRates(shipment.id);
      if (!rates || rates.length === 0) {
        this.logger.warn(`No rates available for Leg 2 shipment ${shipment.id}`);
        return;
      }
      // Pick the first (cheapest) rate
      const rate = rates[0];
      await this.buyLabel(shipment.id, rate.id);
      this.logger.log(`Auto-purchased label for Leg 2 shipment ${shipment.id} (rate: ${rate.id})`);
    } catch (error) {
      this.logger.error(`Failed to auto-buy label for shipment ${shipment.id}: ${error}`);
    }
  }

  private mapGeliverStatus(status: string): ShipmentStatus | null {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('deliver') || s.includes('teslim')) return ShipmentStatus.DELIVERED;
    if (s.includes('transit') || s.includes('taşıma') || s.includes('yolda')) return ShipmentStatus.IN_TRANSIT;
    if (s.includes('out_for') || s.includes('dağıtım')) return ShipmentStatus.OUT_FOR_DELIVERY;
    if (s.includes('label') || s.includes('created') || s.includes('oluşturuldu')) return ShipmentStatus.LABEL_CREATED;
    if (s.includes('return') || s.includes('iade')) return ShipmentStatus.RETURNED;
    if (s.includes('fail') || s.includes('hata')) return ShipmentStatus.FAILED;
    if (s.includes('cancel') || s.includes('iptal')) return ShipmentStatus.CANCELLED;
    return ShipmentStatus.IN_TRANSIT;
  }
}
