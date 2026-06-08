import { Message } from '../messages/message.entity';
import { Topic } from '../topics/topic.entity';
import { Consumer } from '../consumers/consumer.entity';

export interface IPersistenceAdapter {
  // ---------- Messages ----------
  saveMessage(message: Message): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  getMessagesByTopic(topic: string): Promise<Message[]>;
  updateMessage(message: Message): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  deleteExpiredMessages(): Promise<number>; // returns count deleted

  // ---------- Topics ----------
  saveTopic(topic: Topic): Promise<void>;
  getTopic(name: string): Promise<Topic | null>;
  getAllTopics(): Promise<Topic[]>;
  updateTopic(topic: Topic): Promise<void>;
  deleteTopic(name: string): Promise<void>;

  // ---------- Consumers ----------
  saveConsumer(consumer: Consumer): Promise<void>;
  getConsumer(id: string): Promise<Consumer | null>;
  getConsumersByTopic(topic: string): Promise<Consumer[]>;
  updateConsumer(consumer: Consumer): Promise<void>;
  deleteConsumer(id: string): Promise<void>;
}

// Token used for NestJS dependency injection
export const PERSISTENCE_ADAPTER = 'PERSISTENCE_ADAPTER';