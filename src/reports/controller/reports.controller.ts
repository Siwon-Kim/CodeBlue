import {
  Controller,
  Get,
  Param,
  Body,
  Post,
  Patch,
  Render,
} from '@nestjs/common';
import { ReportsService } from '../service/reports.service';
import { Logger } from '@nestjs/common';
import { Reports } from '../reports.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { UpdateReportDto } from '../dto/update-report.dto';
import { ReportBodyValidationPipe } from '../pipe/report-body-data-validation.pipe';
import { RrnValidationPipe } from '../pipe/rrn-validation.pipe';

@Controller('report')
export class ReportsController {
  private logger = new Logger('ReportsController');
  constructor(private readonly reportsService: ReportsService) {}

  // POST: create symptom report API
  @Post()
  createReport(
    @Body('patient_rrn', new RrnValidationPipe()) patient_rrn: string,
    @Body('name') name: string,
    @Body(new ReportBodyValidationPipe()) createReportDto: CreateReportDto,
  ): Promise<Partial<Reports>> {
    this.logger.verbose('creating symptom report POST API');
    return this.reportsService.createReport(createReportDto, patient_rrn, name);
  }

  // GET: detailed symptom report API
  @Get('/:report_id')
  @Render('reportDetail')
  async getReportDetails(
    @Param('report_id') reportId: number,
  ): Promise<object> {
    this.logger.verbose('Getting detailed symptom report GET API');
    const reportDetails = await this.reportsService.getReportDetails(reportId);
    return { reportDetails };
  }

  // PATCH: update symptom report API
  @Patch('/:report_id')
  async updateReport(
    @Param('report_id') report_id: number,
    @Body(new ReportBodyValidationPipe()) updatedReport: UpdateReportDto,
  ): Promise<Partial<Reports>> {
    this.logger.verbose('Updating symptom report PATCH API');
    return await this.reportsService.updateReport(report_id, updatedReport);
  }
}
