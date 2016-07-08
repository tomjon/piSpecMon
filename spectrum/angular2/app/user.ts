export class User {
  role: string = 'admin'; //FIXME get the allowed values, and their labels, associated with this class
  name: string;
  real: string;
  email: string;
  tel: string;
  _name: string; // original name as obtained from server
  _count: number = 0; // change counter
  _loading: boolean; // whether there is server iteraction occurring
}
