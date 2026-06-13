import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { PERSISTENCE_ADAPTER, IPersistenceAdapter } from '../persistence/persistence.interface';
import { Message } from './message.entity';
import { TopicService } from '../topics/topic.service';
import { DeliveryMode, MessageStatus } from '../../common/enums/message-type.enum';

interface PublishMessageDto {
  topic: string;
  payload: unknown;
  producerId: string;
  ttl?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @Inject(PERSISTENCE_ADAPTER)
    private readonly persistence: IPersistenceAdapter,
    private readonly topicService: TopicService,
  ) {}

  async publish(dto: PublishMessageDto): Promise<Message> {
    // Auto-create topic if it doesn't exist
    const topic = await this.topicService.getOrCreate({ name: dto.topic });

    const message = new Message({
      topic: dto.topic,
      payload: dto.payload,
      producerId: dto.producerId,
      deliveryMode: topic.deliveryMode,
      ttl: dto.ttl,
      maxRetries: dto.maxRetries,
      headers: dto.headers,
    });

    await this.persistence.saveMessage(message);
    await this.topicService.recordMessagePublished(dto.topic);

    this.logger.log(
      `Message published: ${message.id} → topic "${dto.topic}"`,
    );

    return message;
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.persistence.getMessage(id);

    if (!message) {
      throw new NotFoundException(`Message "${id}" not found`);
    }

    return message;
  }

  async getByTopic(topicName: string): Promise<Message[]> {
    return this.persistence.getMessagesByTopic(topicName);
  }

  async getPendingByTopic(topicName: string): Promise<Message[]> {
    const messages = await this.getByTopic(topicName);
    return messages.filter(
      (m) =>
        m.status === MessageStatus.PENDING ||
        m.status === MessageStatus.DELIVERED, // delivered but not yet acked
    );
  }

  async markDelivered(messageId: string): Promise<Message> {
    const message = await this.findOne(messageId);
    message.markDelivered();
    await this.persistence.updateMessage(message);
    return message;
  }

  async acknowledge(messageId: string): Promise<Message> {
    const message = await this.findOne(messageId);
    message.markAcknowledged();
    await this.persistence.updateMessage(message);
    await this.topicService.recordMessageAcknowledged(message.topic);

    this.logger.log(`Message acknowledged: ${messageId}`);
    return message;
  }

  async handleDeliveryFailure(messageId: string): Promise<Message> {
    const message = await this.findOne(messageId);
    message.incrementRetry();

    if (!message.canRetry()) {
      message.markFailed();
      this.logger.warn(
        `Message ${messageId} failed permanently after ${message.retryCount} attempts`,
      );
    } else {
      // Reset to PENDING so the router picks it up again
      message.status = MessageStatus.PENDING;
      this.logger.warn(
        `Message ${messageId} delivery failed — retry ${message.retryCount}/${message.maxRetries}`,
      );
    }

    await this.persistence.updateMessage(message);
    return message;
  }

  async evictExpired(): Promise<number> {
    return this.persistence.deleteExpiredMessages();
  }
}