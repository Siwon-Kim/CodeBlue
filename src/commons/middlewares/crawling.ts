import * as cheerio from 'cheerio';
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class Crawling {
  async getRealTimeHospitalsBeds(emogList: string[]) {
    const start: any = new Date();

    let url = `https://portal.nemc.or.kr:444/medi_info/dashboards/dash_total_emer_org_popup_for_egen.do?`;
    emogList.forEach((e) => {
      url += `&emogList=${e}`;
    });
    url += `&rltmEmerCd=O001&rltmCd=O038&rltmCd=O022&afterSearch=org&theme=WHITE&refreshTime=60&spreadAllMsg=allClose&searchYn=Y`;

    const results: string[] = [];

    await axios({
      url: url,
      method: 'GET',
      responseType: 'arraybuffer',
    }).then((response) => {
      const $ = cheerio.load(response.data);

      const time = $('#area_top_info > div:nth-child(1) > table > tbody > tr:nth-child(2) > td:nth-child(1)',);
      results.push(time.text().replace(/\s+/g, ' '));

      $('#area_dashboards').each((idx, element) => {
        const $data = cheerio.load(element);
        const emogList = $data('#area_dashboards > div > div.dash_header > div > span > input.emogcode',).val();
        const name = $data('#area_dashboards > div > div.dash_header > div > span > a',).text().replace(/\s+/g, ' ');
        const emergencyRoom = $data('#area_dashboards > div > div.dash_data > div:nth-child(2) > table > tbody > tr > td:nth-child(1) > div.data_data.emer_bed.data_td_O001 > span:nth-child(2)').text().replace(/\s+/g, ' ');
        const surgeryRoom = $data(`#rltmList_${idx} > table > tbody > tr > td:nth-child(2) > div.data_data.data_td_O022`).text().replace(/\s+/g, ' ');
        const ward = $data(`#rltmList_${idx} > table > tbody > tr > td:nth-child(1) > div.data_data.data_td_O038`).text().replace(/\s+/g, ' ');

        results.push(
          `${emogList} / ${name} Emergency Room: ${emergencyRoom}, Surgery Room: ${surgeryRoom}, Ward: ${ward}`,
        );
      });
    });

    const end: any = new Date();
    const t = end - start;
    console.log(`Crawling Execution Time : ${t}ms`);

    return results;
  }
}
