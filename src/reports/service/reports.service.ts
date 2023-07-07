import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ReportsRepository } from '../reports.repository';
import { PatientsRepository } from '../../patients/patients.repository';
import { CreateReportDto } from '../dto/create-report.dto';
import { UpdateReportDto } from '../dto/update-report.dto';
import { EntityManager } from 'typeorm';
import axios from 'axios';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Gender } from '../../patients/patients.enum';
import appConfig from '../../../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Patients } from '../../patients/patients.entity';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly patientsRepository: PatientsRepository,
    @InjectEntityManager() private readonly entityManager: EntityManager, // 트랜젝션을 위해 DI
    @Inject(appConfig.KEY) private config: ConfigType<typeof appConfig>,
  ) {}

  // POST: create symptom report API
  async createReport(
    createReportDto: CreateReportDto,
    patient_rrn: string,
    name: string,
  ): Promise<object> {
    try {
      return await this.entityManager.transaction(
        'READ COMMITTED',
        async () => {
          // when patient SSN is passed together, save patient's info in Patients table
          if (patient_rrn) {
            const patient = await this.patientsRepository.findByRRN(
              patient_rrn,
            );
            let patientId: number;

            // if there is no existing patient with patient_rrn
            if (!patient) {
              // get gender through provided patient_rrn
              const gender = await this.getGender(patient_rrn);

              let newPatient: Patients;

              // if patient's name delivered together, save name as well
              if (name) {
                newPatient = await this.patientsRepository.createPatientInfo({
                  patient_rrn,
                  gender,
                  name,
                });
              }
              // if only patient_rrn delivered (without name)
              else {
                newPatient = await this.patientsRepository.createPatientInfo({
                  patient_rrn,
                  gender,
                });
              }
              patientId = newPatient.patient_id;
            }
            // if there is already existing patient with patient_rrn
            else {
              patientId = patient.patient_id;

              if (name) {
                await this.patientsRepository.updatePatientInfo(patientId, {
                  name,
                });
              }
            }

            createReportDto.patient_id = patientId;
          }

          // save report in Reports table
          const { symptoms } = createReportDto;

          // call symptom severity prediction AI server to get emergency level
          const emergencyLevel = await this.callAIServerForEmergencyLevel(
            symptoms,
          );
          createReportDto.symptom_level = emergencyLevel;

          return this.reportsRepository.createReport(createReportDto);
        },
      );
    } catch (error) {
      throw new HttpException(
        error.response || 'Failed to create symptom report.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET: detailed symptom report API
  async getReportDetails(report_id: number): Promise<object> {
    const report = await this.reportsRepository.findReport(report_id);
    if (!report) {
      throw new NotFoundException('Symptom report provided does not exist.');
    }

    let result: object;
    // patient and hospital info not found
    if (!report.hospital_id && !report.patient_id) {
      result = report;
    }
    // patient info only
    else if (!report.hospital_id && report.patient_id) {
      result = await this.reportsRepository.getReportwithPatientInfo(report_id);
    }
    // hospital info only
    else if (report.hospital_id && !report.patient_id) {
      result = await this.reportsRepository.getReportwithHospitalInfo(
        report_id,
      );
    }
    // patient and hospital info both exist
    else {
      result = await this.reportsRepository.getReportwithPatientAndHospitalInfo(
        report_id,
      );
    }

    return result;
  }

  // PATCH: update symptom report API
  async updateReport(
    report_id: number,
    updateReportDto: UpdateReportDto,
  ): Promise<object> {
    try {
      const report = await this.reportsRepository.findReport(report_id);
      if (!report) {
        throw new NotFoundException('Symptom report provided does not exist.');
      }

      // if symptoms sentence is changed, get another emergency level
      if (updateReportDto.symptoms) {
        const emergencyLevel = await this.callAIServerForEmergencyLevel(
          updateReportDto.symptoms,
        );
        updateReportDto.symptom_level = emergencyLevel;
      }

      return this.reportsRepository.updateReport(report_id, updateReportDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update symptom report.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Method: get emergency level through AI server that predicts the severity through the symptom sentence provided
  async callAIServerForEmergencyLevel(symptoms: string) {
    const emergencyLevelApiResponse = await axios.get(this.config.aiServerUrl, {
      params: {
        sentence: symptoms,
      },
    });

    return emergencyLevelApiResponse.data.emergency_level;
  }

  // Method: get gender through the patient SSN provided
  async getGender(patient_rrn: string): Promise<Gender> {
    return patient_rrn[7] === '1' || patient_rrn[7] === '3'
      ? Gender.M
      : patient_rrn[7] === '2' || patient_rrn[7] === '4'
      ? Gender.F
      : null;
  }
}
