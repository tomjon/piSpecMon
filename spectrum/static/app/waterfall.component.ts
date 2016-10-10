import { Component, ViewChild } from '@angular/core';
import { Chart } from './chart';
import { WidgetComponent } from './widget.component';
import { Data} from './data';
import { WATERFALL_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks, timeTicks } from './d3_import';

declare var $;

@Component({
  selector: 'psm-waterfall',
  directives: [ WidgetComponent ],
  inputs: [ 'data', 'show' ],
  template: `<psm-widget [hidden]="isHidden()" title="Waterfall" class="chart" (show)="onShow($event)">
               <form class="form-inline controls" role="form">
                 <div *ngIf="showSamples" class="form-group">
                   <audio #audio controls preload='none'></audio>
                 </div>
               </form>
               <form class="form-inline" role="form">
                 <span class="infoText">{{infoText}}</span>
                 <label for="samples">Overlay audio samples</label>
                 <input type="checkbox" name="samples" [disabled]="! data || data.audio.length == 0" [(ngModel)]="showSamples">
               </form>
               <div class="waterfall">
                 <svg #chart (click)="onClick($event)"
                   viewBox="0 0 ${WATERFALL_CHART_OPTIONS.width} ${WATERFALL_CHART_OPTIONS.height}"
                   preserveAspectRatio="xMidYMid meet">
                   <svg:g />
                 </svg>
                 <canvas #canvas width="${WATERFALL_CHART_OPTIONS.width}" height="${WATERFALL_CHART_OPTIONS.height}"></canvas>
                 <canvas #overlay [hidden]="! showSamples" width="${WATERFALL_CHART_OPTIONS.width}" height="${WATERFALL_CHART_OPTIONS.height}"></canvas>
               </div>
             </psm-widget>`
})
export class WaterfallComponent extends Chart {
  svg: any;
  context: any;
  overctx: any;
  g: any;
  heat: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;
  rh: number;
  rw: number;
  margin: any;

  infoText: string = "";
  showSamples: boolean = false;

  @ViewChild('chart') chart;
  @ViewChild('text') text;
  @ViewChild('audio') audioControl;
  @ViewChild('canvas') canvas;
  @ViewChild('overlay') overlay;

  constructor() {
    super(1); //FIXME this puts the waterfall chart in a later frame than the others - can maybe be removed if drawing the waterfall is quicker
  }

  ngOnInit() {
    this.margin = WATERFALL_CHART_OPTIONS.margin;
    this.width = WATERFALL_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = WATERFALL_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.time.scale().range([0, this.height]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.heat = d3.scale.linear().domain(WATERFALL_CHART_OPTIONS.heat).range(["blue", "yellow", "red"]).clamp(true);

    this.svg = d3.select(this.chart.nativeElement);
    this.g = this.svg.insert("g", ":first-child")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.context = this.canvas.nativeElement.getContext("2d");
    this.overctx = this.overlay.nativeElement.getContext("2d");
  }

  isHidden() {
    return this.data == undefined || this.data.spectrum.levels == undefined || this.data.freqs.freqs || this.data.spectrum.levels.length < 1;
  }

  private rect(context: any, i: number, j: number, fill: string) {
    context.fillStyle = fill;
    context.fillRect(this.margin.left + i * this.rw, 1 + this.margin.top + j * this.rh, this.rw + 1, this.rh + 1);
  }

  plot() {
    if (! this.svg) return;

    this.g.selectAll("g *").remove();
    this.overctx.clearRect(0, 0, this.overctx.canvas.width, this.overctx.canvas.height);
    this.infoText = "";

    if (this.isHidden()) return;

    let data = this.data.spectrum.levels;

    var f0 = +this.data.freqs.range[0];
    var f1 = +this.data.freqs.range[1];
    let df = +this.data.freqs.range[2];
    this.x.domain([f0 - df/2, f1 + df/2]);
    this.y.domain(d3.extent(data, d => d.fields.timestamp));
    timeTicks(this.yAxis, this.y.domain(), WATERFALL_CHART_OPTIONS.y_ticks);

    this.g.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text(HZ_LABELS[this.data.freqs.exp]);

    this.g.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", 15)
        .attr("y", -10)
        .style("text-anchor", "end")
        .text("Time");

    this.svg.selectAll('g.y.axis g text').each(insertLineBreaks);

    this.rw = this.width / data[0].fields.level.length;
    this.rh = this.height / data.length;

    for (let y_idx in data) {
      let row = data[y_idx];
      for (let x_idx in row.fields.level) {
        let level = row.fields.level[x_idx];
        this.rect(this.context, +x_idx, +y_idx, this.heat(level));
        if (this.data.audio[`${y_idx}_${x_idx}`] != undefined) {
          this.rect(this.overctx, +x_idx, +y_idx, 'green');
        }
      }
    }
  }

  //FIXME much copied from frequency chart, abstract?
  onClick(e) {
    // find SVG co-ordinates of click...
    let p = this.chart.nativeElement.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY - this.margin.top;
    let z = p.matrixTransform(this.chart.nativeElement.getScreenCTM().inverse());

    // find frequency of click...
    let f = this.x.invert(z.x - this.margin.left);
    let i = Math.round((f - this.data.freqs.range[0]) / this.data.freqs.range[2]);
    f = +this.data.freqs.range[0] + i * this.data.freqs.range[2]; // 'snap' to an actual frequency value
    f = f.toFixed(-Math.log10(this.data.freqs.range[2]));
    if (i < 0 || i >= this.data.spectrum.levels[0].fields.level.length) {
      // out of bounds - hide info text
      this.infoText = "";
      return;
    }

    // find timestamp of click...
    let j = Math.floor(z.y / this.rh);
    if (j < 0 || j >= this.data.spectrum.levels.length) {
      // out of bounds - hide info text
      this.infoText = "";
      return;
    }
    let t = this.data.spectrum.levels[j].fields.timestamp;

    // formulate info text
    let v = this.data.spectrum.levels[j].fields.level[i];
    this.infoText = `${v}dB at ${f}${HZ_LABELS[this.data.freqs.exp]}`;
    if (this.data.rdsNames[i]) this.infoText += ` (${this.data.rdsNames[i]})`;
    this.infoText += ` at ${dt_format(new Date(t))}`;

    // if it's an audio sample, play it (and we are showing samples)
    if (this.showSamples) {
      let audio = this.data.audio[`${j}_${i}`];
      if (audio != undefined) {
        let control = this.audioControl.nativeElement;
        control.src = audio;
        control.load();
        control.play();
      }
    }
  }
}
