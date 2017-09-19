import { Component, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { WidgetComponent } from './widget.component';
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
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { InputDirective } from './input.directive';
import { ProcessComponent } from './process.component';
import { AmsComponent } from './ams.component';
import { HTTP_PROVIDERS } from '@angular/http';

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
  directives: [ InputDirective, LoginComponent, ErrorComponent, ProcessComponent, IdentComponent, DetailsComponent, PiComponent, PicoComponent, LogsComponent, StatsComponent, RigComponent, AudioComponent, RdsComponent, TableComponent, ScanComponent, ChartsComponent, AmsComponent ],
  providers: [ DataService, StateService, ErrorService, MessageService, UiSettingsService, HTTP_PROVIDERS, FreqPipe ],
  pipes: [ DatePipe, FreqPipe ]
})
export class AppComponent {
  user: User; //FIXME get rid - use stateService.user
  models: any[] = [ ];
  caps: any = {'scan': {}};

  status: any = {};

  values: any = {}; //FIXME config values pulled out of the table component matching the latest status update

  constructor(private dataService: DataService, private stateService: StateService, private messageService: MessageService) { }

  @ViewChild('table') table;

  //FIXME this might work in Angular 4 (currently we don't like 'descendants')
  //@ViewChildren(WidgetComponent, {descendants: true}) widgets: QueryList<WidgetComponent>;

  ngOnInit() {
    //FIXME this interaction between state service and data service looks... weird... and in the wrong place
    this.dataService.getCurrentUser()
                    .subscribe(user => {
                      this.stateService.user = user;
                      this.user = user; this.checkSuperior();
                    });
    this.dataService.getSettings()
                    .subscribe(values => this.stateService.values = values);
    this.dataService.getCaps()
                    .subscribe(caps => {
                      if (caps.scan && caps.scan.models) caps.scan.models = caps.scan.models.sort(modelSort); //FIXME hmmm - do where it is needed, not here
                      this.stateService.caps = caps;
                    });
    this.dataService.getConstants()
                    .subscribe(constants => {
                      this.stateService.constants = constants;
                      setInterval(this.monitor.bind(this), constants.tick_interval);
                    });
  }

  monitor() {
    this.dataService.getStatus()
                    .subscribe(
                      status => this.setStatus(status),
                      error => window.location.assign('/')
                    );
  }

  //FIXME intereseted components should subscribe to a Status subject of dataservice
  setStatus(status: any) {
    this.status = status;
    if (status != undefined) {
      let config_id: string = undefined;
      for (let key in status) {
        config_id = status[key].config_id;
      }
      if (config_id != undefined) {
        let config: Config = this.table.getConfig(config_id);
        if (config != undefined) this.values = config.values;
      }
      let config: Config = this.stateService.currentConfig;
      if (config && status.config_id == config.id && config.data) {
        config.data.update_status(status);
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
