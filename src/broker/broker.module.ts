import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence/persistence.module';
import { TopicService } from './topics/topic.service';
import { ConsumerService } from './consumers/consumer.service';
import { MessageService } from './messages/message.service';
import { BrokerService } from './broker.service';
import { BrokerScheduler } from './scheduler/broker.scheduler';
import { RouterService } from './router/router.service';

@Module({
  imports: [PersistenceModule],
  providers: [
    TopicService, 
    ConsumerService,
    MessageService,
    RouterService,
    BrokerService,
    BrokerScheduler
  ],
  exports: [
    BrokerService, PersistenceModule]
})
export class BrokerModule {}