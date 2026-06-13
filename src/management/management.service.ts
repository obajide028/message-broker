import { Injectable, Inject } from '@nestjs/common';
import { PERSISTENCE_ADAPTER, IPersistenceAdapter } from '../broker/persistence/persistence.interface';
import { BrokerService } from '../broker/broker.service';
import { DeliveryMode, MessageStatus } from '../common/enums/message-type.enum';

@Injectable()
export class ManagementService {
  constructor(
    private readonly brokerService: BrokerService,
    @Inject(PERSISTENCE_ADAPTER)
    private readonly persistence: IPersistenceAdapter,
  ) {}

  async getOverview() {
    const topics = await this.persistence.getAllTopics();

    const overview = await Promise.all(
      topics.map(async (topic) => {
        const messages = await this.persistence.getMessagesByTopic(topic.name);
        const consumers = await this.persistence.getConsumersByTopic(topic.name);

        return {
          topic: topic.name,
          deliveryMode: topic.deliveryMode,
          createdAt: topic.createdAt,
          retentionMs: topic.retentionMs,
          stats: {
            totalMessages: topic.messageCount,
            pending: messages.filter(
              (m) => m.status === MessageStatus.PENDING,
            ).length,
            delivered: messages.filter(
              (m) => m.status === MessageStatus.DELIVERED,
            ).length,
            acknowledged: messages.filter(
              (m) => m.status === MessageStatus.ACKNOWLEDGED,
            ).length,
            failed: messages.filter(
              (m) => m.status === MessageStatus.FAILED,
            ).length,
          },
          consumers: consumers.length,
        };
      }),
    );

    return {
      totalTopics: topics.length,
      topics: overview,
    };
  }

  async getTopicDetail(topicName: string) {
    const [topic, messages, consumers] = await Promise.all([
      this.persistence.getTopic(topicName),
      this.persistence.getMessagesByTopic(topicName),
      this.persistence.getConsumersByTopic(topicName),
    ]);

    if (!topic) return null;

    return {
      topic,
      messages: messages.slice(-50), // last 50 messages
      consumers: consumers.map((c) => ({
        id: c.id,
        groupId: c.groupId,
        subscriptions: c.subscriptions,
        connectedAt: c.connectedAt,
        lastSeenAt: c.lastSeenAt,
        isAlive: c.isAlive,
      })),
    };
  }

  async createTopic(params: {
    name: string;
    deliveryMode?: DeliveryMode;
    retentionMs?: number;
  }) {
    return this.brokerService.createTopic(params);
  }

  async getHealth() {
    const topics = await this.persistence.getAllTopics();
    const allMessages = await Promise.all(
      topics.map((t) => this.persistence.getMessagesByTopic(t.name)),
    );

    const flat = allMessages.flat();

    return {
      status: 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      topics: topics.length,
      totalMessages: flat.length,
      failedMessages: flat.filter((m) => m.status === MessageStatus.FAILED)
        .length,
    };
  }
}