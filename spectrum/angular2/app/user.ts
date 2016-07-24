export class User {
  static ROLES = [ { role: "admin", label: "Administrator" },
                   { role: "freq", label: "Frequency setter" },
                   { role: "data", label: "Data viewer" } ];

  role: string = User.ROLES[0].role;
  name: string;
  real: string;
  email: string;
  tel: string;
  _login: boolean; // whether this user is the one logged in
  _name: string; // original name as obtained from server
  _count: number = 0; // change counter
  _loading: boolean; // whether there is server iteraction occurring

  constructor(raw?: any, login?: boolean) {
    if (raw) {
      this.role = raw.role;
      this.name = raw.name;
      this.real = raw.real;
      this.email = raw.email;
      this.tel = raw.tel;
    }
    this._login = login || false;
    this._name = this.name;
    this._count = 0;
    this._loading = false;
  }

  data(): any {
    let data = { };
    for (let k in this) {
      if (k[0] != '_') {
        data[k] = this[k];
      }
    }
    return data;
  }

  get roleLabel(): string {
    for (let r of User.ROLES) {
      if (r.role == this.role) {
        return r.label;
      }
    }
    return this.role;
  }
}
