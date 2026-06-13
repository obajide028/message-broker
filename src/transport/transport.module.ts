import { Module } from "@nestjs/common";
import { BrokerModule } from "src/broker/broker.module";
import { BrokerGateway } from "./broker.gateway";




@Module({  imports: [BrokerModule],
  providers: [BrokerGateway],
  // providers: [AppService],
})
export class TransportModule {}