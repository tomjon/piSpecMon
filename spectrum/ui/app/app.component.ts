import { Component, ViewChild } from '@angular/core';
import { HTTP_PROVIDERS } from '@angular/http';
import { LoginComponent } from './login.component';
import { IdentComponent } from './ident.component';
import { DetailsComponent } from './details.component';
import { LogsComponent } from './logs.component';
import { StatsComponent } from './stats.component';
import { PiComponent } from './pi.component';
import { PicoComponent } from './pico.component';
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
  directives: [ LoginComponent, ErrorComponent, IdentComponent, DetailsComponent, PiComponent, PicoComponent, LogsComponent, StatsComponent, RigComponent, AudioComponent, RdsComponent, TableComponent, ScanComponent, ChartsComponent ],
  providers: [ DataService, ErrorService, MessageService, UiSettingsService, HTTP_PROVIDERS, FreqPipe ],
  pipes: [ DatePipe ]
})
export class AppComponent {
  constants: any;

  user: User;
  models: any[] = [ ];
  caps: any = {'scan': {}};

  config: Config;
  values: any;
  status: any = { worker: { }, monkey: { } };

  ident: any;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  @ViewChild('table') table;

  ngOnInit() {
    this.dataService.getCurrentUser()
                    .subscribe(user => { this.user = user; this.checkSuperior() });
    this.dataService.getCaps()
                    .subscribe(caps => {
                      this.caps = caps;
                      this.caps.models = this.caps.models.sort(modelSort);
                    });
    this.dataService.getConstants()
                    .subscribe(constants => {
                      this.constants = constants;
                      setInterval(this.monitor.bind(this), constants.tick_interval);
                    });
  }

  monitor() {
    this.dataService.getMonitor()
                    .subscribe(
                      status => this.setStatus(status),
                      error => window.location.assign('/')
                    );
  }

  setConfig(config: Config) {
    this.config = config;
    if (config != undefined && ! this.running) this.values = config.values;
  }

  private get running(): boolean {
    if (! this.status) return false;
    if (this.status.worker && this.status.worker.config_id) return true;
    if (this.status.monkey && this.status.monkey.config_id) return true;
    return false;
  }

  setStatus(status: any) {
    this.status = status;
    if (status != undefined) {
      let config_id: string = undefined;
      if (status.worker) {
        config_id = status.worker.config_id;
      }
      if (config_id == undefined && status.monkey) {
        config_id = status.monkey.config_id;
      }
      if (config_id != undefined) {
        let config: Config = this.table.getConfig(config_id);
        if (config != undefined) this.values = config.values;
      }
    }
  }

  setIdent(ident: any) {
    this.ident = ident;
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
