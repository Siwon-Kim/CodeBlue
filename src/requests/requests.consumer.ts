import { RequestsService } from './service/requests.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

// Consumer deals with jobs in the queue
@Processor('requestQueue')
export class RequestQueueConsumer {
  constructor(private readonly requestsService: RequestsService) {}

  // queue detects when a job is added to the queue,
  // and takes the jobs in the queue as FIFO (First In First Out) and passes them to the sendRequest() function
  @Process('addToRequestQueue')
  async handleAddToRequestQueue(job: Job): Promise<boolean> {
    console.log('*1 entering handleAddRequestQueue()');
    console.log(`Handling job - ${job.data}`);

    // pass job to the business logic performing method
    return await this.requestsService.sendRequest(
      job.data.report_id,
      job.data.hospital_id,
      job.data.eventName,
    );
  }
}
