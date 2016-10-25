import { Pipe, PipeTransform } from '@angular/core';
import { Data } from './data';
import { HZ_LABELS } from './constants';

@Pipe({ name: 'freq' })
export class FreqPipe implements PipeTransform {
  // used in templates like: freq_n | freq:config.freqs
  transform(freq_n: number, data: Data): string {
    let r: string = null;
    if (! data) {
      r = '[no data specified]';
    } else if (data.freqs.range) {
      let range = data.freqs.range;
      let f = +range[0] + freq_n * +range[2];
      let s = range[2].toString();
      let i = s.indexOf('.');
      let n = i > -1 ? s.length - i - 1 : 0;
      r = `${f.toFixed(n)}${HZ_LABELS[data.freqs.exp]}`;
      if (data.rdsNames && data.rdsNames[freq_n]) r += ` (${data.rdsNames[freq_n]})`;
    } else if (data.freqs.freqs) {
      let freq = data.freqs.freqs[freq_n];
      r = `${freq.f}${HZ_LABELS[freq.exp]}`;
      if (data.rdsNames && data.rdsNames[freq_n]) r += ` (${data.rdsNames[freq_n]})`;
    } else {
      r = '[no frequency config found]';
    }
    return r;
  }
//    f = +this.data.freqs.range[0] + i * this.data.freqs.range[2]; // 'snap' to an actual frequency value
//    f = f.toFixed(-Math.log10(this.data.freqs.range[2]));

// let freq = this.data.freqs.freqs[idx];
// let s = (+freq.f).toFixed(3) + ' ' + HZ_LABELS[freq.exp];
// OR
// var range = this.data.freqs.range;
// var f = +range[0] + idx * +range[2];
// let s = +f.toFixed(3) + ' ' + HZ_LABELS[this.data.freqs.exp];

//if (this.allowRange) {
//  let f = +this.config.freqs.range[0] + this.config.freqs.range[2] * freq_n;
//  return `${f.toFixed(-Math.log10(this.config.freqs.range[2]))}${HZ_LABELS[this.config.freqs.exp]}`;
//} else {
//  let f = this.config.freqs.freqs[freq_n].f;
//  return `${f}${HZ_LABELS[this.config.freqs.freqs[freq_n].exp]}`;
//}
}
