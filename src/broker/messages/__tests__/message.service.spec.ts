import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessageService } from '../message.service';
import { TopicService } from '../../topics/topic.service';
import { PERSISTENCE_ADAPTER } from '../../persistence/persistence.interface';
import { Topic } from '../../topics/topic.entity';
import { Message } from '../message.entity';
import { DeliveryMode, MessageStatus } from '../../../common/enums/message-type.enum';

const makeTopic = () =>
  new Topic({ name: 'orders.created', deliveryMode: DeliveryMode.FANOUT });

describe('MessageService', () => {
  let service: MessageService;
  let persistence: Record<string, jest.Mock>;
  let topicService: jest.Mocked<TopicService>;

  beforeEach(async () => {
    persistence = {
      saveMessage: jest.fn().mockResolvedValue(undefined),
      getMessage: jest.fn(),
      getMessagesByTopic: jest.fn().mockResolvedValue([]),
      updateMessage: jest.fn().mockResolvedValue(undefined),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      deleteExpiredMessages: jest.fn().mockResolvedValue(0),
    };

    const mockTopicService = {
      getOrCreate: jest.fn().mockResolvedValue(makeTopic()),
      recordMessagePublished: jest.fn().mockResolvedValue(undefined),
      recordMessageAcknowledged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PERSISTENCE_ADAPTER, useValue: persistence },
        { provide: TopicService, useValue: mockTopicService },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    topicService = module.get(TopicService);
  });

  describe('publish()', () => {
    it('should create and persist a message', async () => {
      const message = await service.publish({
        topic: 'orders.created',
        payload: { orderId: 'ord_1' },
        producerId: 'producer-1',
      });

      expect(message.id).toBeDefined();
      expect(message.topic).toBe('orders.created');
      expect(message.status).toBe(MessageStatus.PENDING);
      expect(persistence.saveMessage).toHaveBeenCalledWith(message);
    });

    it('should call recordMessagePublished on the topic', async () => {
      await service.publish({
        topic: 'orders.created',
        payload: {},
        producerId: 'p-1',
      });

      expect(topicService.recordMessagePublished).toHaveBeenCalledWith(
        'orders.created',
      );
    });
  });

  describe('acknowledge()', () => {
    it('should mark message as acknowledged', async () => {
      const message = new Message({
        topic: 'orders.created',
        payload: {},
        producerId: 'p-1',
        deliveryMode: DeliveryMode.FANOUT,
      });

      persistence.getMessage.mockResolvedValue(message);

      const result = await service.acknowledge(message.id);

      expect(result.status).toBe(MessageStatus.ACKNOWLEDGED);
      expect(result.acknowledgedAt).toBeDefined();
      expect(persistence.updateMessage).toHaveBeenCalledWith(result);
    });

    it('should throw NotFoundException for unknown message', async () => {
      persistence.getMessage.mockResolvedValue(null);

      await expect(service.acknowledge('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleDeliveryFailure()', () => {
    it('should increment retry count', async () => {
      const message = new Message({
        topic: 'orders.created',
        payload: {},
        producerId: 'p-1',
        deliveryMode: DeliveryMode.FANOUT,
        maxRetries: 3,
      });

      persistence.getMessage.mockResolvedValue(message);

      const result = await service.handleDeliveryFailure(message.id);

      expect(result.retryCount).toBe(1);
      expect(result.status).toBe(MessageStatus.PENDING);
    });

    it('should mark as FAILED when retries exhausted', async () => {
      const message = new Message({
        topic: 'orders.created',
        payload: {},
        producerId: 'p-1',
        deliveryMode: DeliveryMode.FANOUT,
        maxRetries: 1,
      });
      message.retryCount = 1; // already used the one retry

      persistence.getMessage.mockResolvedValue(message);

      const result = await service.handleDeliveryFailure(message.id);

      expect(result.status).toBe(MessageStatus.FAILED);
    });
  });
});