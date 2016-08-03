import { Component, ViewChild } from '@angular/core';
import { LoginComponent } from './login.component';
import { DetailsComponent } from './details.component';
import { StatsComponent } from './stats.component';
import { RigComponent } from './rig.component';
import { SweepComponent } from './sweep.component';
import { ScanComponent } from './scan.component';
import { ErrorComponent } from './error.component';
import { TableComponent } from './table.component';
import { ChartsComponent } from './charts.component';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { MessageService } from './message.service';
import { User } from './user';
import { Config } from './config';
import { TICK_INTERVAL } from './constants';
import { HTTP_PROVIDERS } from '@angular/http';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

@Component({
  selector: 'psm-app',
  templateUrl: 'templates/app.html',
  directives: [ LoginComponent, ErrorComponent, DetailsComponent, StatsComponent, RigComponent, TableComponent, SweepComponent, ScanComponent, ChartsComponent ],
  providers: [ DataService, ErrorService, MessageService, HTTP_PROVIDERS ]
})
export class AppComponent {
  user: User = new User();
  modes: any[] = [ ];

  // config set and config currently selected in sweep table
  config: Config;
  fields: any;
  status: any;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit() {
    this.dataService.getCurrentUser()
                    .subscribe(user => { this.user = user; this.checkSuperior() });
    this.dataService.getModes()
                    .subscribe(modes => this.modes = modes);
    setInterval(this.monitor.bind(this), TICK_INTERVAL);
  }

  monitor() {
    this.dataService.getMonitor()
                    .subscribe(
                      status => this.status = status,
                      error => window.location.assign('/logout')
                    );
  }

  setConfig(config: Config) {
    this.config = config;
    this.fields = config ? config.config : undefined;
  }

  private checkSuperior() {
    if (this.user._superior) {
      let s = this.user._superior;
      this.messageService.show(`Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }
}
