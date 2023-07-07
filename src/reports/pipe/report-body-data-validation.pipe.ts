import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ReportBodyValidationPipe implements PipeTransform {
  transform(value: any): object {
    if (value.blood_pressure) {
      // check blood pressure format (e.g. 130/80)
      const bloodPressureRegex = /^\d{2,3}\/\d{2,3}$/;

      if (!bloodPressureRegex.test(value.blood_pressure)) {
        throw new BadRequestException(
          'The blood pressure format provided is incorrect (e.g. 130/80)',
        );
      }
    }

    return value;
  }
}
