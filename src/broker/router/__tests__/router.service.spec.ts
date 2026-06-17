import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerService } from '../../consumers/consumer.service';
import { Message } from '../../messages/message.entity';
import { Consumer } from '../../consumers/consumer.entity';
import { DeliveryMode } from '../../../common/enums/message-type.enum';
import { RouterService } from '../router.service';

// Build a real Message instance
const makeMessage = (mode: DeliveryMode, overrides = {}) =>
  new Message({
    topic: 'orders.created',
    payload: { orderId: 'ord_1' },
    producerId: 'producer-1',
    deliveryMode: mode,
    ...overrides,
  });

// Build a real Consumer instance
const makeConsumer = (id: string, groupId?: string): Consumer => {
  const c = new Consumer({ id, groupId });
  c.subscribe('orders.created');
  return c;
};

describe('RouterService', () => {
  let router: RouterService;
  let consumerService: jest.Mocked<ConsumerService>;

  beforeEach(async () => {
    // Mock ConsumerService — we don't want real DB calls in unit tests
    const mockConsumerService = {
      getSubscribersForTopic: jest.fn(),
      getConsumerGroupsForTopic: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouterService,
        { provide: ConsumerService, useValue: mockConsumerService },
      ],
    }).compile();

    router = module.get<RouterService>(RouterService);
    consumerService = module.get(ConsumerService);
  });

  describe('FANOUT mode', () => {
    it('should deliver to all subscribers', async () => {
      const consumers = [
        makeConsumer('c-1'),
        makeConsumer('c-2'),
        makeConsumer('c-3'),
      ];
      consumerService.getSubscribersForTopic.mockResolvedValue(consumers);

      const message = makeMessage(DeliveryMode.FANOUT);
      const targets = await router.resolve(message);

      expect(targets).toHaveLength(3);
      expect(targets.map((t) => t.consumer.id)).toEqual(['c-1', 'c-2', 'c-3']);
    });

    it('should return empty array when no subscribers', async () => {
      consumerService.getSubscribersForTopic.mockResolvedValue([]);

      const message = makeMessage(DeliveryMode.FANOUT);
      const targets = await router.resolve(message);

      expect(targets).toHaveLength(0);
    });
  });

  describe('ROUND_ROBIN mode', () => {
    it('should deliver to one consumer per group', async () => {
      const groups = new Map([
        ['group-a', [makeConsumer('c-1', 'group-a'), makeConsumer('c-2', 'group-a')]],
        ['group-b', [makeConsumer('c-3', 'group-b')]],
      ]);
      consumerService.getConsumerGroupsForTopic.mockResolvedValue(groups);

      const message = makeMessage(DeliveryMode.ROUND_ROBIN);
      const targets = await router.resolve(message);

      // One per group = 2 targets total
      expect(targets).toHaveLength(2);
    });

    it('should rotate consumers across successive messages', async () => {
      const consumers = [
        makeConsumer('c-1', 'group-a'),
        makeConsumer('c-2', 'group-a'),
      ];
      const groups = new Map([['group-a', consumers]]);
      consumerService.getConsumerGroupsForTopic.mockResolvedValue(groups);

      const msg1 = makeMessage(DeliveryMode.ROUND_ROBIN);
      const msg2 = makeMessage(DeliveryMode.ROUND_ROBIN);

      const [target1] = await router.resolve(msg1);
      const [target2] = await router.resolve(msg2);

      // Should alternate between c-1 and c-2
      expect(target1.consumer.id).not.toBe(target2.consumer.id);
    });

    it('should skip dead consumers', async () => {
      const alive = makeConsumer('c-1', 'group-a');
      const dead = makeConsumer('c-2', 'group-a');
      dead.disconnect(); // mark as dead

      const groups = new Map([['group-a', [dead]]]);
      consumerService.getConsumerGroupsForTopic.mockResolvedValue(groups);

      const message = makeMessage(DeliveryMode.ROUND_ROBIN);
      const targets = await router.resolve(message);

      expect(targets).toHaveLength(0);
    });
  });

  describe('expired messages', () => {
    it('should skip routing for expired messages', async () => {
      const message = makeMessage(DeliveryMode.FANOUT, { ttl: 1 });
      message.expiresAt = new Date(Date.now() - 1000); // already expired

      const targets = await router.resolve(message);

      expect(targets).toHaveLength(0);
      expect(consumerService.getSubscribersForTopic).not.toHaveBeenCalled();
    });
  });
});