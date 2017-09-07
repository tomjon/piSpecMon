import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { Chart } from './chart';
import { TEMPERATURE_CHART_OPTIONS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks, timeTicks } from './d3_import';

@Component({
  selector: 'psm-temperature',
  directives: [ WidgetComponent ],
  inputs: [ 'data', 'timestamp' ],
  template: `<psm-widget [hidden]="isHidden()" title="Temperature / Time" class="chart" (show)="onShow($event)">
               <svg #chart (click)="onClick($event)"
                 viewBox="0 0 ${TEMPERATURE_CHART_OPTIONS.width} ${TEMPERATURE_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
                 <svg:line class="horizontal" *ngIf="showInfo" [attr.x1]="margin.left" [attr.x2]="width + margin.left" [attr.y1]="showY" [attr.y2]="showY" />
                 <svg:line class="vertical" *ngIf="showInfo" [attr.x1]="showX" [attr.x2]="showX" [attr.y1]="height + margin.top" [attr.y2]="showY" />
                 <svg:rect class="info" *ngIf="showInfo" [attr.x]="showX + 10 + adjustX" [attr.y]="showY - 30" [attr.width]="textWidth + 20" height=21 rx=5 ry=5 />
                 <svg:text #text class="info" *ngIf="showInfo" [attr.x]="showX + 20 + adjustX" [attr.y]="showY - 15">{{infoText}}</svg:text>
               </svg>
             </psm-widget>`
})
export class TemperatureComponent extends Chart {
  svg: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;
  margin: any;
  line: any;

  showInfo: boolean = false;
  showX: number;
  showY: number;
  infoText: string = "";
  textWidth: number = 0;
  adjustX: number = 0;
  tick: any;
  checked: any = { };

  @ViewChild('chart') chart;
  @ViewChild('text') text;

  constructor(stateService: StateService) { super(stateService) }

  ngOnInit() {
    this.margin = TEMPERATURE_CHART_OPTIONS.margin;
    this.width = TEMPERATURE_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = TEMPERATURE_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

    this.x = d3.time.scale().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.line = d3.svg.line()
                  .x(d => this.x(d[0]))
                  .y(d => this.y(d[1]));
    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
  }

  isHidden() {
    return this.data == undefined || this.data.temperature.length < 2;
  }

  plot() {
    if (! this.svg) return;

    this.svg.selectAll("g, path").remove();
    this.showInfo = false;

    if (this.isHidden()) return;

    let data = this.data.temperature;

    this.x.domain(d3.extent(data, d => d[0]));
    if (TEMPERATURE_CHART_OPTIONS.y_axis) {
      this.y.domain([TEMPERATURE_CHART_OPTIONS.y_axis[0], TEMPERATURE_CHART_OPTIONS.y_axis[1]]);
      this.yAxis.tickValues(d3.range(TEMPERATURE_CHART_OPTIONS.y_axis[0], TEMPERATURE_CHART_OPTIONS.y_axis[1] + TEMPERATURE_CHART_OPTIONS.y_axis[2], TEMPERATURE_CHART_OPTIONS.y_axis[2]));
    } else {
      this.y.domain([
        d3.min(data, function (d) { return d3.min(d.timestamp.buckets, function (v) { return v.level.value }) }),
        d3.max(data, function (d) { return d3.max(d.timestamp.buckets, function (v) { return v.level.value }) })
      ]);
    }

    timeTicks(this.xAxis, this.x.domain(), TEMPERATURE_CHART_OPTIONS.x_ticks);

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("text-anchor", "end")
        .attr("y", -6)
        .attr("transform", "translate(" + this.width + ",0)")
        .text("Time");

    this.svg.selectAll('g.x.axis g text').each(insertLineBreaks);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("Temperature");

    this.svg.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", this.line);

    this.showInfo = false;
    this.infoText = "";
  }

  onClick(e) {
    if (e.target.tagName == "text" || e.target.tagName == "rect") {
      // hide info text if it is clicked on
      this.showInfo = false;
      this.infoText = "";
      delete this.tick;
      return;
    }
    // find SVG co-ordinates of click...
    let p = this.chart.nativeElement.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    let z = p.matrixTransform(this.chart.nativeElement.getScreenCTM().inverse());
    // find timestamp of click...
    let t = this.x.invert(z.x - this.margin.left);
    if (t < this.x.domain()[0] || t > this.x.domain()[1]) {
      // out of bounds - hide info text
      this.showInfo = false;
      this.infoText = "";
      delete this.tick;
      return;
    }
    this.tick = this.nearestTick(t, this.data.temperature.map(d => +d[0])); // find nearest timestamp in the levels array
    this.showText();
  }

  private showText() {
    if (! this.tick) return;
    // decide where to show the info text and lines
    this.showX = this.x(this.tick.value) + this.margin.left;
    this.adjustX = this.showX > this.width / 2 ? -300 : 0;
    let t = this.data.temperature[this.tick.index][1];
    this.showY = this.y(t) + this.margin.top;
    this.infoText = `${t}°c at ${dt_format(new Date(this.tick.value))}`;
    setTimeout(() => this.textWidth = this.text.nativeElement.getComputedTextLength());
    this.showInfo = true;
  }

  // return the value in the (monotonic increasing) ticks array closest to the given value, v
  private nearestTick(value: number, ticks: number[]): any {
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
