import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ReportsRepository } from '../../reports/reports.repository';
import { PatientsRepository } from '../patients.repository';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { Patients } from '../patients.entity';
import { UpdatePatientDto } from '../dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepository: PatientsRepository,
    private readonly reportsRepository: ReportsRepository,
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {}

  // POST: create patient's information API
  async createPatientInfo(
    report_id: number,
    createPatientInfo: CreatePatientDto,
  ): Promise<Patients> {
    try {
      return await this.entityManager.transaction(
        'READ COMMITTED',
        async () => {
          const report = await this.reportsRepository.findReport(report_id);
          if (!report) {
            throw new NotFoundException(
              'Symptom report provided does not exist.',
            );
          }
          // create new patient row
          const createdPatient =
            await this.patientsRepository.createPatientInfo(createPatientInfo);

          const patient_id = createdPatient.patient_id;

          // add patient_id in report row of Reports table
          await this.reportsRepository.addPatientIdInReport(
            report_id,
            patient_id,
          );

          return createdPatient;
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        "Failed to create patient's information.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // PATCH: update patient's information API
  async updatePatientInfo(
    patient_id: number,
    updatedPatient: UpdatePatientDto,
  ): Promise<Patients> {
    try {
      const report = await this.patientsRepository.findPatient(patient_id);
      if (!report) {
        throw new NotFoundException('Symptom report provided does not exist.');
      }
      return this.patientsRepository.updatePatientInfo(
        patient_id,
        updatedPatient,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        "Failed to update patient's information.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
