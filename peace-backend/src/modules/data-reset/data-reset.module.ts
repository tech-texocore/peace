import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { DataResetController } from './data-reset.controller';
import { DataResetService } from './data-reset.service';

@Module({
  imports: [MastersModule],
  controllers: [DataResetController],
  providers: [DataResetService],
})
export class DataResetModule {}
