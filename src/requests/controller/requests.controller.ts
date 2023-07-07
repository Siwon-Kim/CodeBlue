import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Render,
  UseInterceptors,
} from '@nestjs/common';
import { RequestsService } from '../service/requests.service';
import { Logger } from '@nestjs/common';
import { Reports } from 'src/reports/reports.entity';
import { ClearCacheInterceptor } from '../../commons/interceptors/clear-cache.interceptor';

@Controller('request')
@UseInterceptors(ClearCacheInterceptor)
export class RequestsController {
  private logger = new Logger('RequestsController');
  constructor(private requestsService: RequestsService) {}

  // GET: all transfer registered symptom reports API
  @Get()
  getAllRequests(): Promise<Reports[]> {
    this.logger.verbose(
      'Getting all transfer registered symptom reports GET API',
    );
    return this.requestsService.getAllRequests();
  }

  // POST: request patient transfer to the hosptial API
  @Post('/:report_id/:hospital_id')
  sendRequest(
    @Param('report_id') report_id: number,
    @Param('hospital_id') hospital_id: number,
  ): Promise<object> {
    this.logger.verbose('Requesting patient transfer to the hosptial POST API');
    return this.requestsService.addToRequestQueue(report_id, hospital_id);
  }

  // DELETE: withdraw patient transfer request API
  @Delete('/:report_id')
  withdrawRequest(@Param('report_id') report_id: number): Promise<object> {
    this.logger.verbose('Withdrawing patient transfer request DELETE API');
    return this.requestsService.withdrawRequest(report_id);
  }

  // GET: search transfer registered symptom reports with keywords API
  @Get('/search')
  @Render('searchResult')
  async getSearchRequests(@Query() queries: object): Promise<object> {
    try {
      this.logger.verbose('Searching symptom reports GET API');
      const searchedData = await this.requestsService.getSearchRequests(
        queries,
      );
      return { searchedData };
    } catch (error) {
      return { searchedData: error };
    }
  }
}
