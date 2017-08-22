import { Pipe, PipeTransform } from '@angular/core';
import { Data } from './data';
import { DataService } from './data.service';

@Pipe({ name: 'freq' })
export class FreqPipe implements PipeTransform {
  constructor(private dataService: DataService) {}

  // used in templates like: freq_n | freq:config.freqs
  transform(freq_n: number, data: Data): string {
    let hz = this.dataService.constants.hz_labels;
    let r: string = null;
    if (! data) {
      r = '[no data specified]';
    } else if (data.freqs.range) {
      let range = data.freqs.range;
      let f = +range[0] + freq_n * +range[2];
      let s = range[2].toString();
      let i = s.indexOf('.');
      let n = i > -1 ? s.length - i - 1 : 0;
      r = `${f.toFixed(n)}${hz[data.freqs.exp]}`;
      if (data.rdsNames && data.rdsNames[freq_n]) r += ` (${data.rdsNames[freq_n]})`;
    } else if (data.freqs.freqs) {
      let freq = data.freqs.freqs[freq_n];
      r = `${freq.f}${hz[freq.exp]}`;
      if (data.rdsNames && data.rdsNames[freq_n]) r += ` (${data.rdsNames[freq_n]})`;
    } else {
      r = '[no frequency config found]';
    }
    return r;
  }
}
