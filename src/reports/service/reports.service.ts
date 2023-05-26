import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ReportsRepository } from '../reports.repository';
import { Reports } from '../reports.entity';
import { UpdateReportDto } from '../dto/update-report.dto';

@Injectable()
export class ReportsService {
  constructor(private reportsRepository: ReportsRepository) {}

  async updatePatientLocation(
    report_id: number,
    updatedLocation: UpdateReportDto,
  ) {
    try {
      const { longitude, latitude } = updatedLocation;

      const report = await this.reportsRepository.findReport(report_id);

      if (!report) {
        throw new NotFoundException('증상 보고서가 존재하지 않습니다.');
      }

      return await this.reportsRepository.updatePatientLocation(
        report_id,
        longitude,
        latitude,
      );
    } catch (error) {
      console.log('error: ', error);
      throw new HttpException(
        error.response || '사용자 현재 위치 변경에 실패하였습니다.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
