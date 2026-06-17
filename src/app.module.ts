import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrokerModule } from './broker/broker.module';
import { TransportModule } from './transport/transport.module';
import { ManagementModule } from './management/management.module';
import { ScheduleModule } from '@nestjs/schedule';
import brokerConfig from './config/broker.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere without re-importing
      load:[brokerConfig],
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(), 
    BrokerModule,
    TransportModule,
    ManagementModule,
  ],
})
export class AppModule {}