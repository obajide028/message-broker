import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ManagementService } from './management.service';
import { BrokerService } from '../broker/broker.service';
import { DeliveryMode } from '../common/enums/message-type.enum';

interface CreateTopicBody {
  name: string;
  deliveryMode?: DeliveryMode;
  retentionMs?: number;
}

@Controller('api')
export class ManagementController {
  constructor(
    private readonly managementService: ManagementService,
    private readonly brokerService: BrokerService,
  ) {}

  // GET /api/health
  @Get('health')
  async health() {
    return this.managementService.getHealth();
  }

  // GET /api/overview
  @Get('overview')
  async overview() {
    return this.managementService.getOverview();
  }

  // GET /api/topics
  @Get('topics')
  async getTopics() {
    return this.brokerService.getTopics();
  }

  // POST /api/topics
  @Post('topics')
  async createTopic(@Body() body: CreateTopicBody) {
    return this.managementService.createTopic(body);
  }

  // GET /api/topics/:name
  @Get('topics/:name')
  async getTopic(@Param('name') name: string) {
    const detail = await this.managementService.getTopicDetail(name);

    if (!detail) {
      throw new NotFoundException(`Topic "${name}" not found`);
    }

    return detail;
  }

  // DELETE /api/topics/:name
  @Delete('topics/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTopic(@Param('name') name: string) {
    await this.brokerService.deleteTopic(name);}
}