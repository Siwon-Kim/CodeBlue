import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Hospitals } from './hospitals.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

const DEFAULT_AVAILABLE_BEDS = 5;

@Injectable()
export class HospitalsRepository extends Repository<Hospitals> {
  constructor(private dataSource: DataSource) {
    super(Hospitals, dataSource.createEntityManager());
  }

  // query hospital info with hospital_id
  async findHospital(hospital_id: number): Promise<Hospitals> {
    const hospital = await this.query(
      `
        SELECT * FROM hospitals WHERE hospital_id = ${hospital_id}
      `,
    );
    return hospital[0];
  }

  // decrement available_beds by 1 for the hospital with hospital_id
  async decreaseAvailableBeds(hospital_id: number): Promise<void> {
    await this.query(
      `
        UPDATE hospitals SET available_beds = available_beds - 1 WHERE hospital_id = ${hospital_id};
      `,
    );
  }

  // increment available_beds by 1 for the hospital with hospital_id
  async increaseAvailableBeds(hospital_id: number): Promise<void> {
    await this.query(
      `
        UPDATE hospitals SET available_beds = available_beds + 1 WHERE hospital_id = ${hospital_id};
      `,
    );
  }

  // update available_beds to default value for the hospital with hospital_id
  @Cron(CronExpression.EVERY_HOUR)
  async setDefaultAvailableBeds(): Promise<void> {
    const beds = DEFAULT_AVAILABLE_BEDS;
    await this.query(
      `
        UPDATE hospitals SET available_beds = ${beds}
        WHERE available_beds != ${beds};
      `,
    );
  }

  // query hospitals within radius
  async getHospitalsWithinRadius(
    startLat: number,
    startLng: number,
    radius: number,
  ) {
    return await this.query(
      `
        SELECT hospital_id, name, address, phone, available_beds, latitude, longitude, emogList, ST_Distance_Sphere(Point(${startLng}, ${startLat}),
        point) as 'distance'
        FROM hospitals
        WHERE ST_Distance_Sphere(POINT(${startLng}, ${startLat}), point) < (${radius})
        order by distance;
      `,
    );
  }

  // query hospitals without radius
  async getHospitalsWithoutRadius(startLng: number, startLat: number) {
    return await this.query(
      `
          SELECT hospital_id, name, address, phone, available_beds, latitude, longitude, emogList, ST_Distance_Sphere(Point(${startLng}, ${startLat}),
          point) as 'distance'
          FROM hospitals
          order by distance;
      `,
    );
  }
}
