import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module';
import { TopicService } from './topics/topic.service';
import { ConsumerService } from './consumers/consumer.service';
import { MessageService } from './messages/message.service';
import { RouterService } from 'src/router/router.service';
import { BrokerService } from './broker.service';

@Module({
  imports: [PersistenceModule],
  providers: [
    TopicService, 
    ConsumerService,
    MessageService,
    RouterService,
    BrokerService,
  ],
  exports: [
    BrokerService, PersistenceModule, TopicService, ConsumerService, MessageService
  ],
})
export class BrokerModule {}