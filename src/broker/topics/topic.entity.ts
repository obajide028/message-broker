import { ITopic } from '../../common/interfaces/message.interface';
import { DeliveryMode } from '../../common/enums/message-type.enum';

const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class Topic implements ITopic {
  name: string;
  deliveryMode: DeliveryMode;
  createdAt: Date;
  messageCount: number;
  pendingCount: number;
  consumerCount: number;
  retentionMs: number;

  constructor(params: {
    name: string;
    deliveryMode?: DeliveryMode;
    retentionMs?: number;
  }) {
    this.name = params.name;
    this.deliveryMode = params.deliveryMode ?? DeliveryMode.FANOUT;
    this.createdAt = new Date();
    this.messageCount = 0;
    this.pendingCount = 0;
    this.consumerCount = 0;
    this.retentionMs = params.retentionMs ?? DEFAULT_RETENTION_MS;
  }

  incrementMessageCount(): void {
    this.messageCount += 1;
    this.pendingCount += 1;
  }

  decrementPending(): void {
    if (this.pendingCount > 0) {
      this.pendingCount -= 1;
    }
  }

  addConsumer(): void {
    this.consumerCount += 1;
  }

  removeConsumer(): void {
    if (this.consumerCount > 0) {
      this.consumerCount -= 1;
    }
  }
}