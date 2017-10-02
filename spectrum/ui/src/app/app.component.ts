import { Component, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { StateService } from './state.service';
import { User } from './user';
import { Config } from './config';

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
           <psm-table></psm-table>
           <!--div class="error" *ngFor="let error of errors">{{error[0] | date}} {{error[1]}}</div FIXME -->
           <psm-process></psm-process>
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
  constructor(private stateService: StateService) {}

  private get user(): User {
    return this.stateService.user;
  }

  private get config(): Config {
    return this.stateService.currentConfig;
  }

  /* FIXME get errors(): any[] {
    return this.config ? this.config.errors : [];
  }*/
}
