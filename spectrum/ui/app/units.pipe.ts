import { Pipe, PipeTransform } from '@angular/core';
import { DataService } from './data.service';

@Pipe({ name: 'units' })
export class UnitsPipe implements PipeTransform {
  constructor(private dataService: DataService) {}

  transform(value: number): string {
    return this.dataService.constants.hz_labels[value];
  }
}
