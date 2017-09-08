import { Component, ViewChild } from '@angular/core';
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
import { StateService } from './state.service';
import { User } from './user';
import { Config } from './config';
import { TICK_INTERVAL } from './constants';
import { HTTP_PROVIDERS } from '@angular/http';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { InputDirective } from './input.directive';

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
  directives: [ InputDirective, LoginComponent, ErrorComponent, IdentComponent, DetailsComponent, PiComponent, PicoComponent, LogsComponent, StatsComponent, RigComponent, AudioComponent, RdsComponent, TableComponent, ScanComponent, ChartsComponent ],
  providers: [ DataService, StateService, ErrorService, MessageService, UiSettingsService, HTTP_PROVIDERS, FreqPipe ],
  pipes: [ DatePipe ]
})
export class AppComponent {
  user: User; //FIXME get rid - use stateService.user
  models: any[] = [ ];
  modes: any[] = [ ];
  rates: any[] = [ ];
  parities: any[] = [ ];

  values: any;
  status: any = { worker: { }, monkey: { } };

  constructor(private dataService: DataService, private stateService: StateService, private messageService: MessageService) { }

  @ViewChild('table') table;

  ngOnInit() {
    this.dataService.getCurrentUser()
                    .subscribe(user => {
                      this.stateService.user = user;
                      this.user = user; this.checkSuperior();
                    });
    this.dataService.getSettings()
                    .subscribe(values => this.stateService.values = values);
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
    this.dataService.getStatus()
                    .subscribe(
                      status => this.setStatus(status),
                      error => window.location.assign('/')
                    );
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

      let config: Config = this.stateService.currentConfig;
      //FIXME where is the best place for this logic? Can it be simplified?
      if (config && status.config_id == config.id && status.sweep && config.data && status.sweep.sweep_n > config.data.count && config.data.loading == undefined) {
        this.dataService.getData(config.id, config.data.timestamps)
                        .subscribe(data => {
                          config.data.update(data);
                          this.stateService.resetCharts();
                        });
      }
    }
  }

  private checkSuperior() {
    if (this.stateService.user._superior) {
      let s = this.stateService.user._superior;
      this.messageService.show(`Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }

  private get config(): Config {
    return this.stateService.currentConfig;
  }

  /* FIXME get errors(): any[] {
    return this.config ? this.config.errors : [];
  }*/
}
