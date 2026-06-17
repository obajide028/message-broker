import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { BrokerService } from '../broker/broker.service';
import { Message } from '../broker/messages/message.entity';
import { MessageType } from '../common/enums/message-type.enum';
import { PublishDto } from 'src/common/dto/publish.dto';
import { SubscribeDto } from 'src/common/dto/subscribe.dto';
import { AcknowledgeDto } from 'src/common/dto/acknowledge.dto';
import { WsExceptionFilter } from 'src/common/filters/ws-exception.filter';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN ?? '*',
  },
  pingInterval: parseInt(process.env.WS_PING_INTERVAL ?? '25000', 10),
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT ?? '60000', 10),
})
export class BrokerGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BrokerGateway.name);

  constructor(private readonly brokerService: BrokerService) {}

  // Register the delivery callback once the module is ready
  onModuleInit(): void {
    this.brokerService.registerDeliveryCallback(
      async (consumerId: string, message: Message): Promise<boolean> => {
        return this.deliverToSocket(consumerId, message);
      },
    );
  }

  afterInit(server: Server): void {
    this.logger.log('WebSocket gateway initialized');
  }

  // ─── Connection lifecycle ─────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const groupId = client.handshake.query.groupId as string | undefined;

    try {
      await this.brokerService.registerConsumer({
        id: client.id,
        groupId,
      });

      this.logger.log(
        `Client connected: ${client.id}${groupId ? ` (group: ${groupId})` : ''}`,
      );

      client.emit(MessageType.PONG, {
        consumerId: client.id,
        message: 'Connected to broker',
      });
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      await this.brokerService.disconnectConsumer(client.id);
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error for ${client.id}: ${error}`);
    }
  }

  // ─── Message handlers ─────────────────────────────────────────

  @SubscribeMessage(MessageType.PUBLISH)
  async handlePublish(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PublishDto,
  ): Promise<void> {
    try {
      const result = await this.brokerService.publish({
        topic: data.topic,
        payload: data.payload,
        producerId: client.id,
        ttl: data.ttl,
        maxRetries: data.maxRetries,
        headers: data.headers,
      });

      // Confirm back to producer
      client.emit(MessageType.PONG, {
        messageId: result.message.id,
        deliveredTo: result.deliveredTo.length,
        topic: data.topic,
      });
    } catch (error) {
      client.emit(MessageType.ERROR, {
        event: MessageType.PUBLISH,
        error: (error as Error).message,
      });
    }
  }

  @SubscribeMessage(MessageType.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeDto,
  ): Promise<void> {
    try {
      await this.brokerService.subscribe(client.id, data.topic);

      client.emit(MessageType.PONG, {
        event: MessageType.SUBSCRIBE,
        topic: data.topic,
        message: `Subscribed to "${data.topic}"`,
      });
    } catch (error) {
      client.emit(MessageType.ERROR, {
        event: MessageType.SUBSCRIBE,
        error: (error as Error).message,
      });
    }
  }

  @SubscribeMessage(MessageType.UNSUBSCRIBE)
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeDto,
  ): Promise<void> {
    try {
      await this.brokerService.unsubscribe(client.id, data.topic);

      client.emit(MessageType.PONG, {
        event: MessageType.UNSUBSCRIBE,
        topic: data.topic,
        message: `Unsubscribed from "${data.topic}"`,
      });
    } catch (error) {
      client.emit(MessageType.ERROR, {
        event: MessageType.UNSUBSCRIBE,
        error: (error as Error).message,
      });
    }
  }

  @SubscribeMessage(MessageType.ACKNOWLEDGE)
  async handleAcknowledge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AcknowledgeDto,
  ): Promise<void> {
    try {
      await this.brokerService.acknowledge(data.messageId);

      client.emit(MessageType.PONG, {
        event: MessageType.ACKNOWLEDGE,
        messageId: data.messageId,
      });
    } catch (error) {
      client.emit(MessageType.ERROR, {
        event: MessageType.ACKNOWLEDGE,
        error: (error as Error).message,
      });
    }
  }

  @SubscribeMessage(MessageType.PING)
  async handlePing(@ConnectedSocket() client: Socket): Promise<void> {
    await this.brokerService.heartbeat(client.id);
    client.emit(MessageType.PONG, { ts: Date.now() });
  }

  // ─── Delivery ─────────────────────────────────────────────────

  private async deliverToSocket(
    consumerId: string,
    message: Message,
  ): Promise<boolean> {
    const socket = this.server.sockets.sockets.get(consumerId);

    if (!socket || !socket.connected) {
      this.logger.warn(
        `Cannot deliver to ${consumerId} — socket not found or disconnected`,
      );
      return false;
    }

    return new Promise((resolve) => {
      socket.emit(MessageType.DELIVER, message, (ack: unknown) => {
        // Socket.io acknowledgment — client confirms it received the emit
        // This is transport-level ack, separate from business-level ack
        resolve(ack === true);
      });

      // If client doesn't ack the transport within 5s, consider it failed
      setTimeout(() => resolve(false), 5000);
    });
  }
}