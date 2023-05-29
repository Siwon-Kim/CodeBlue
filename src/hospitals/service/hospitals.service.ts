import { Injectable } from '@nestjs/common';
import { HospitalsRepository } from '../hospitals.repository';
import { crawl } from 'src/commons/middlewares/crawl';
import { KakaoMapService } from 'src/commons/utils/kakao-map.service';
import { MedicalOpenAPI } from 'src/commons/middlewares/medicalOpenAPI';

@Injectable()
export class HospitalsService {
  constructor(
      private hospitalsRepository: HospitalsRepository,
      private openAPI: MedicalOpenAPI,
    ) {}

  getHospitals() {
    return this.hospitalsRepository.getHospitals();
  }

  // 크롤링 미들웨어 실행 (string[], 메디서비스 기반)
  getNearByHospitals() {
    /*
      지역 옵션 선택
      매개변수 site에 아래 지역 중 하나가 들어옵니다.
      서울특별시 / 경기도 / 강원도 / 광주광역시 / 대구광역시
      대전광역시 / 부산광역시 / 울산광역시 / 인천광역시 / 경상남도
      경상북도 / 세종특별자치시 / 전라남도 / 전라북도 / 제주특별자치도
      충청남도 / 충청북도
    */
    let site = '경기도'; // 여기에 지역명이 들어가며, 지역리스트는 미들웨어를 참고해주세요.
    const results = crawl(site);
    return results;
  }

  // 전국 데이터 조회 (JSON, 공공데이터 API 기반)
  getNationHospitals() {
    const results = this.openAPI.getMedicalData();
    return results;
  }
}
