import { Injectable } from '@angular/core';
import { Config } from './config';
import { User } from './user';

@Injectable()
export class StateService {
  // the currently selected config, if any
  public currentConfig: Config;

  // these will get set at app initialisation (nothing shows before these are set)
  public user: User;
  public values: any; // the current server settings (back to which we can reset, or replace on submit)

  get ready(): boolean {
    return this.user != undefined && this.values != undefined;
  }
}
