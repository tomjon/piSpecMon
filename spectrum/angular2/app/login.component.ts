import { Component } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { CHANGE_TIMEOUT } from './constants';

@Component({
  selector: 'psm-login',
  directives: [ InputComponent ],
  template: `<div *ngIf="user">
    <table>
      <tr><th>Role</th><td>{{user.roleLabel}}</td></tr>
      <tr><th>User name</th><td>{{user.name}}</td></tr>
      <tr><th>Real name</th><td><psm-input><input #input [(ngModel)]="user.real" (change)="onChange()"></psm-input></td></tr>
      <tr><th>Email address</th><td><psm-input><input #input [(ngModel)]="user.email" (change)="onChange()"></psm-input></td></tr>
      <tr><th>Telephone number</th><td><psm-input><input #input [(ngModel)]="user.tel" (change)="onChange()"></psm-input></td></tr>
      <tr><td><button [disabled]="loading" (click)="onSubmit()">Change Password</button></td><td><input [disabled]="loading" [(ngModel)]="password" type="password"></td></tr>
    </table>
    <!-- button (click)="onLogout()">Log out</button -->
  </div>`
})
export class LoginComponent {
  user: User;
  password: string = "";
  loading: boolean = false;

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getLogin()
                    .subscribe(
                      user => this.user = user,
                      error => this.errorService.logError(this, error)
                    );
  }

  onChange() {
    ++this.user._count;
    setTimeout(() => {
      if (--this.user._count == 0) {
        this.dataService.saveUser(this.user)
                        .subscribe(
                          () => delete this.user._name,
                          error => this.errorService.logError(this, error)
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
    this.dataService.setPassword(oldPassword, this.password)
                    .subscribe(
                      () => { },
                      error => this.errorService.logError(this, error),
                      () => this.loading = false
                    );
  }

  onLogout() {
    this.dataService.logout()
                    .subscribe(
                      () => { },
                      error => this.errorService.logError(this, error)
                    );
  }
}
