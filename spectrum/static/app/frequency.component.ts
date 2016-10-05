import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { DatePipe } from './date.pipe';
import { Chart } from './chart';
import { FREQUENCY_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3 } from './d3_import';

declare var $;

@Component({
  selector: 'psm-frequency',
  directives: [ WidgetComponent ],
  inputs: [ 'data', 'show' ],
  pipes: [ DatePipe ],
  template: `<psm-widget [hidden]="isHidden()" title="Level / Frequency" class="chart" (show)="onShow($event)">
               <form class="form-inline" role="form">
                 <span *ngIf="sweep == 'latest'">{{timestamp | date}}</span>
                 <div class="form-group">
                   <select class="form-control" [(ngModel)]="sweep" (ngModelChange)="plot()" name="sweep">
                     <option default value="latest">Latest sweep</option>
                     <option value="avg">Average</option>
                     <option value="max">Maximum</option>
                     <option value="min">Minimum</option>
                   </select>
                 </div>
               </form>
               <svg #chart (click)="onClick($event)"
                 viewBox="0 0 ${FREQUENCY_CHART_OPTIONS.width} ${FREQUENCY_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
                 <svg:line class="horizontal" *ngIf="showInfo" [attr.x1]="margin.left" [attr.x2]="width + margin.left" [attr.y1]="showY" [attr.y2]="showY" />
                 <svg:line class="vertical" *ngIf="showInfo" [attr.x1]="showX" [attr.x2]="showX" [attr.y1]="height + margin.top" [attr.y2]="showY" />
                 <svg:rect class="info" *ngIf="showInfo" [attr.x]="showX + 10 + adjustX" [attr.y]="showY - 30" [attr.width]="textWidth + 20" height=21 rx=5 ry=5 />
                 <svg:text #text class="info" *ngIf="showInfo" [attr.x]="showX + 20 + adjustX" [attr.y]="showY - 15">{{infoText}}</svg:text>
               </svg>
             </psm-widget>`
})
export class FrequencyComponent extends Chart {
  sweep: string = 'latest';
  timestamp: number;

  svg: any;
  line: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;
  margin: any;

  showInfo: boolean = false;
  showX: number;
  showY: number;
  infoText: string = "";
  textWidth: number = 0;
  adjustX: number = 0;

  @ViewChild('chart') chart;
  @ViewChild('text') text;

  ngOnInit() {
    this.margin = FREQUENCY_CHART_OPTIONS.margin;
    this.width = FREQUENCY_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = FREQUENCY_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");
//    if (FREQUENCY_CHART_OPTIONS.x_ticks) this.xAxis().ticks(FREQUENCY_CHART_OPTIONS.x_ticks);
//    if (FREQUENCY_CHART_OPTIONS.y_ticks) this.yAxis().ticks(FREQUENCY_CHART_OPTIONS.y_ticks);

    this.line = d3.svg.line()
                  .y(d => this.y(d.v))
                  .defined(d => d.v != null);

    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
  }

  isHidden() {
    return this.data == undefined || this.data.spectrum.agg == undefined || this.data.freqs.freqs || this.data.spectrum.agg[this.sweep].length == 0;
  }

  plot() {
    if (! this.svg) return;

    this.svg.selectAll("g, path").remove();
    this.showInfo = false;

    if (this.isHidden()) return;

    this.timestamp = this.data.spectrum.levels[this.data.spectrum.levels.length - 1].fields.timestamp;
    let agg = this.data.spectrum.agg[this.sweep];

    this.x.domain([this.data.freqs.range[0], this.data.freqs.range[1]]);
    if (FREQUENCY_CHART_OPTIONS.y_axis) {
      this.y.domain([FREQUENCY_CHART_OPTIONS.y_axis[0], FREQUENCY_CHART_OPTIONS.y_axis[1]]);
      this.yAxis.tickValues(d3.range(FREQUENCY_CHART_OPTIONS.y_axis[0], FREQUENCY_CHART_OPTIONS.y_axis[1] + FREQUENCY_CHART_OPTIONS.y_axis[2], FREQUENCY_CHART_OPTIONS.y_axis[2]));
    } else {
      this.y.domain(d3.extent(agg, d => d.v));
    }

    this.line.x((d, i) => this.x(+this.data.freqs.range[0] + i * this.data.freqs.range[2]));

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text(HZ_LABELS[this.data.freqs.exp]);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", -10)
        .attr("y", -10)
        .text("dB");

    this.svg.append("path")
        .datum(agg)
        .attr("class", "line")
        .attr("d", this.line);
  }

  onClick(e) {
    if (e.target.tagName == "text" || e.target.tagName == "rect") {
      // hide info text if it is clicked on
      this.showInfo = false;
      this.infoText = "";
      return;
    }
    // find SVG co-ordinates of click...
    let p = this.chart.nativeElement.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    let z = p.matrixTransform(this.chart.nativeElement.getScreenCTM().inverse());

    // find frequency of click...
    let f = this.x.invert(z.x - this.margin.left);
    let i = Math.round((f - this.data.freqs.range[0]) / this.data.freqs.range[2]);
    if (i < 0 || i >= this.data.spectrum.agg[this.sweep].length) {
      // out of bounds - hide info text
      this.showInfo = false;
      this.infoText = "";
      return;
    }
    f = +this.data.freqs.range[0] + i * this.data.freqs.range[2]; // 'snap' to an actual frequency value
    f = f.toFixed(-Math.log10(this.data.freqs.range[2]));

    // decide where to show the info text and lines
    this.showX = this.margin.left + this.x(f);
    this.adjustX = z.x > this.width / 2 ? -150 : 0;
    let v = this.data.spectrum.agg[this.sweep][i] ? this.data.spectrum.agg[this.sweep][i].v : 0;
    this.showY = this.y(v) + this.margin.top;
    this.infoText = `${v}dB at ${f}${HZ_LABELS[this.data.freqs.exp]}`;
    if (this.data.rdsNames[i]) this.infoText += ` (${this.data.rdsNames[i]})`;
    setTimeout(() => this.textWidth = this.text.nativeElement.getComputedTextLength());
    this.showInfo = true;
  }
}
