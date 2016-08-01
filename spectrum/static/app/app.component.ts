import { Component, ViewChild } from '@angular/core';
import { DetailsComponent } from './details.component';
import { UsersComponent } from './users.component';
import { StatsComponent } from './stats.component';
import { RigComponent } from './rig.component';
import { ConfigComponent } from './config.component';
import { SweepComponent } from './sweep.component';
import { ErrorComponent } from './error.component';
import { WorkerComponent } from './worker.component';
import { ChartsComponent } from './charts.component';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { User } from './user';
import { HTTP_PROVIDERS } from '@angular/http';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

@Component({
  selector: 'psm-app',
  templateUrl: 'templates/app.html',
  directives: [ ErrorComponent, DetailsComponent, UsersComponent, StatsComponent, RigComponent, ConfigComponent, SweepComponent, WorkerComponent, ChartsComponent ],
  providers: [ DataService, ErrorService, HTTP_PROVIDERS ]
})
export class AppComponent {
  user: User = new User();

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getCurrentUser()
                    .subscribe(user => { this.user = user; this.checkSuperior() });
  }

  private checkSuperior() {
    if (this.user._superior) {
      let s = this.user._superior;
      this.errorService.logError("Log in", `Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }
}
