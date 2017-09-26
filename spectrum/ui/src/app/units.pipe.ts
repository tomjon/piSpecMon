import { Pipe, PipeTransform } from '@angular/core';
import { StateService } from './state.service';

@Pipe({ name: 'units' })
export class UnitsPipe implements PipeTransform {
  constructor(private stateService: StateService) {}

  transform(value: number): string {
    return this.stateService.constants.hz_labels[value];
  }
}
