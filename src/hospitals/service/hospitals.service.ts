import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HospitalsRepository } from '../hospitals.repository';
import { ReportsRepository } from '../../reports/reports.repository';
import { Crawling } from '../../commons/middlewares/crawling';
import { KakaoMapService } from '../../commons/providers/kakao-map.provider';
import { InjectEntityManager } from '@nestjs/typeorm'; // for transaction
import { EntityManager } from 'typeorm'; // for transaction

@Injectable()
export class HospitalsService {
  constructor(
    private hospitalsRepository: HospitalsRepository,
    private reportsRepository: ReportsRepository,
    private crawling: Crawling,
    private kakaoMapService: KakaoMapService,
    @InjectEntityManager() private readonly entityManager: EntityManager, // DI for transaction
  ) {}

  // GET: Recommended hospitals and real-time available beds for each hospital API
  async getRecommendedHospitals(
    report_id: number,
    queries: object,
  ): Promise<object> {
    try {
      return await this.entityManager.transaction(
        'READ COMMITTED',
        async () => {
          const report = await this.reportsRepository.findReport(report_id);
          if (!report) {
            throw new NotFoundException(`${report_id} does not exist.`);
          }

          const startLat = parseFloat(queries['latitude']);
          const startLng = parseFloat(queries['longitude']);

          let dataSource = [];
          let hospitals = [];
          let radius: number;
          const max_count = queries['max_count']
            ? parseInt(queries['max_count'])
            : 20;

          // get recommended hospitals based on the user's location from DB
          if (queries['radius']) {
            radius = parseInt(queries['radius']) * 1000; // radius in meters
            dataSource =
              await this.hospitalsRepository.getHospitalsWithinRadius(
                startLat,
                startLng,
                radius,
              );
          } else {
            dataSource =
              await this.hospitalsRepository.getHospitalsWithoutRadius(
                startLng,
                startLat,
              );
          }

          if (dataSource.length === 0) {
            throw new NotFoundException(
              'No available hospitals within radius.',
            );
          }

          hospitals = Object.entries(dataSource);

          if (max_count < hospitals.length) {
            hospitals = hospitals.slice(0, max_count); // get the number of hospitals that the user customized
          }

          // Kakao mobility API for getting duration between the current location and the hospital by car (Parallel Processing)
          const promises = hospitals.map(async (hospital) => {
            const endLat = hospital[1]['latitude'];
            const endLng = hospital[1]['longitude'];

            const result = await this.kakaoMapService.getDrivingResult(
              startLat,
              startLng,
              endLat,
              endLng,
            );

            const duration = result['duration'];
            const distance = result['distance'];

            if (!duration || !distance) {
              throw new NotFoundException('Unreachable location provided.');
            }

            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);

            const obj = {
              duration,
              minutes: `${minutes}m`,
              seconds: `${seconds}s`,
              distance: (distance / 1000).toFixed(1),
              hospital_id: hospital[1]['hospital_id'],
              name: hospital[1]['name'],
              phone: hospital[1]['phone'],
              available_beds: hospital[1]['available_beds'],
              emogList: hospital[1]['emogList'],
            };
            return obj;
          });

          // waiting for all parallel processing completed and save into the variable
          let recommendedHospitals = await Promise.all(promises);

          // when the distance provided by KaKao Mobility is longer than the distance provided by ST_Distance_Sphere
          // ST_Distance_Sphere is more accurate than KaKao Mobility
          if (queries['radius']) {
            recommendedHospitals = recommendedHospitals.filter(
              (hospital) => parseFloat(hospital['distance']) * 1000 <= radius,
            );
          }

          // applying weights considering travel time and available bed capacity
          const weightsRecommendedHospitals = [];

          for (const hospital of recommendedHospitals) {
            const maxDuration = Math.max(
              ...recommendedHospitals.map((hospital) => hospital.duration),
            );
            const maxAvailable_beds = Math.max(
              ...recommendedHospitals.map(
                (hospital) => hospital.available_beds,
              ),
            );
            const rating = await this.calculateRating(
              hospital,
              maxDuration,
              maxAvailable_beds,
            );
            hospital['rating'] = rating;
            weightsRecommendedHospitals.push(hospital);
          }

          // shortest distance hospitals sorted by duration (unit: seconds)
          weightsRecommendedHospitals.sort((a, b) => b.rating - a.rating);

          // crawling real-time available beds information
          const emogList = [];
          for (const hospital of weightsRecommendedHospitals) {
            emogList.push(hospital['emogList']);
          }
          const datas = await this.crawling.getRealTimeHospitalsBeds(emogList);
          const results: Array<string | object> = await Promise.all(
            weightsRecommendedHospitals.map(async (hospital) => {
              const result = { ...hospital, report_id };
              for (const data of datas) {
                if (data.slice(0, 8) === hospital.emogList) {
                  const beds_object = await this.parseHospitalData(data);
                  result['real_time_beds_info'] = beds_object;
                }
              }
              return result;
            }),
          );

          // data inserted for the use of FE
          const selectedHospital = report.hospital_id
            ? await this.hospitalsRepository.findHospital(report.hospital_id)
            : null;
          results.unshift(selectedHospital); // selected hospital information - index 2
          results.unshift(report); // symptom report content - index 1
          results.unshift(datas[0]); // timeline when crawling executed - index 0

          return results;
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        error.response.data ||
          'Failed to get recommended hospitals information.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET: Nearby hospitals information API
  async getNearbyHospitals(queries: object): Promise<object> {
    const startLat = parseFloat(queries['latitude']);
    const startLng = parseFloat(queries['longitude']);

    let dataSource = [];
    let hospitals = [];

    const radius = 20 * 1000; // radius in meters

    if (startLat && startLng) {
      dataSource = await this.hospitalsRepository.getHospitalsWithinRadius(
        startLat,
        startLng,
        radius,
      );
    } else {
      dataSource = await this.hospitalsRepository.getHospitalsWithinRadius(
        37.56615,
        126.97814,
        radius,
      );
    }

    hospitals = Object.entries(dataSource);

    const datas = hospitals.map((data) => {
      const obj = {
        name: data[1]['name'],
        address: data[1]['address'],
        phone: data[1]['phone'],
        distance: data[1]['distance'],
      };
      return obj;
    });

    return datas;
  }

  // Method: calculate weights considering travel time and available bed capacity
  async calculateRating(
    hospital: any,
    maxDuration: number,
    maxAvailable_beds: number,
  ): Promise<number> {
    const weights = {
      duration: 0.98,
      available_beds: 0.02,
    };
    const durationWeight = weights.duration; // 98%
    const available_bedsWeight = weights.available_beds; // 2%

    //duration = a lower value corresponds to a higher score
    const durationScore = 1 - hospital.duration / maxDuration;

    //available_beds = a higher value corresponds to a higher score
    const available_bedsScore = hospital.available_beds / maxAvailable_beds;
    const rating =
      durationWeight * durationScore +
      available_bedsWeight * available_bedsScore;
    return rating;
  }

  // Method: parsing crawling data
  async parseHospitalData(data: string): Promise<object> {
    const emergencyRoomRegex = /Emergency Room:\s*(\d+(?:\s\/\s\d+)?)/;
    const surgeryRoomRegex = /Surgery Room:\s*(\d+(?:\s\/\s\d+)?)/;
    const wardRegex = /Ward:\s*(\d+(?:\s\/\s\d+)?)/;
    const emergencyRoom = data.match(emergencyRoomRegex);
    const surgeryRoom = data.match(surgeryRoomRegex);
    const ward = data.match(wardRegex);
    return {
      emergencyRoom: emergencyRoom ? emergencyRoom[1] : 'N/A',
      surgeryRoom: surgeryRoom ? surgeryRoom[1] : 'N/A',
      ward: ward ? ward[1] : 'N/A',
    };
  }
}
