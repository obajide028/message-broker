import { DeliveryMode, MessageStatus } from 'src/common/enums/message-type.enum';
import { IMessage } from 'src/common/interfaces/message.interface';
import { v4 as uuidv4 } from 'uuid';

export class Message implements IMessage {
  id: string;
  topic: string;
  payload: unknown;
  producerId: string;
  status: MessageStatus;
  deliveryMode: DeliveryMode;
  createdAt: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  ttl?: number;
  expiresAt?: Date;
  retryCount: number;
  maxRetries: number;
  headers?: Record<string, string>;

  constructor(params: {
    topic: string;
    payload: unknown;
    producerId: string;
    deliveryMode: DeliveryMode;
    ttl?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
  }) {
    this.id = uuidv4();
    this.topic = params.topic;
    this.payload = params.payload;
    this.producerId = params.producerId;
    this.deliveryMode = params.deliveryMode;
    this.status = MessageStatus.PENDING;
    this.createdAt = new Date();
    this.retryCount = 0;
    this.maxRetries = params.maxRetries ?? 3;
    this.headers = params.headers;

    if (params.ttl) {
      this.ttl = params.ttl;
      this.expiresAt = new Date(this.createdAt.getTime() + params.ttl);
    }
  }

  // Behaviour lives on the entity — not scattered in services
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  markDelivered(): void {
    this.status = MessageStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  markAcknowledged(): void {
    this.status = MessageStatus.ACKNOWLEDGED;
    this.acknowledgedAt = new Date();
  }

  markFailed(): void {
    this.status = MessageStatus.FAILED;
  }

  incrementRetry(): void {
    this.retryCount += 1;
  }
}