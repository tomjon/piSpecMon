import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class DataService {
  constructor(private http: Http) { }

  getData(): Observable<any> {
    return this.http.get('/data')
                    .map(res => res.json())
                    .catch(this.errorHandler);
  }

  private errorHandler(error: any, caught: Observable<any>): Observable<any> {
    console.log(`${error._body} - ${error.status} ${error.statusText}`);
    return Observable.create(observer => observer.error());
  }
}
