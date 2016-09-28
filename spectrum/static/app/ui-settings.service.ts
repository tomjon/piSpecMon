import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { DataService } from './data.service';

@Injectable()
export class UiSettingsService {

  getValues: Observable<any>; // observable for getting values from server API
  values: any; // values set by user, these override values from server API

  constructor (private dataService: DataService) {
    this.getValues = this.dataService.getUiSettings().publishReplay(1).refCount();
    this.values = {};
  }

  set(key: string, value: any): Observable<void> {
    this.values[key] = value;
    return this.dataService.setUiSetting(this.encode(key), value);
  }

  get(key: string): Observable<boolean> {
    if (this.values[key] != undefined) {
      return Observable.of(this.values[key]);
    }
    key = this.encode(key);
    return this.getValues.map(values => values[key] != undefined ? values[key] : true);
  }

  private encode(key: string): string {
    return key.replace('/', '-');
  }

}
