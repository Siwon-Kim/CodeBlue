import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class RrnValidationPipe implements PipeTransform {
  transform(value: any): object {
    if (value) {
      // check patient SSN format
      const rrnRegex = /^\d{6}-\d{7}$/;

      if (!rrnRegex.test(value)) {
        throw new BadRequestException(
          "Patient's SSN format is incorrect (e.g. 000101-1111111)",
        );
      }
    }

    return value;
  }
}
