import { Repository, DataSource } from 'typeorm';
import { Reports } from './reports.entity';
import { Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsRepository extends Repository<Reports> {
  constructor(private dataSource: DataSource) {
    super(Reports, dataSource.createEntityManager());
  }

  // create symptom report
  async createReport(createReportDto: CreateReportDto): Promise<Reports> {
    const { ...createReportDtoWithOutPatient } = createReportDto;
    const report = this.create({
      ...createReportDtoWithOutPatient,
    });
    return this.save(report);
  }

  // query detailed symptom report (report + patient info)
  async getReportwithPatientInfo(report_id: number): Promise<object> {
    const report = await this.query(
      `
          SELECT
            r.report_id,
            r.symptom_level,
            r.symptoms,
            r.blood_pressure,
            r.age_range,
            r.is_sent,
            r.createdAt,
            r.updatedAt,
            r.hospital_id,
            p.name AS patient_name,
            p.patient_rrn,
            p.gender
          FROM reports r
          LEFT JOIN patients p ON r.patient_id = p.patient_id
          WHERE r.report_id = ${report_id};      
        `,
    );
    return report[0];
  }

  // query detailed symptom report (report + hospital info)
  async getReportwithHospitalInfo(report_id: number): Promise<object> {
    const result = await this.query(
      `
          SELECT
            r.report_id,
            r.symptom_level,
            r.symptoms,
            r.blood_pressure,
            r.age_range,
            r.is_sent,
            r.createdAt,
            r.updatedAt,
            r.hospital_id,
            h.name AS hospital_name,
            h.address,
            h.phone
          FROM reports r
          LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
          WHERE r.report_id = ${report_id};      
        `,
    );
    return result[0];
  }

  // query detailed symptom report (report + patient info + hospital info)
  async getReportwithPatientAndHospitalInfo(
    report_id: number,
  ): Promise<object> {
    const result = await this.query(
      `
          SELECT
            r.report_id,
            p.name AS patient_name,
            p.patient_rrn,
            p.gender,
            r.symptom_level,
            r.symptoms,
            r.blood_pressure,
            r.age_range,
            r.is_sent,
            r.createdAt,
            r.updatedAt,
            r.hospital_id,
            h.name AS hospital_name,
            h.address,
            h.phone
          FROM reports r
          LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
          LEFT JOIN patients p ON r.patient_id = p.patient_id
          WHERE r.report_id = ${report_id};      
        `,
    );
    return result[0];
  }

  // query symptom report with report_id
  async findReport(report_id: number): Promise<Reports | undefined> {
    return await this.findOne({
      where: { report_id },
    });
  }

  // update symptom report with report_id
  async updateReport(
    report_id: number,
    updatedReport: UpdateReportDto,
  ): Promise<Reports> {
    const report = await this.findOne({
      where: { report_id },
    });

    // get each field of updatedReport and put it into report
    for (const field in updatedReport) {
      if (updatedReport.hasOwnProperty(field)) {
        report[field] = updatedReport[field];
      }
    }

    return await report.save();
  }

  // update is_sent = true (request patient transfer to hospital)
  async updateReportBeingSent(report_id: number): Promise<Reports> {
    const report = await this.findOne({
      where: { report_id },
    });
    report.is_sent = true;
    return await report.save();
  }

  // update is_sent = false (withdraw patient transfer to hospital)
  async updateReportBeingNotSent(report_id: number): Promise<Reports> {
    const report = await this.findOne({
      where: { report_id },
    });
    report.is_sent = false;
    return await report.save();
  }

  // query all transferred symptom reports
  async getAllRequests(): Promise<Reports[]> {
    return await this.find({ where: { is_sent: true } });
  }

  // update hospital_id of symptom report (request patient transfer to hospital)
  async addTargetHospital(
    report_id: number,
    hospital_id: number,
  ): Promise<void> {
    const report = await this.findOne({
      where: { report_id },
    });

    report.hospital_id = hospital_id;
    await report.save();
  }

  // update hospital_id of symptom report to null (withdraw patient transfer to hospital)
  async deleteTargetHospital(report_id: number): Promise<void> {
    const report = await this.findOne({
      where: { report_id },
    });

    report.hospital_id = null;
    await report.save();
  }

  // add patient_id in symptom report
  async addPatientIdInReport(
    report_id: number,
    patient_id: number,
  ): Promise<void> {
    const report = await this.findOne({ where: { report_id } });
    report.patient_id = patient_id;
    await this.save(report);
  }
}
