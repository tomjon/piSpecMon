import { Pipe, PipeTransform } from '@angular/core';
import { HZ_LABELS } from './constants';

@Pipe({ name: 'freq' })
export class FreqPipe implements PipeTransform {
  // used in templates like: freq_n | freq:values
  transform(freq_n: number, values: any): string {
    let r: string = null;
    if (values == undefined) {
      return '[no values specified]';
    }
    if (values.freqs == undefined) {
      return '[no frequency values]';
    }
    let n = freq_n;
    for (let f_spec of values.freqs) {
      if (! f_spec.enabled) continue;
      let r = f_spec.range;
      let size = r != undefined ? Math.ceil((+r[1] - +r[0] + +r[2] / 2) / +r[2]) : 1;
      if (n < size) {
        let p = this._format(r, n, f_spec);
        if (values.rdsNames && values.rdsNames[freq_n]) p += ` (${values.rdsNames[freq_n]})`;
        return p;
      }
      n -= size;
    }
    return `[bad freq_n: ${freq_n}]`;
  }

  _format(r, n, f_spec): string {
    if (r != undefined) {
      let f = +r[0] + n * +r[2];
      let s = r[2].toString();
      let i = s.indexOf('.');
      let j = i > -1 ? s.length - i - 1 : 0;
      return `${f.toFixed(j)}${HZ_LABELS[f_spec.exp]}`;
    } else {
      return `${+f_spec.freq}${HZ_LABELS[f_spec.exp]}`;
    }
  }
}
