import { WorkerData} from './worker-data';
import { StateService } from './state.service';
import { DataService } from './data.service';

export abstract class Chart {
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)

  protected options: any;
  protected max_n: number;
  protected hz: any;

  protected worker: string;

  constructor(protected stateService: StateService, private dataService?: DataService, private name?: string) {
      stateService.registerChart(this);
  }

  init() {
    this.options = this.stateService.constants[`${this.worker}_${this.name}_chart`];
    this.max_n = this.stateService.constants.max_n;
    this.hz = this.stateService.constants.hz_labels;
  }

  get viewBox(): string {
    return `0 0 ${this.options.width} ${this.options.height}`;
  }

  reset() {
    this.plotted = false;
    if (this.show) this._plot();
  }

  get label(): string {
    return this.stateService.workerLabel(this.worker);
  }

  get values(): any {
    return this.stateService.currentConfig != undefined ? this.stateService.currentConfig.values[this.worker] : undefined;
  }

  freq(idx: number): any {
    if (this.stateService.currentConfig == undefined) return undefined;
    let data = this.stateService.currentConfig.data;
    return data.config.values[this.worker].freqs[idx];
  }

  get data(): WorkerData {
    return this.stateService.currentConfig != undefined &&
           this.stateService.currentConfig.data != undefined ? this.stateService.currentConfig.data.workers[this.worker] : undefined;
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
