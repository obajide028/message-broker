import { Injectable, Logger } from '@nestjs/common';
import { Consumer } from 'src/broker/consumers/consumer.entity';
import { ConsumerService } from 'src/broker/consumers/consumer.service';
import { Message } from 'src/broker/messages/message.entity';
import { DeliveryMode } from 'src/common/enums/message-type.enum';

export interface DeliveryTarget {
  consumer: Consumer;
  message: Message;
}

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  // Tracks which consumer is next in rotation per topic+group
  // Key: `${topicName}:${groupId}`
  private readonly roundRobinCursors = new Map<string, number>();

  constructor(private readonly consumerService: ConsumerService) {}

  async resolve(message: Message): Promise<DeliveryTarget[]> {
    if (message.isExpired()) {
      this.logger.warn(`Message ${message.id} expired — skipping routing`);
      return [];
    }

    if (message.deliveryMode === DeliveryMode.FANOUT) {
      return this.resolveFanout(message);
    }

    return this.resolveRoundRobin(message);
  }

  // FANOUT: every subscriber gets a copy
  private async resolveFanout(message: Message): Promise<DeliveryTarget[]> {
    const consumers = await this.consumerService.getSubscribersForTopic(
      message.topic,
    );

    if (consumers.length === 0) {
      this.logger.warn(
        `No consumers for topic "${message.topic}" — message ${message.id} will be retained`,
      );
      return [];
    }

    this.logger.log(
      `FANOUT: routing message ${message.id} to ${consumers.length} consumer(s)`,
    );

    return consumers.map((consumer) => ({ consumer, message }));
  }

  // ROUND_ROBIN: one consumer per group gets the message
  private async resolveRoundRobin(message: Message): Promise<DeliveryTarget[]> {
    const groups = await this.consumerService.getConsumerGroupsForTopic(
      message.topic,
    );

    if (groups.size === 0) {
      this.logger.warn(
        `No consumer groups for topic "${message.topic}" — message ${message.id} retained`,
      );
      return [];
    }

    const targets: DeliveryTarget[] = [];

    for (const [groupId, groupConsumers] of groups) {
      const consumer = this.pickConsumer(message.topic, groupId, groupConsumers);

      if (consumer) {
        targets.push({ consumer, message });
      }
    }

    this.logger.log(
      `ROUND_ROBIN: routing message ${message.id} to ${targets.length} group(s)`,
    );

    return targets;
  }

  // Pick the next alive consumer in a group using cursor-based round robin
  private pickConsumer(
    topic: string,
    groupId: string,
    consumers: Consumer[],
  ): Consumer | null {
    const alive = consumers.filter((c) => c.isAlive);

    if (alive.length === 0) return null;

    const key = `${topic}:${groupId}`;
    const cursor = this.roundRobinCursors.get(key) ?? 0;
    const index = cursor % alive.length;
    
    // Advance cursor for next time
    this.roundRobinCursors.set(key, index + 1);

    return alive[index];
  }

  // Clean up cursors for topics that no longer have consumers
  // Call this periodically to prevent memory leak
  cleanupCursors(activeTopics: string[]): void {
    for (const key of this.roundRobinCursors.keys()) {
      const topic = key.split(':')[0];
      if (!activeTopics.includes(topic)) {
        this.roundRobinCursors.delete(key);
      }
    }
  }
}