import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Error } from './error';

@Injectable()
export class ErrorService {
  private messageSource = new Subject<Error>();

  message$ = this.messageSource.asObservable();

  public logError(source: any, message: string): void {
    this.messageSource.next(new Error(source, message));
  }
}
