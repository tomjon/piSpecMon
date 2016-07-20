import { Component } from '@angular/core';
import { ErrorService } from './error.service';
import { Error } from './error';

@Component({
  selector: 'psm-error',
  templateUrl: 'templates/error.html'
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
