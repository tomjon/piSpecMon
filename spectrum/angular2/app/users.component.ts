import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';

@Component({
  selector: 'psm-users',
  templateUrl: 'templates/users.html',
  directives: [ InputComponent ],
  styles: [ `.disabled { background: lightgrey }` ]
})
export class UsersComponent {
  users: User[];
  newUser: User = new User();
  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getUsers()
                    .subscribe(
                      users => this.users = users,
                      error => this.errorComponent.add(error)
                    );
  }

  onChange(user) {
    ++user._count;
    setTimeout(() => { if (--user._count == 0) {
      this.dataService.saveUser(user)
                      .subscribe(
                        () => delete user._name,
                        error => this.errorComponent.add(error)
                      );
    }}, 5000);
  }

  onDelete(user) {
    user._loading = true;
    this.dataService.deleteUser(user)
                    .subscribe(
                      () => { user._loading = false; this.users.splice(this.users.indexOf(user), 1) },
                      error => { user._loading = false; this.errorComponent.add(error) }
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
                       error => { user._loading = false; this.errorComponent.add(error) }
                    );
  }
}
