import { Component } from '@angular/core';
import { UsersComponent } from './users.component';
import { StatsComponent } from './stats.component';
import { RigComponent } from './rig.component';
import { ConfigComponent } from './config.component';
import { SweepComponent } from './sweep.component';
import { ErrorComponent } from './error.component';
import { HTTP_PROVIDERS } from '@angular/http';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

@Component({
  selector: 'psm-app',
  templateUrl: 'templates/app.html',
  directives: [ ErrorComponent, UsersComponent, StatsComponent, RigComponent, ConfigComponent, SweepComponent ],
  providers: [ HTTP_PROVIDERS ]
})
export class AppComponent {
}
