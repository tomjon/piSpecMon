import { Component, ViewChild } from '@angular/core';
import { LoginComponent } from './login.component';
import { DetailsComponent } from './details.component';
import { LogsComponent } from './logs.component';
import { StatsComponent } from './stats.component';
import { PiComponent } from './pi.component';
import { RigComponent } from './rig.component';
import { AudioComponent } from './audio.component';
import { RdsComponent } from './rds.component';
import { ScanComponent } from './scan.component';
import { ErrorComponent } from './error.component';
import { TableComponent } from './table.component';
import { ChartsComponent } from './charts.component';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { MessageService } from './message.service';
import { UiSettingsService } from './ui-settings.service';
import { User } from './user';
import { Config } from './config';
import { TICK_INTERVAL } from './constants';
import { HTTP_PROVIDERS } from '@angular/http';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

let modelSort = function (a, b) {
  if (a.manufacturer == b.manufacturer) {
    return a.name < b.name ? -1 : 1;
  } else {
    return a.manufacturer < b.manufacturer ? -1 : 1;
  }
};

@Component({
  selector: 'psm-app',
  templateUrl: 'templates/app.html',
  directives: [ LoginComponent, ErrorComponent, DetailsComponent, PiComponent, LogsComponent, StatsComponent, RigComponent, AudioComponent, RdsComponent, TableComponent, ScanComponent, ChartsComponent ],
  providers: [ DataService, ErrorService, MessageService, UiSettingsService, HTTP_PROVIDERS, FreqPipe ],
  pipes: [ DatePipe ]
})
export class AppComponent {
  user: User = new User();
  models: any[] = [ ];
  modes: any[] = [ ];
  rates: any[] = [ ];
  parities: any[] = [ ];

  config: Config;
  values: any;
  status: any = { worker: { }, monkey: { } };

  version: string;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit() {
    this.dataService.getVersion()
                    .subscribe(version => this.version = version);
    this.dataService.getCurrentUser()
                    .subscribe(user => { this.user = user; this.checkSuperior() });
    this.dataService.getCaps()
                    .subscribe(data => {
                      this.models = data.models.sort(modelSort);
                      this.modes = data.modes;
                      this.rates = data.rates;
                      this.parities = data.parities;
                    });
    setInterval(this.monitor.bind(this), TICK_INTERVAL);
  }

  monitor() {
    this.dataService.getMonitor()
                    .subscribe(
                      status => this.status = status,
                      error => window.location.assign('/')
                    );
  }

  setConfig(config: Config) {
    this.config = config;
    this.values = config ? config.values : undefined;
  }

  private checkSuperior() {
    if (this.user._superior) {
      let s = this.user._superior;
      this.messageService.show(`Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }

  get errors(): any[] {
    return this.config ? this.config.errors : [];
  }
}
