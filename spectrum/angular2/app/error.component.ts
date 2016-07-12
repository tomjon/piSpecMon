import { Component } from '@angular/core';

@Component({
  selector: 'psm-error',
  templateUrl: 'templates/error.html'
})
export class ErrorComponent {
  errorMessage: string;

  add(error) {
    this.errorMessage = error; //FIXME develop a stack of errors that disappear after a while?
  }
}
