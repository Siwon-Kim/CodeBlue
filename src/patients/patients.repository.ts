import { Injectable } from '@nestjs/common';
import { Patients } from './patients.entity';
import { Repository, DataSource } from 'typeorm';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsRepository extends Repository<Patients> {
  constructor(private dataSource: DataSource) {
    super(Patients, dataSource.createEntityManager());
  }

  // query patient's information with patient_id
  async findPatient(patient_id: number): Promise<Patients | undefined> {
    return await this.findOne({
      where: { patient_id },
    });
  }

  // create a row for a new patient
  async createPatientInfo(
    createPatientInfo: CreatePatientDto,
  ): Promise<Patients> {
    const { patient_rrn, name, gender } = createPatientInfo;
    const patient = this.create({
      patient_rrn: patient_rrn,
      name,
      gender,
    });

    return this.save(patient);
  }

  // modify information of existing patient
  async updatePatientInfo(
    patient_id: number,
    updatedPatient: UpdatePatientDto,
  ): Promise<Patients> {
    const patient = await this.findOne({
      where: { patient_id },
    });

    for (const field in updatedPatient) {
      if (updatedPatient.hasOwnProperty(field)) {
        patient[field] = updatedPatient[field];
      }
    }

    return await patient.save();
  }

  // query patient through the patient's SSN which is an unique value for each patient
  async findByRRN(patient_rrn: string): Promise<Patients | undefined> {
    return await this.findOne({
      where: { patient_rrn },
    });
  }
}
