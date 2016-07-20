import { Pipe, PipeTransform } from '@angular/core';

let units = [' bytes', 'k', 'M', 'G'];

@Pipe({ name: 'bytes' })
export class BytesPipe implements PipeTransform {
  transform(value: number, hideUnits: boolean): string {
    if (value === undefined) return "";
    let m = Math.floor(Math.log2(value) / 10);
    if (m >= units.length) m = units.length - 1;
    let s = (value / Math.pow(2, 10 * m)).toFixed(1);
    return hideUnits ? s : s + units[m];
  }
}
