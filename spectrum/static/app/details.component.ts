import { Component } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { CHANGE_TIMEOUT } from './constants';

@Component({
  selector: 'psm-details',
  directives: [ InputComponent ],
  template: `<h1>User Details</h1>
    <table *ngIf="user">
      <tr><th>Role</th><td>{{user._roleLabel}}</td></tr>
      <tr><th>User name</th><td>{{user.name}}</td></tr>
      <tr><th>Real name</th><td><psm-input><input #input [(ngModel)]="user.real" (change)="onChange()"></psm-input></td></tr>
      <tr><th>Email address</th><td><psm-input><input #input [(ngModel)]="user.email" (change)="onChange()"></psm-input></td></tr>
      <tr><th>Telephone number</th><td><psm-input><input #input [(ngModel)]="user.tel" (change)="onChange()"></psm-input></td></tr>
      <tr><td><button [disabled]="loading" (click)="onSubmit()">Change Password</button></td><td><input [disabled]="loading" [(ngModel)]="password" type="password"></td></tr>
    </table>`
})
export class DetailsComponent {
  user: User;
  password: string = "";
  loading: boolean = false;

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getCurrentUser()
                    .subscribe(
                      user => { this.user = user; this.checkSuperior() },
                      () => { }
                    );
  }

  private checkSuperior() {
    if (this.user._superior) {
      let s = this.user._superior;
      this.errorService.logError("Log in", `Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }

  onChange() {
    ++this.user._count;
    setTimeout(() => {
      if (--this.user._count == 0) {
        this.dataService.setCurrentUser(this.user)
                        .subscribe(
                          () => { },
                          () => { }
                        );
      }
    }, CHANGE_TIMEOUT);
  }

  onSubmit() {
    let oldPassword = prompt("Enter your current password");
    if (oldPassword == undefined || oldPassword == null || oldPassword == "") {
      return;
    }
    this.loading = true;
    this.dataService.setCurrentUser(null, oldPassword, this.password)
                    .subscribe(
                      () => { },
                      () => { },
                      () => this.loading = false
                    );
  }
}
