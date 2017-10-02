import { Component } from '@angular/core';
import { ErrorService } from './error.service';
import { Error } from './error';

//FIXME standardize how errors are reported from the server API so that we can display a nice message

@Component({
  selector: 'psm-error',
  template: `<div *ngIf="errors.length > 0">
              <ul>
                <li *ngFor="let error of errors; let i = index">{{error.source}}: {{error.message}}<button (click)="onClear(i)">x</button></li>
              </ul>
             </div>`
})
export class ErrorComponent {
  private errors: Error[] = new Array<Error>();

  constructor(private errorService: ErrorService) {
    this.errorService.message$.subscribe(
      error => {
        for (let i in this.errors) {
          if (this.errors[i].source == error.source) {
            this.errors[i] = error;
            return;
          }
        }
        this.errors.push(error)
      }
    );
  }

  onClear(i: number) {
    this.errors.splice(i, 1);
  }
}
