import { Pipe, PipeTransform } from '@angular/core';
import { HZ_LABELS } from './constants';

@Pipe({ name: 'units' })
export class UnitsPipe implements PipeTransform {
  transform(value: number): string {
    return HZ_LABELS[value];
  }
}
