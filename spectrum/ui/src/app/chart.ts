import { Input } from '@angular/core';
import { WidgetBase } from './widget.base';
import { WorkerData} from './worker-data';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { MessageService } from './message.service';

/**
 * TODO: you could get at chart settings through the widget base settings 'values'
 * but these should not make it into the config values that are stored for the workers.
 */
export abstract class Chart extends WidgetBase {
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)

  protected options: any;
  protected max_n: number;
  protected hz: any;

  @Input() protected worker: string;

  constructor(private messageService: MessageService,
              protected stateService: StateService,
              private dataService: DataService,
              private name: string) {
      super();
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

  onExport() {
    let config = this.stateService.currentConfig;
    if (config == undefined) return;
    this.dataService.exportData(config.id, this.worker, this.name)
                    .subscribe(path => this.messageService.show('CSV written to ' + path));
  }

  onDownload() {
    let config = this.stateService.currentConfig;
    if (config == undefined) return;
    window.open(`/export/${config.id}?key=${this.worker}&name=${this.name}`, '_blank');
  }

  private _plot(): void {
    if (this.data == undefined) return;
    this.plotted = true;
    this.plot();
  }

  abstract plot(): void;

  // return the value in the (monotonic increasing) ticks array closest to the given value, v
  protected nearestTick(value: number, ticks: number[]): any {
    let t0: any = { };
    for (let idx in ticks) {
      let t = { value: ticks[idx], index: idx };
      if (t.value > value) {
        return t0 != undefined && (value - t0.value <= t.value - value) ? t0 : t;
      }
      t0 = t;
    }
    return t0;
  }
}
