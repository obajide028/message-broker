import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { PERSISTENCE_ADAPTER, IPersistenceAdapter } from '../persistence/persistence.interface';
import { Consumer } from './consumer.entity';
import { TopicService } from '../topics/topic.service';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    @Inject(PERSISTENCE_ADAPTER)
    private readonly persistence: IPersistenceAdapter,
    private readonly topicService: TopicService,
  ) {}

  async register(params: { id: string; groupId?: string }): Promise<Consumer> {
    const consumer = new Consumer(params);
    await this.persistence.saveConsumer(consumer);
    this.logger.log(
      `Consumer registered: ${consumer.id}${consumer.groupId ? ` (group: ${consumer.groupId})` : ''}`,
    );
    return consumer;
  }

  async subscribe(consumerId: string, topicName: string): Promise<void> {
    const [consumer, topic] = await Promise.all([
      this.findOne(consumerId),
      this.topicService.getOrCreate({ name: topicName }),
    ]);

    consumer.subscribe(topicName);
    topic.addConsumer();

    // Persist both updates in parallel — no reason to do them sequentially
    await Promise.all([
      this.persistence.updateConsumer(consumer),
      this.persistence.updateTopic(topic),
    ]);

    this.logger.log(`Consumer ${consumerId} subscribed to "${topicName}"`);
  }

  async unsubscribe(consumerId: string, topicName: string): Promise<void> {
    const consumer = await this.findOne(consumerId);

    if (!consumer.isSubscribedTo(topicName)) return; // idempotent — no error if not subscribed

    const topic = await this.persistence.getTopic(topicName);

    consumer.unsubscribe(topicName);

    await Promise.all([
      this.persistence.updateConsumer(consumer),
      topic
        ? (topic.removeConsumer(), this.persistence.updateTopic(topic))
        : Promise.resolve(),
    ]);

    this.logger.log(`Consumer ${consumerId} unsubscribed from "${topicName}"`);
  }

  async findOne(id: string): Promise<Consumer> {
    const consumer = await this.persistence.getConsumer(id);

    if (!consumer) {
      throw new NotFoundException(`Consumer "${id}" not found`);
    }

    return consumer;
  }

  async getSubscribersForTopic(topicName: string): Promise<Consumer[]> {
    return this.persistence.getConsumersByTopic(topicName);
  }

  // Returns one consumer per group for a topic — used in ROUND_ROBIN mode
  async getConsumerGroupsForTopic(
    topicName: string,
  ): Promise<Map<string, Consumer[]>> {
    const consumers = await this.getSubscribersForTopic(topicName);
    const groups = new Map<string, Consumer[]>();

    for (const consumer of consumers) {
      const key = consumer.groupId ?? consumer.id; // ungrouped consumers are their own group
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(consumer);
    }

    return groups;
  }

  async heartbeat(consumerId: string): Promise<void> {
    const consumer = await this.persistence.getConsumer(consumerId);
    if (!consumer) return;
    consumer.heartbeat();
    await this.persistence.updateConsumer(consumer);
  }

  async disconnect(consumerId: string): Promise<void> {
    const consumer = await this.persistence.getConsumer(consumerId);
    if (!consumer) return;

    // Unsubscribe from all topics and decrement their consumer counts
    const unsubscribeAll = consumer.subscriptions.map((topic) =>
      this.unsubscribe(consumerId, topic),
    );
    await Promise.all(unsubscribeAll);

    consumer.disconnect();
    await this.persistence.updateConsumer(consumer);

    this.logger.log(`Consumer disconnected: ${consumerId}`);
  }
}