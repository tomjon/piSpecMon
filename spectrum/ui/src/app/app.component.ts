import { Component, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { DataService } from './data.service';
import { MessageService } from './message.service';
import { StateService } from './state.service';
import { User } from './user';
import { Config } from './config';

let modelSort = function (a, b) {
  if (a.manufacturer == b.manufacturer) {
    return a.name < b.name ? -1 : 1;
  } else {
    return a.manufacturer < b.manufacturer ? -1 : 1;
  }
};

@Component({
  selector: 'psm-app',
  template:
    `<div *ngIf="stateService.ready" class="container-fluid">
       <div class="row">
         <div class="col-lg-12">
           <h1 class="header"><img src="assets/ofcom.gif" alt="Ofcom"> <span class="name">{{stateService.values.ident.name}}</span> ({{stateService.values.ident.description}})</h1>
           <psm-login [user]="user"></psm-login>
         </div>
       </div>
       <div class="row">
         <div class="col-lg-9">
           <psm-table #table [user]="user" [status]="status"></psm-table> <!-- FIXME 'user' via state service -->
           <!--div class="error" *ngFor="let error of errors">{{error[0] | date}} {{error[1]}}</div FIXME -->
           <psm-process [status]="status" [values]="values"></psm-process>
           <psm-charts [hidden]="config == undefined"></psm-charts>
         </div>
         <div class="col-lg-3">
           <psm-error></psm-error>
           <psm-ident></psm-ident>
           <!--psm-details></psm-details FIXME -->
           <psm-logs *ngIf="user.roleIn(['admin'])"></psm-logs>
           <psm-pi *ngIf="user.roleIn(['admin'])"></psm-pi>
           <psm-pico *ngIf="user.roleIn(['admin'])"></psm-pico>
           <psm-stats *ngIf="user.roleIn(['admin'])"></psm-stats>
           <psm-rig *ngIf="user.roleIn(['admin'])"></psm-rig>
           <psm-audio *ngIf="user.roleIn(['admin'])"></psm-audio>
           <psm-rds *ngIf="user.roleIn(['admin', 'freq'])"></psm-rds>
           <psm-scan *ngIf="user.roleIn(['admin', 'freq'])"></psm-scan>
           <psm-ams *ngIf="user.roleIn(['admin', 'freq'])"></psm-ams>
           <psm-sdr *ngIf="user.roleIn(['admin', 'freq'])"></psm-sdr>
         </div>
       </div>
     </div>
     <div id="messageModal" class="modal fade" role="dialog">
       <div class="modal-dialog">
         <div class="modal-content">
           <div class="modal-header">
             <button type="button" class="close" data-dismiss="modal">&times;</button>
             <h4 class="modal-title"></h4>
           </div>
           <div class="modal-footer">
             <button type="button" class="btn btn-default" data-dismiss="modal">Dismiss</button>
           </div>
         </div>
       </div>
     </div>`,
  styles: [
    `.header { float: left }`,
    `.header img { margin-right: 20px }`
  ]
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
    let config_id: string = undefined;
    for (let key in status) {
      let c_id = status[key].config_id;
      if (c_id != undefined) config_id = c_id;//FIXME have server not spread config_ids everywhere :(
    }

    let config: Config = this.stateService.currentConfig;
    if (config != undefined && config_id == config.id && config.data != undefined) {
      config.data.update_status(status);
    }

    if (config_id != undefined) {
      let config: Config = this.table.getConfig(config_id);
      if (config != undefined) {
        this.values = config.values; //FIXME horrible: this is used only for 'description' of the process/run
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
