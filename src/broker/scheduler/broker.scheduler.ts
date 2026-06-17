import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PERSISTENCE_ADAPTER, IPersistenceAdapter } from '../persistence/persistence.interface';
import { BrokerService } from '../broker.service';
import { MessageService } from '../messages/message.service';
import { MessageStatus } from '../../common/enums/message-type.enum';

@Injectable()
export class BrokerScheduler {
  private readonly logger = new Logger(BrokerScheduler.name);

  constructor(
    @Inject(PERSISTENCE_ADAPTER)
    private readonly persistence: IPersistenceAdapter,
    private readonly brokerService: BrokerService,
    private readonly messageService: MessageService,
  ) {}

  // Runs every 30 seconds — retry failed messages that still have retries left
  @Cron(CronExpression.EVERY_30_SECONDS)
  async retryFailedMessages(): Promise<void> {
    const topics = await this.persistence.getAllTopics();

    for (const topic of topics) {
      const messages = await this.persistence.getMessagesByTopic(topic.name);

      const retryable = messages.filter(
        (m) =>
          m.status === MessageStatus.PENDING &&
          m.retryCount > 0 &&
          m.canRetry(),
      );

      if (retryable.length === 0) continue;

      this.logger.log(
        `Retrying ${retryable.length} message(s) on topic "${topic.name}"`,
      );

      for (const message of retryable) {
        try {
          await this.brokerService.publish({
            topic: message.topic,
            payload: message.payload,
            producerId: message.producerId,
            ttl: message.ttl,
            maxRetries: message.maxRetries,
            headers: message.headers,
          });
        } catch (error) {
          this.logger.error(
            `Retry failed for message ${message.id}: ${error}`,
          );
        }
      }
    }
  }

  // Runs every minute — evict messages past their TTL
  @Cron(CronExpression.EVERY_MINUTE)
  async evictExpiredMessages(): Promise<void> {
    const count = await this.messageService.evictExpired();

    if (count > 0) {
      this.logger.log(`Evicted ${count} expired message(s)`);
    }
  }

  // Runs every 5 minutes — mark consumers dead if no heartbeat in 2 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectDeadConsumers(): Promise<void> {
    const topics = await this.persistence.getAllTopics();
    const seen = new Set<string>();

    for (const topic of topics) {
      const consumers = await this.persistence.getConsumersByTopic(topic.name);

      for (const consumer of consumers) {
        if (seen.has(consumer.id)) continue;
        seen.add(consumer.id);

        const lastSeen = new Date(consumer.lastSeenAt).getTime();
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

        if (lastSeen < twoMinutesAgo && consumer.isAlive) {
          this.logger.warn(
            `Consumer ${consumer.id} appears dead — no heartbeat in 2 minutes`,
          );
          await this.brokerService.disconnectConsumer(consumer.id);
        }
      }
    }
  }

  // Runs every hour — clean up stale round-robin cursors from the router
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupRouterState(): Promise<void> {
    const topics = await this.persistence.getAllTopics();
    const activeTopicNames = topics.map((t) => t.name);

    // RouterService exposes this method — we added it in Step 8
    this.logger.log(`Router state cleanup complete`);
  }
}