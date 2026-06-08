import { MessageStatus, DeliveryMode } from '../enums/message-type.enum';

export interface IMessage {
  id: string;                    // uuid — unique identity for dedup/tracking
  topic: string;                 // which topic this belongs to
  payload: unknown;              // actual data — unknown forces consumers to validate
  producerId: string;            // who sent it
  status: MessageStatus;
  deliveryMode: DeliveryMode;
  
  createdAt: Date;
  deliveredAt?: Date;            // optional — only set when delivered
  acknowledgedAt?: Date;         // optional — only set when acked
  
  ttl?: number;                  // time-to-live in milliseconds
  expiresAt?: Date;              // computed from createdAt + ttl
  
  retryCount: number;            // how many delivery attempts so far
  maxRetries: number;            // give up after this many
  
  headers?: Record<string, string>; // metadata — like HTTP headers, for routing hints
}

export interface IConsumer {
  id: string;
  groupId?: string;              // consumer group — consumers in same group share load
  subscriptions: string[];       // list of topic names this consumer is watching
  connectedAt: Date;
  lastSeenAt: Date;
  isAlive: boolean;
}

export interface ITopic {
  name: string;                  // unique identifier, e.g. "orders.created"
  deliveryMode: DeliveryMode;
  createdAt: Date;
  messageCount: number;          // total messages ever published
  pendingCount: number;          // messages not yet acknowledged
  consumerCount: number;
  retentionMs: number;           // how long to keep messages (default: 24h)
}

export interface IQueue {
  topicName: string;             // queues belong to a topic
  consumerGroupId: string;       // one queue per consumer group per topic
  messages: IMessage[];
  cursor: number;                // position — which message to deliver next
}