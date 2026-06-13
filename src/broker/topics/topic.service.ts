import {
  Injectable,
  Logger,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PERSISTENCE_ADAPTER, IPersistenceAdapter } from '../persistence/persistence.interface';
import { Topic } from './topic.entity';
import { DeliveryMode } from '../../common/enums/message-type.enum';

interface CreateTopicDto {
  name: string;
  deliveryMode?: DeliveryMode;
  retentionMs?: number;
}

@Injectable()
export class TopicService {
  private readonly logger = new Logger(TopicService.name);

  constructor(
    @Inject(PERSISTENCE_ADAPTER)
    private readonly persistence: IPersistenceAdapter,
  ) {}

  async create(dto: CreateTopicDto): Promise<Topic> {
    const existing = await this.persistence.getTopic(dto.name);

    if (existing) {
      throw new ConflictException(`Topic "${dto.name}" already exists`);
    }

    const topic = new Topic({
      name: dto.name,
      deliveryMode: dto.deliveryMode,
      retentionMs: dto.retentionMs,
    });

    await this.persistence.saveTopic(topic);
    this.logger.log(`Topic created: "${dto.name}" [${topic.deliveryMode}]`);

    return topic;
  }

  // Get or auto-create — brokers typically create topics on first publish
  async getOrCreate(dto: CreateTopicDto): Promise<Topic> {
    const existing = await this.persistence.getTopic(dto.name);
    if (existing) return existing;
    return this.create(dto);
  }

  async findOne(name: string): Promise<Topic> {
    const topic = await this.persistence.getTopic(name);

    if (!topic) {
      throw new NotFoundException(`Topic "${name}" not found`);
    }

    return topic;
  }

  async findAll(): Promise<Topic[]> {
    return this.persistence.getAllTopics();
  }

  async delete(name: string): Promise<void> {
    await this.findOne(name); // throws if not found
    await this.persistence.deleteTopic(name);
    this.logger.log(`Topic deleted: "${name}"`);
  }

  async recordMessagePublished(topicName: string): Promise<void> {
    const topic = await this.findOne(topicName);
    topic.incrementMessageCount();
    await this.persistence.updateTopic(topic);
  }

  async recordMessageAcknowledged(topicName: string): Promise<void> {
    const topic = await this.persistence.getTopic(topicName);
    if (!topic) return;
    topic.decrementPending();
    await this.persistence.updateTopic(topic);
  }
}