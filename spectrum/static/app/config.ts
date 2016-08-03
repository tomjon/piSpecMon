//FIXME this should probably be named ConfigSet and update clients of the class accordingly; or possibly rename this.config to this.fields or this.data or something
export class Config {

  constructor(public config_id: string, public timestamp: number, public config: any) {
    this.config_id = config_id;
    this.timestamp = timestamp;
    this.config = config;
  }

}
