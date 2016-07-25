export class Config {

  config_id: string;
  timestamp: number;
  config: any;

  constructor(config_id: string, timestamp: number, config: any) {
    this.config_id = config_id;
    this.timestamp = timestamp;
    this.config = config;
  }

}
