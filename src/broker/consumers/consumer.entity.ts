import { IConsumer } from '../../common/interfaces/message.interface';

export class Consumer implements IConsumer {
  id: string;                  // socket connection id
  groupId?: string;
  subscriptions: string[];
  connectedAt: Date;
  lastSeenAt: Date;
  isAlive: boolean;

  constructor(params: {
    id: string;
    groupId?: string;
  }) {
    this.id = params.id;
    this.groupId = params.groupId;
    this.subscriptions = [];
    this.connectedAt = new Date();
    this.lastSeenAt = new Date();
    this.isAlive = true;
  }

  subscribe(topic: string): void {
    if (!this.subscriptions.includes(topic)) {
      this.subscriptions.push(topic);
    }
  }

  unsubscribe(topic: string): void {
    this.subscriptions = this.subscriptions.filter(t => t !== topic);
  }

  isSubscribedTo(topic: string): boolean {
    return this.subscriptions.includes(topic);
  }

  heartbeat(): void {
    this.lastSeenAt = new Date();
    this.isAlive = true;
  }

  disconnect(): void {
    this.isAlive = false;
  }
}