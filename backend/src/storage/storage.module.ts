import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';

@Module({
  providers: [],
  exports: [],
})
export class StorageModule {}

export { FileStorageService };
