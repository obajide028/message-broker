import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PERSISTENCE_ADAPTER } from './persistence.interface';
import { MemoryAdapter } from './memory.adapter';
import { FileAdapter } from './file.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    MemoryAdapter,
    FileAdapter,
    {
      provide: PERSISTENCE_ADAPTER,
      useFactory: (config: ConfigService) => {
        const adapter = config.get<string>('PERSISTENCE_ADAPTER', 'memory');
        return adapter === 'file' ? new FileAdapter() : new MemoryAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PERSISTENCE_ADAPTER],
})
export class PersistenceModule {}