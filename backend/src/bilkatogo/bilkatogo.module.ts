import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShoppingListModule } from '../shopping-list/shopping-list.module.js';
import { BilkaToGoAuthService } from './bilkatogo-auth.service.js';
import { BilkaToGoSearchService } from './bilkatogo-search.service.js';
import { BilkaToGoCartService } from './bilkatogo-cart.service.js';
import { BilkaToGoOrchestratorService } from './bilkatogo-orchestrator.service.js';
import { BilkaToGoController } from './bilkatogo.controller.js';

@Module({
  imports: [HttpModule, ShoppingListModule],
  controllers: [BilkaToGoController],
  providers: [
    BilkaToGoAuthService,
    BilkaToGoSearchService,
    BilkaToGoCartService,
    BilkaToGoOrchestratorService,
  ],
})
export class BilkaToGoModule {}
