import { BloodType, Gender } from '../reports.enum';

export class PatientInfoDTO {
  name: string;
  gender: Gender;
  age: number;
  blood_type: BloodType;
  symptoms: string[];
  latitude: number;
  longitude: number;
  hospital_id: number;
  symptom_level: number;
}
