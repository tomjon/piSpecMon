import { Component } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { UserService } from './user.service';

@Component({
  selector: 'psm-users',
  templateUrl: 'templates/users.html',
  directives: [ InputComponent ],
  providers: [ UserService ],
  styles: [ `.disabled { background: lightgrey }` ]
})
export class UsersComponent {
  title = "Users Component";
  users: User[];
  newUser: User = new User();
  errorMessage: string;

  constructor(private userService: UserService) { }

  ngOnInit() {
    this.userService.getUsers()
                    .subscribe(
                      users => this.users = users,
                      error => this.errorMessage = <any>error
                    );
  }

  onChange(user) {
    ++user._count;
    setTimeout(() => { if (--user._count == 0) {
      this.userService.saveUser(user)
                      .subscribe(
                        () => delete user._name,
                        error => this.errorMessage = <any>error
                      );
    }}, 5000);
  }

  onDelete(user) {
    user._loading = true;
    this.userService.deleteUser(user)
                    .subscribe(
                      () => { user._loading = false; this.users.splice(this.users.indexOf(user), 1) },
                      error => { user._loading = false; this.errorMessage = <any>error }
                    );
  }

  onAdd(user) {
    let password = prompt("Please supply an initial password");
    if (password == undefined || password == null || password == "") {
      return;
    }
    user._loading = true;
    this.userService.saveUser(user, password)
                    .subscribe(
                       () => { user._loading = false; this.users.push(user); this.newUser = new User() },
                       error => { user._loading = false; this.errorMessage = <any>error }
                    );
  }
}
