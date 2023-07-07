import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsEnum,
} from 'class-validator';
import { Gender } from '../patients.enum';

export class CreatePatientDto {
  @IsString()
  @Length(14, 14) // patient SSN (e.g. 123456-1234567)
  @IsNotEmpty()
  patient_rrn: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
