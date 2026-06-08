import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IPersistenceAdapter } from './persistence.interface';
import { Message } from '../messages/message.entity';
import { Topic } from '../topics/topic.entity';
import { Consumer } from '../consumers/consumer.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileAdapter implements IPersistenceAdapter, OnModuleInit {
  private readonly logger = new Logger(FileAdapter.name);
  private readonly dataDir = path.join(process.cwd(), '.broker-data');

  private readonly paths = {
    messages: path.join(this.dataDir, 'messages.json'),
    topics: path.join(this.dataDir, 'topics.json'),
    consumers: path.join(this.dataDir, 'consumers.json'),
  };

  // In-memory cache — reads are fast, writes flush to disk
  private messages = new Map<string, Message>();
  private topics = new Map<string, Topic>();
  private consumers = new Map<string, Consumer>();

  // OnModuleInit runs once when NestJS finishes bootstrapping this module
  async onModuleInit(): Promise<void> {
    await this.ensureDataDir();
    await this.loadFromDisk();
    this.logger.log(`File adapter ready. Data dir: ${this.dataDir}`);
  }

  private async ensureDataDir(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  private async loadFromDisk(): Promise<void> {
    this.messages = await this.readFile<Message>(this.paths.messages);
    this.topics = await this.readFile<Topic>(this.paths.topics);
    this.consumers = await this.readFile<Consumer>(this.paths.consumers);
  }

  private async readFile<T>(filePath: string): Promise<Map<string, T>> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const entries: [string, T][] = JSON.parse(raw);
      return new Map(entries);
    } catch {
      // File doesn't exist yet — start empty
      return new Map<string, T>();
    }
  }

  private async flushFile(
    filePath: string,
    data: Map<string, unknown>,
  ): Promise<void> {
    const entries = Array.from(data.entries());
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  // ─── Messages ────────────────────────────────────────────────

  async saveMessage(message: Message): Promise<void> {
    this.messages.set(message.id, message);
    await this.flushFile(this.paths.messages, this.messages as Map<string, unknown>);
  }

  async getMessage(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async getMessagesByTopic(topic: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter((m) => m.topic === topic);
  }

  async updateMessage(message: Message): Promise<void> {
    this.messages.set(message.id, message);
    await this.flushFile(this.paths.messages, this.messages as Map<string, unknown>);
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
    await this.flushFile(this.paths.messages, this.messages as Map<string, unknown>);
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
      await this.flushFile(this.paths.messages, this.messages as Map<string, unknown>);
      this.logger.log(`Evicted ${count} expired messages`);
    }
    return count;
  }

  // ─── Topics ──────────────────────────────────────────────────

  async saveTopic(topic: Topic): Promise<void> {
    this.topics.set(topic.name, topic);
    await this.flushFile(this.paths.topics, this.topics as Map<string, unknown>);
  }

  async getTopic(name: string): Promise<Topic | null> {
    return this.topics.get(name) ?? null;
  }

  async getAllTopics(): Promise<Topic[]> {
    return Array.from(this.topics.values());
  }

  async updateTopic(topic: Topic): Promise<void> {
    this.topics.set(topic.name, topic);
    await this.flushFile(this.paths.topics, this.topics as Map<string, unknown>);
  }

  async deleteTopic(name: string): Promise<void> {
    this.topics.delete(name);
    await this.flushFile(this.paths.topics, this.topics as Map<string, unknown>);
  }

  // ─── Consumers ───────────────────────────────────────────────

  async saveConsumer(consumer: Consumer): Promise<void> {
    this.consumers.set(consumer.id, consumer);
    await this.flushFile(this.paths.consumers, this.consumers as Map<string, unknown>);
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
    await this.flushFile(this.paths.consumers, this.consumers as Map<string, unknown>);
  }

  async deleteConsumer(id: string): Promise<void> {
    this.consumers.delete(id);
    await this.flushFile(this.paths.consumers, this.consumers as Map<string, unknown>);
  }
}