import { Data} from './data';
import { StateService } from './state.service';
import { DataService } from './data.service';

export abstract class Chart {
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)

  protected options: any;
  protected max_n: number;
  protected hz: any;

  constructor(protected stateService: StateService, private dataService?: DataService, private name?: string) {
      stateService.registerChart(this);
  }

  init() {
    this.options = this.dataService.constants[this.name + '_chart_options'];
    this.max_n = this.dataService.constants.max_n;
    this.hz = this.dataService.constants.hz_labels;
  }

  get viewBox(): string {
    return `0 0 ${this.options.width} ${this.options.height}`;
  }

  reset() {
    this.plotted = false;
    if (this.show) this._plot();
  }

  get data(): Data {
    return this.stateService.currentConfig != undefined ? this.stateService.currentConfig.data : undefined;
  }

  get timestamp(): number {
    return this.data != undefined ? this.data.timestamp : undefined;
  }

  onShow(show: boolean) {
    if (show && ! this.plotted) this._plot();
    this.show = show;
  }

  private _plot(): void {
    if (this.data == undefined) return;
    this.plotted = true;
    this.plot();
  }

  abstract plot(): void;
}
