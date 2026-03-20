import { Global, Module } from '@nestjs/common';
import { ImageGenerationService } from './image-generation.service.js';

@Global()
@Module({
  providers: [ImageGenerationService],
  exports: [ImageGenerationService],
})
export class ImageGenerationModule {}
