import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Gender } from '../patients.enum';

@Injectable()
export class PatientBodyValidationPipe implements PipeTransform {
  transform(value: any): object {
    const rrnRegex = /^\d{6}-\d{7}$/;

    // Check patient's SSN format
    if (value.patient_rnn) {
      if (!rrnRegex.test(value.patient_rrn)) {
        throw new BadRequestException(
          "Patient's SSN format is incorrect (e.g. 000101-1111111)",
        );
      }

      if (value.patient_rrn) {
        const rrn = value.patient_rrn;
        const gender =
          rrn[7] === '1' || rrn[7] === '3'
            ? Gender.M
            : rrn[7] === '2' || rrn[7] === '4'
            ? Gender.F
            : null;

        return {
          ...value,
          gender,
        };
      } else {
        return value;
      }
    } else {
      return value;
    }
  }
}
