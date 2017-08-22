import { Data} from './data';
import { DataService } from './data.service';

export abstract class Chart {
  private _data: Data; // the chart data
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)
  private _timestamp: number; // timestamp of the last spectrum sweep

  protected options: any;
  protected max_n: number;
  protected hz: any;

  constructor(private dataService: DataService, private name: string) { }

  init() {
    this.options = this.dataService.constants[this.name + '_chart_options'];
    this.max_n = this.dataService.constants.max_n;
    this.hz = this.dataService.constants.hz_labels;
  }

  get viewBox(): string {
    return `0 0 ${this.options.width} ${this.options.height}`;
  }

  set data(data: Data) {
    this._data = data;
    this.plotted = false;
    if (this.show) this._plot();
  }

  get data() {
    return this._data;
  }

  set timestamp(timestamp: number) {
    this._timestamp = timestamp;
    if (timestamp) this.plot();
  }

  get timestamp() {
    return this._timestamp;
  }

  onShow(show: boolean) {
    if (! this.show && show && ! this.plotted) this._plot();
    this.show = show;
  }

  private _plot(): void {
    this.plotted = true;
    this.plot();
  }

  abstract plot(): void;
}
