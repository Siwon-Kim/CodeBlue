import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HospitalsRepository } from './../../hospitals/hospitals.repository';
import { ReportsRepository } from '../../reports/reports.repository';
import { EntityManager, Brackets } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Reports } from '../../reports/reports.entity';
import * as date from 'date-and-time';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgeRange } from 'src/reports/reports.enum';

@Injectable()
export class RequestsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly hospitalsRepository: HospitalsRepository,
    private readonly eventEmitter: EventEmitter2, // eventEmitter DI
    @InjectEntityManager() private readonly entityManager: EntityManager, // 트랜젝션 DI
    @InjectQueue('requestQueue') private requestQueue: Queue, // bullqueue DI
  ) {}

  // GET: all transfer registered symptom reports API
  async getAllRequests(): Promise<Reports[]> {
    return await this.reportsRepository.getAllRequests();
  }

  // GET: search transfer registered symptom reports with keywords API - Keywords: date, symptom, emergency level, patient name, hospital region
  async getSearchRequests(queries: object): Promise<Reports[]> {
    try {
      const query = this.reportsRepository
        .createQueryBuilder('reports')
        .leftJoinAndSelect('reports.hospital', 'hospital')
        .leftJoinAndSelect('reports.patient', 'patient')
        .select([
          'reports.report_id',
          'reports.symptoms',
          'reports.createdAt',
          'reports.symptom_level',
          'patient.name',
          'reports.age_range',
          'hospital.name',
          'hospital.phone',
          'hospital.emogList',
          'hospital.address',
        ])
        .where('reports.hospital_id > 0');

      //----------------------------[Date]----------------------------------//
      switch (true) {
        case Boolean(queries['fromDate'] && queries['toDate']): {
          const rawFromDate: string = queries['fromDate'];
          const rawToDate: string = queries['toDate'];
          if (rawFromDate && rawToDate) {
            if (rawFromDate > rawToDate) {
              throw new NotFoundException(
                'Please double-check the range of the date provided.',
              );
            }
            const transFromDate = new Date(rawFromDate);
            let transToDate = new Date(rawToDate);
            transToDate = date.addHours(transToDate, 23);
            transToDate = date.addMinutes(transToDate, 59);
            transToDate = date.addSeconds(transToDate, 59);
            const fromDate: string = date.format(
              transFromDate,
              'YYYY-MM-DD HH:mm:ss',
              true,
            );
            const toDate: string = date.format(
              transToDate,
              'YYYY-MM-DD HH:mm:ss',
              true,
            );
            query.andWhere(
              new Brackets((qb) => {
                qb.andWhere('reports.createdAt BETWEEN :a AND :b', {
                  a: `${fromDate}`,
                  b: `${toDate}`,
                });
              }),
            );
          } else {
            throw new NotFoundException(
              'Cannot find the date. Please check the format of the date provided.',
            );
          }
          break;
        }
        case Boolean(queries['fromDate']): {
          // Only when fromDate provided in URL query (e.g. from 2023.06.10 00:00:00)
          const fromDate: string = queries['fromDate'];
          query.andWhere(
            new Brackets((qb) => {
              qb.andWhere('reports.createdAt > :date', {
                date: `${fromDate}`,
              });
            }),
          );
          break;
        }
        case Boolean(queries['toDate']): {
          // Only when toDate provided in URL query (e.g. before 2023.06.10 23:59:59)
          const rawToDate: string = queries['toDate'];
          let transToDate: Date = new Date(rawToDate);
          transToDate = date.addHours(transToDate, 23);
          transToDate = date.addMinutes(transToDate, 59);
          transToDate = date.addSeconds(transToDate, 59);
          const toDate: string = date.format(
            transToDate,
            'YYYY-MM-DD HH:mm:ss',
            true,
          );
          query.andWhere(
            new Brackets((qb) => {
              qb.andWhere('reports.createdAt < :date', {
                date: `${toDate}`,
              });
            }),
          );
          break;
        }
        default: {
          break;
        }
      }

      //----------------------------[symptoms]----------------------------------//
      if (queries['symptoms']) {
        // when symptoms provided in URL query
        const symptoms: string[] = queries['symptoms'];
        symptoms.forEach((symptom: string, idx: number) => {
          query.andWhere('reports.symptoms LIKE :symp' + idx, {
            ['symp' + idx]: `%${symptom}%`,
          });
        });
      }

      //----------------------------[symptom_level]----------------------------------//
      if (queries['symptom_level']) {
        // when symptom_level provided in URL query (1~5)
        const level: number = parseInt(queries['symptom_level']);
        query
          .andWhere('reports.hospital_id > 0')
          .andWhere('reports.symptom_level = :level', {
            level: `${level}`,
          });
      }

      //------------------------------[site]--------------------------------//
      if (queries['site']) {
        // when site provided in URL query
        const site: string = queries['site'].toString();
        query.andWhere('hospital.address LIKE :site', {
          site: `%${site}%`,
        });
      }

      //-----------------------------[patient-name]---------------------------------//
      if (queries['name']) {
        // when name provided in URL query
        const name: string = queries['name'].toString();
        query.andWhere('patient.name = :name', {
          name: `${name}`,
        });
      }

      //-------------------------[age_range]-------------------------------------//
      if (queries['age_range']) {
        // when age_range provided in URL query
        const age_range: AgeRange = queries['age_range'];
        query.andWhere('reports.age_range = :age_range', {
          age_range: `${age_range}`,
        });
      }
      //--------------------------------------------------------------//

      const allReports: Reports[] = await query.getRawMany();

      return allReports;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new HttpException(
          error.response || 'Failed to search symptom reports.',
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  // POST: request patient transfer to the hosptial API
  // 1. add transfer request job in request queue
  async addToRequestQueue(
    report_id: number,
    hospital_id: number,
  ): Promise<object> {
    // before adding to queue, validate report_id and hospital_id
    const hospital = await this.hospitalsRepository.findHospital(hospital_id);
    if (!hospital) {
      throw new NotFoundException('No such hospital exists.');
    }

    const report = await this.reportsRepository.findReport(report_id);
    if (!report) {
      throw new NotFoundException('No such symptom report exists.');
    }

    // create eventName for each transfer request
    const eventName = `Request-${report_id}-${
      Math.floor(Math.random() * 89999) + 1
    }`;
    console.log('1. creating eventName - ', eventName);

    // add event with report_id and hospital_id to requestQueue
    console.log('2. adding job to requestQueue');
    await this.requestQueue.add(
      'addToRequestQueue',
      { report_id, hospital_id, eventName },
      {
        removeOnComplete: true,
        removeOnFail: true,
        priority: this.getPriority(report), // set priority based on symptom_level and age_range
      },
    );

    // after adding to queue, wait for the job to be completed by passing job to waitingForJobCompleted()
    console.log('3. calling waitingForJobCompleted()');
    return this.waitingForJobCompleted(eventName, 2, hospital); // 2 = time
  }

  // 2. wait until the business logic (sendRequest()) is completed and return the result
  async waitingForJobCompleted(
    eventName: string,
    time: number,
    hospital: object,
  ): Promise<object> {
    console.log('4. entering waitingForJobCompleted()');
    return new Promise((resolve, reject) => {
      console.log('5. entering Promise');

      // 1. execute callback function after time seconds
      // setTimeout() is set to 2 seconds
      const wait = setTimeout(() => {
        console.log('** entering setTimeout()');
        this.eventEmitter.removeAllListeners(eventName);
        resolve({
          message: 'Please try again',
        });
      }, time * 1000); // return failed message if business logic is not completed after 2 seconds

      // 2. with wait, set event listener for eventName
      const listeningCallback = ({
        success,
        exception,
      }: {
        success: boolean;
        exception?: HttpException;
      }) => {
        console.log('7. entering listeningCallback');
        clearTimeout(wait); // remove setTimeout()
        this.eventEmitter.removeAllListeners(eventName); // remove all listners registered for this event
        success ? resolve({ hospital }) : reject(exception); // if business logic is successful, resolve, else reject
      };

      // 3. whether business logic is successful or not, sendRequest() will emit an event with eventName
      console.log('6. setting this.eventEmitter.addListener');
      // waitingForJobCompleted()'s event listener will listen to the event with eventName, and respond accordingly
      this.eventEmitter.addListener(eventName, listeningCallback); // 이벤트 리스너 등록
    });
  }

  // 3. method to execute business logic for the transfer request
  async sendRequest(
    report_id: number,
    hospital_id: number,
    eventName: string,
  ): Promise<boolean> {
    console.log('*2 entering sendRequest');
    try {
      const hospital = await this.hospitalsRepository.findHospital(hospital_id);
      const available_beds = hospital.available_beds;
      if (available_beds === 0) {
        throw new HttpException(
          'Hospital transfer requests are now closed. Please consider applying to another hospital.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const report = await this.reportsRepository.findReport(report_id);
      if (report.is_sent) {
        throw new HttpException(
          'The report has been already sent.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // add hospital_id to symptom report row
      await this.reportsRepository.addTargetHospital(report_id, hospital_id);

      // decrement available_beds by 1
      await this.hospitalsRepository.decreaseAvailableBeds(hospital_id);

      // change is_sent of the report to true
      await this.reportsRepository.updateReportBeingSent(report_id);

      // notify business logic is completed to event listener
      return this.eventEmitter.emit(eventName, { success: true });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // notify business logic is failed to event listener
      return this.eventEmitter.emit(eventName, {
        success: false,
        exception: error,
      });
    }
  }

  // DELETE: withdraw patient transfer request API
  async withdrawRequest(report_id: number): Promise<object> {
    try {
      return await this.entityManager.transaction('SERIALIZABLE', async () => {
        const report = await this.reportsRepository.findReport(report_id);
        if (!report) {
          throw new NotFoundException('No such symptom report exists.');
        }
        if (!report.is_sent) {
          throw new HttpException(
            'Symptom report has not requested patient transfer to a hospital. Please request patient transfer first.',
            HttpStatus.BAD_REQUEST,
          );
        }

        const hospital_id = report.hospital_id;

        // remove hospital_id from symptom report
        await this.reportsRepository.deleteTargetHospital(report_id);

        // increase available_beds by 1
        await this.hospitalsRepository.increaseAvailableBeds(hospital_id);

        // change is_sent of the report to false
        await this.reportsRepository.updateReportBeingNotSent(report_id);

        return await this.reportsRepository.getReportwithPatientInfo(report_id);
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        error.response || 'Failed to withdraw patient transfer request.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Method: get priority of the job based on symptom_level and age_range
  getPriority = (report: Reports): number => {
    const { symptom_level, age_range } = report;

    const ageRangeMap: { [key: string]: number } = {
      'Pregnant Woman': 1,
      Infant: 2,
      Elderly: 3,
      Adolescent: 4,
      Adult: 5,
    };

    // if symptom_level value is higher, the priority is lower (1, 2, 3, ... - integer) => 1 is the highest
    return !age_range ? symptom_level : symptom_level * ageRangeMap[age_range];
  };

  // Method: bullqueue UI dashboard
  getRequestQueueForBoard(): Queue {
    return this.requestQueue;
  }
}
