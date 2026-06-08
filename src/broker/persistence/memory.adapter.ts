import { Injectable, Logger } from '@nestjs/common';
import { IPersistenceAdapter } from './persistence.interface';
import { Message } from '../messages/message.entity';
import { Topic } from '../topics/topic.entity';
import { Consumer } from '../consumers/consumer.entity';

@Injectable()
export class MemoryAdapter implements IPersistenceAdapter {
  private readonly logger = new Logger(MemoryAdapter.name);

  // Three Maps — one per entity type. Key is always the unique identifier.
  private readonly messages = new Map<string, Message>();
  private readonly topics = new Map<string, Topic>();
  private readonly consumers = new Map<string, Consumer>();

  // ─── Messages ────────────────────────────────────────────────

  async saveMessage(message: Message): Promise<void> {
    this.messages.set(message.id, message);
  }

  async getMessage(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async getMessagesByTopic(topic: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (m) => m.topic === topic,
    );
  }

  async updateMessage(message: Message): Promise<void> {
    if (!this.messages.has(message.id)) {
      this.logger.warn(`updateMessage: message ${message.id} not found`);
      return;
    }
    this.messages.set(message.id, message);
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async deleteExpiredMessages(): Promise<number> {
    let count = 0;
    for (const [id, message] of this.messages) {
      if (message.isExpired()) {
        this.messages.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(`Evicted ${count} expired messages`);
    }
    return count;
  }

  // ─── Topics ──────────────────────────────────────────────────

  async saveTopic(topic: Topic): Promise<void> {
    this.topics.set(topic.name, topic);
  }

  async getTopic(name: string): Promise<Topic | null> {
    return this.topics.get(name) ?? null;
  }

  async getAllTopics(): Promise<Topic[]> {
    return Array.from(this.topics.values());
  }

  async updateTopic(topic: Topic): Promise<void> {
    this.topics.set(topic.name, topic);
  }

  async deleteTopic(name: string): Promise<void> {
    this.topics.delete(name);
  }

  // ─── Consumers ───────────────────────────────────────────────

  async saveConsumer(consumer: Consumer): Promise<void> {
    this.consumers.set(consumer.id, consumer);
  }

  async getConsumer(id: string): Promise<Consumer | null> {
    return this.consumers.get(id) ?? null;
  }

  async getConsumersByTopic(topic: string): Promise<Consumer[]> {
    return Array.from(this.consumers.values()).filter(
      (c) => c.isAlive && c.isSubscribedTo(topic),
    );
  }

  async updateConsumer(consumer: Consumer): Promise<void> {
    this.consumers.set(consumer.id, consumer);
  }

  async deleteConsumer(id: string): Promise<void> {
    this.consumers.delete(id);
  }
}