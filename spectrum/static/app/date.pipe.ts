import { Pipe, PipeTransform } from '@angular/core';
import { dt_format } from './d3_import';

@Pipe({ name: 'date' })
export class DatePipe implements PipeTransform {
  transform(timestamp: number): string {
    if (! timestamp) return "";
    return dt_format(new Date(+timestamp));
  }
}
