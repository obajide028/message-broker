import { describe, it, expect } from '@jest/globals';
import { Message } from '../message.entity';
import { DeliveryMode, MessageStatus } from '../../../common/enums/message-type.enum';
// import { describe, it } from 'node:test';

const makeMessage = (overrides = {}) =>
  new Message({
    topic: 'orders.created',
    payload: { orderId: 'ord_123' },
    producerId: 'producer-1',
    deliveryMode: DeliveryMode.FANOUT,
    ...overrides,
  });

describe('Message Entity', () => {
  describe('constructor', () => {
    it('should generate a unique id', () => {
      const a = makeMessage();
      const b = makeMessage();
      expect(a.id).toBeDefined();
      expect(a.id).not.toBe(b.id);
    });

    it('should default status to PENDING', () => {
      const message = makeMessage();
      expect(message.status).toBe(MessageStatus.PENDING);
    });

    it('should default retryCount to 0', () => {
      const message = makeMessage();
      expect(message.retryCount).toBe(0);
    });

    it('should default maxRetries to 3', () => {
      const message = makeMessage();
      expect(message.maxRetries).toBe(3);
    });

    it('should compute expiresAt when ttl is provided', () => {
      const before = Date.now();
      const message = makeMessage({ ttl: 5000 });
      const after = Date.now();

      expect(message.expiresAt).toBeDefined();
      expect(message.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 5000);
      expect(message.expiresAt!.getTime()).toBeLessThanOrEqual(after + 5000);
    });

    it('should not set expiresAt when no ttl', () => {
      const message = makeMessage();
      expect(message.expiresAt).toBeUndefined();
    });
  });

  describe('isExpired()', () => {
    it('should return false when no TTL set', () => {
      const message = makeMessage();
      expect(message.isExpired()).toBe(false);
    });

    it('should return false when TTL has not passed', () => {
      const message = makeMessage({ ttl: 60000 }); // 1 minute
      expect(message.isExpired()).toBe(false);
    });

    it('should return true when TTL has passed', () => {
      const message = makeMessage({ ttl: 1 });
      // Manually backdate expiresAt
      message.expiresAt = new Date(Date.now() - 1000);
      expect(message.isExpired()).toBe(true);
    });
  });

  describe('canRetry()', () => {
    it('should return true when retryCount is below maxRetries', () => {
      const message = makeMessage({ maxRetries: 3 });
      expect(message.canRetry()).toBe(true);
    });

    it('should return false when retryCount equals maxRetries', () => {
      const message = makeMessage({ maxRetries: 3 });
      message.retryCount = 3;
      expect(message.canRetry()).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('markDelivered should set status and deliveredAt', () => {
      const message = makeMessage();
      message.markDelivered();
      expect(message.status).toBe(MessageStatus.DELIVERED);
      expect(message.deliveredAt).toBeDefined();
    });

    it('markAcknowledged should set status and acknowledgedAt', () => {
      const message = makeMessage();
      message.markAcknowledged();
      expect(message.status).toBe(MessageStatus.ACKNOWLEDGED);
      expect(message.acknowledgedAt).toBeDefined();
    });

    it('markFailed should set status to FAILED', () => {
      const message = makeMessage();
      message.markFailed();
      expect(message.status).toBe(MessageStatus.FAILED);
    });

    it('incrementRetry should increase retryCount by 1', () => {
      const message = makeMessage();
      message.incrementRetry();
      message.incrementRetry();
      expect(message.retryCount).toBe(2);
    });
  });
});