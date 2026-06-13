import { Module } from '@nestjs/common';
import { BrokerModule } from '../broker/broker.module';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';

@Module({
  imports: [BrokerModule],
  controllers: [ManagementController],
  providers: [ManagementService],
})
export class ManagementModule {}