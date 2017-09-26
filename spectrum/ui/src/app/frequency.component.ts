import { Component, Input, ViewChild } from '@angular/core';
import { MessageService } from './message.service';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { Chart } from './chart';
import { _d3 as d3 } from './d3_import';

@Component({
  selector: 'psm-frequency',
  inputs: [ 'worker' ],
  template: `<psm-widget [hidden]="isHidden()" title="{{label}} - Level / Frequency" class="chart" (show)="onShow($event)">
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
               <svg #chart (click)="onClick($event)" [attr.viewBox]="viewBox" preserveAspectRatio="xMidYMid meet">
                 <svg:line class="horizontal" *ngIf="showInfo" [attr.x1]="margin.left" [attr.x2]="width + margin.left" [attr.y1]="showY" [attr.y2]="showY" />
                 <svg:line class="vertical" *ngIf="showInfo" [attr.x1]="showX" [attr.x2]="showX" [attr.y1]="height + margin.top" [attr.y2]="showY" />
                 <svg:rect class="info" *ngIf="showInfo" [attr.x]="showX + 10 + adjustX" [attr.y]="showY - 30" [attr.width]="textWidth + 20" height=21 rx=5 ry=5 />
                 <svg:text #text class="info" *ngIf="showInfo" [attr.x]="showX + 20 + adjustX" [attr.y]="showY - 15">{{infoText}}</svg:text>
               </svg>
             </psm-widget>`
})
export class FrequencyComponent extends Chart {
  sweep: string = 'latest';

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

  constructor(messageService: MessageService, stateService: StateService, dataService: DataService, private freq_pipe: FreqPipe) {
    super(messageService, stateService, dataService, 'frequency');
  }

  ngOnInit() {
    this.init();

    this.margin = this.options.margin;
    this.width = this.options.width - this.margin.left - this.margin.right,
    this.height = this.options.height - this.margin.top - this.margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.line = d3.svg.line()
                  .y(d => this.y(d.v))
                  .defined(d => d.v != null);

    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
  }

  isHidden() {
    return this.data == undefined || this.data.spectrum.agg == undefined || ! this.freq(0).enabled || this.data.spectrum.agg[this.sweep].length == 0;
  }

  plot() {
    if (! this.svg) return;

    this.svg.selectAll("g, path").remove();
    this.showInfo = false;

    if (this.isHidden()) return;

    let agg = this.data.spectrum.agg[this.sweep];

    this.x.domain([this.freq(0).range[0], this.freq(0).range[1]]);
    if (this.options.y_axis) {
      this.y.domain([this.options.y_axis[0], this.options.y_axis[1]]);
      this.yAxis.tickValues(d3.range(this.options.y_axis[0], this.options.y_axis[1] + this.options.y_axis[2], this.options.y_axis[2]));
    } else {
      this.y.domain(d3.extent(agg, d => d.v));
    }

    this.line.x((d, i) => this.x(+this.freq(0).range[0] + i * this.freq(0).range[2]));

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("text-anchor", "end")
        .attr("y", -6)
        .text(this.hz[this.freq(0).exp]);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("Indicative Level");

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
    let i = Math.round((f - this.freq(0).range[0]) / this.freq(0).range[2]);
    if (i < 0 || i >= this.data.spectrum.agg[this.sweep].length) {
      // out of bounds - hide info text
      this.showInfo = false;
      this.infoText = "";
      return;
    }

    // decide where to show the info text and lines
    this.showX = this.margin.left + this.x(f);
    this.adjustX = z.x > this.width / 2 ? -150 : 0;
    let v = this.data.spectrum.agg[this.sweep][i] ? this.data.spectrum.agg[this.sweep][i].v : 0;
    this.showY = this.y(v) + this.margin.top;
    this.infoText = `${v}dB at ${this.freq_pipe.transform(i, this.data)}`;
    setTimeout(() => this.textWidth = this.text.nativeElement.getComputedTextLength());
    this.showInfo = true;
  }
}
