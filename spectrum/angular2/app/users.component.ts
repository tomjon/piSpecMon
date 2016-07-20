import { Component, Input } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';
import { ErrorService } from './error.service';

@Component({
  selector: 'psm-users',
  templateUrl: 'templates/users.html',
  directives: [ InputComponent ],
  styles: [ `.disabled { background: lightgrey }` ]
})
export class UsersComponent {
  users: User[];
  newUser: User = new User();

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getUsers()
                    .subscribe(
                      users => this.users = users,
                      error => this.errorService.logError(this, error)
                    );
  }

  onChange(user) {
    ++user._count;
    setTimeout(() => { if (--user._count == 0) {
      this.dataService.saveUser(user)
                      .subscribe(
                        () => delete user._name,
                        error => this.errorService.logError(this, error)
                      );
    }}, 5000);
  }

  onDelete(user) {
    user._loading = true;
    this.dataService.deleteUser(user)
                    .subscribe(
                      () => { user._loading = false; this.users.splice(this.users.indexOf(user), 1) },
                      error => { user._loading = false; this.errorService.logError(this, error) }
                    );
  }

  onAdd(user) {
    let password = prompt("Please supply an initial password");
    if (password == undefined || password == null || password == "") {
      return;
    }
    user._loading = true;
    this.dataService.saveUser(user, password)
                    .subscribe(
                       () => { user._loading = false; this.users.push(user); this.newUser = new User() },
                       error => { user._loading = false; this.errorService.logError(this, error) }
                    );
  }
}
