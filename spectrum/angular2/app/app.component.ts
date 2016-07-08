import { Component } from '@angular/core';
import { UsersComponent } from './users.component';
import { HTTP_PROVIDERS } from '@angular/http';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

@Component({
  selector: 'psm-app',
  templateUrl: 'templates/app.html',
  directives: [ UsersComponent ],
  providers: [ HTTP_PROVIDERS ]
})
export class AppComponent { }
