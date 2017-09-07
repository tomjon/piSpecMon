import { Data } from './data';

export class Config {
  public id: string;
  public values: any;
  public timestamp: number; //FIXME what is this? is it used?
  public first: number;
  public latest: number;
  public count: number;
  public errors: any[];

  public data: Data;
}
