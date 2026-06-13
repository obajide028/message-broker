import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TopicService } from './topics/topic.service';
import { ConsumerService } from './consumers/consumer.service';
import { MessageService } from './messages/message.service';
import { Message } from './messages/message.entity';
import { DeliveryMode } from '../common/enums/message-type.enum';
import { RouterService } from 'src/router/router.service';

export interface PublishOptions {
  topic: string;
  payload: unknown;
  producerId: string;
  ttl?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface DeliveryResult {
  message: Message;
  deliveredTo: string[]; // consumer IDs
}

// Callback the transport layer registers to actually send to a socket
export type DeliveryCallback = (
  consumerId: string,
  message: Message,
) => Promise<boolean>; // returns true if delivery succeeded

@Injectable()
export class BrokerService implements OnModuleInit {
  private readonly logger = new Logger(BrokerService.name);
  private deliveryCallback: DeliveryCallback | null = null;

  constructor(
    private readonly topicService: TopicService,
    private readonly consumerService: ConsumerService,
    private readonly messageService: MessageService,
    private readonly router: RouterService,
  ) {}

  onModuleInit() {
    this.logger.log('Broker service ready');
  }

  // Transport layer registers this so the broker can push to sockets
  registerDeliveryCallback(cb: DeliveryCallback): void {
    this.deliveryCallback = cb;
  }

  async publish(options: PublishOptions): Promise<DeliveryResult> {
    const message = await this.messageService.publish(options);
    const targets = await this.router.resolve(message);

    const deliveredTo: string[] = [];

    for (const { consumer } of targets) {
      await this.messageService.markDelivered(message.id);

      if (this.deliveryCallback) {
        const success = await this.deliveryCallback(consumer.id, message);

        if (success) {
          deliveredTo.push(consumer.id);
        } else {
          await this.messageService.handleDeliveryFailure(message.id);
        }
      }
    }

    return { message, deliveredTo };
  }

  async subscribe(consumerId: string, topicName: string): Promise<void> {
    await this.consumerService.subscribe(consumerId, topicName);
  }

  async unsubscribe(consumerId: string, topicName: string): Promise<void> {
    await this.consumerService.unsubscribe(consumerId, topicName);
  }

  async acknowledge(messageId: string): Promise<void> {
    await this.messageService.acknowledge(messageId);
  }

  async registerConsumer(params: {
    id: string;
    groupId?: string;
  }) {
    return this.consumerService.register(params);
  }

  async disconnectConsumer(consumerId: string): Promise<void> {
    await this.consumerService.disconnect(consumerId);
  }

  async heartbeat(consumerId: string): Promise<void> {
    await this.consumerService.heartbeat(consumerId);
  }

  async getTopics() {
    return this.topicService.findAll();
  }

  async createTopic(params: {
    name: string;
    deliveryMode?: DeliveryMode;
    retentionMs?: number;
  }) {
    return this.topicService.create(params);
  }

  async deleteTopic(name: string): Promise<void> {
  await this.topicService.delete(name);
}
}