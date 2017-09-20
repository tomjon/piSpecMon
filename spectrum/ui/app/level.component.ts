import { Component, Input, ViewChild } from '@angular/core';
import { MessageService } from './message.service';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { Chart } from './chart';
import { FreqPipe } from './freq.pipe';
import { _d3 as d3, dt_format, insertLineBreaks, timeTicks } from './d3_import';

@Component({
  selector: 'psm-level',
  directives: [ WidgetComponent ],
  inputs: [ 'worker' ],
  template: `<psm-widget [hidden]="isHidden" title="{{label}} - Level / Time" class="chart" (show)="onShow($event)">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="top">Top</label>
                   <select class="form-control" #selectN [(ngModel)]="N" (ngModelChange)="plot()" name="top"></select>
                 </div>
                 <div class="form-group">
                   <label for="by">by</label>
                   <select class="form-control" [(ngModel)]="top" (ngModelChange)="plot()" name="by">
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
export class LevelComponent extends Chart {
  top: string = 'avg';
  N: number = 1;
  freq_idx: number;

  svg: any;
  colour: any;
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
  tick: any;
  checked: any = { };

  @ViewChild('chart') chart;
  @ViewChild('text') text;
  @ViewChild('selectN') selectN;

  constructor(messageService: MessageService, stateService: StateService, dataService: DataService, private freq_pipe: FreqPipe) {
    super(messageService, stateService, dataService, 'level');
  }

  ngOnInit() {
    this.init();

    this.margin = this.options.margin;
    this.width = this.options.width - this.margin.left - this.margin.right,
    this.height = this.options.height - this.margin.top - this.margin.bottom;

    this.x = d3.time.scale().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.colour = d3.scale.category10();

    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    d3.select(this.selectN.nativeElement)
      .selectAll("option")
      .data(d3.range(1, this.max_n + 1))
      .enter().append("option")
      .text(d => d);
  }

  get isHidden(): boolean {
    return this.data == undefined || this.data.spectrum.levels == undefined || this.data.spectrum.levels.length < 2;
  }

  get freqs(): any {
    return this.values.freqs;
  }

  get rdsNames(): any {
    return this.data.rdsNames;
  }

  plot() {
    if (! this.svg) return;

    this.svg.selectAll("g").remove();
    this.showInfo = false;

    if (this.isHidden) return;

    let data = this.data.spectrum.levels;
    let agg = this.data.spectrum.agg[this.top];
    let freq_idxs = this.data.spectrum.freq_idxs;

    for (let i = 0; i < this.N; ++i) {
      if (freq_idxs[this.top][i] == undefined) {
        this.N = i;
        break;
      }
    }
    freq_idxs = freq_idxs[this.top].slice(0, this.N);

    this.x.domain(d3.extent(data, d => d.timestamp));
    if (this.options.y_axis) {
      this.y.domain([this.options.y_axis[0], this.options.y_axis[1]]);
      this.yAxis.tickValues(d3.range(this.options.y_axis[0], this.options.y_axis[1] + this.options.y_axis[2], this.options.y_axis[2]));
    } else {
      this.y.domain([
        d3.min(data, function (d) { return d3.min(d.timestamp.buckets, function (v) { return v.level.value }) }),
        d3.max(data, function (d) { return d3.max(d.timestamp.buckets, function (v) { return v.level.value }) })
      ]);
    }
    timeTicks(this.xAxis, this.x.domain(), this.options.x_ticks);

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
        .text("Indicative Level");

    let freq = this.svg.selectAll(".freq")
                   .data(freq_idxs)
                   .enter().append("g")
                   .attr("class", "freq");

    freq.append("path")
        .attr("class", "line")
        .attr("d", idx => {
          let line = d3.svg.line()
                       .x(d => this.x(d.timestamp))
                       .y(d => this.y(d.level[idx]))
                       .defined(d => d.level[idx] != null);
          return line(data);
        })
        .attr("id", idx => `level_line_${idx}`)
        .style("stroke", d => this.colour(d));

    // plot label for top frequency list
    freq.append("text")
        .attr("x", this.width + 24)
        .attr("y", (idx, i) => 16 * i)
        .attr("dy", 12)
        .text(idx => this.freq_pipe.transform(idx, this))
        .style("stroke", idx => this.colour(idx))
        .classed("freqLabel", true)
        .on('click', idx => {
          this.freq_idx = idx;
          this.showText();
          d3.event.stopPropagation();
        });

    // set up checked frequencies object and tick/cross icons
    this.checked = { };
    freq.append("text")
        .attr("x", this.width + 10)
        .attr("y", (idx, i) => 16 * i)
        .attr("dy", 12)
        .classed("freqCheck", idx => { this.checked[idx] = true; return true })
        .text("✔")
        .on('click', idx => {
          this.checked[idx] = ! this.checked[idx];
          d3.select(d3.event.target).text(this.checked[idx] ? "✔" : "✘");
          d3.select(`#level_line_${idx}`).classed("hidden", ! this.checked[idx]);
        });

    this.freq_idx = freq_idxs[0]; // default frequency to show info for is the first one
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
    this.tick = this.nearestTick(t, this.data.spectrum.levels.map(d => +d.timestamp)); // find nearest timestamp in the levels array
    this.showText();
  }

  private showText() {
    if (! this.tick) return;
    // decide where to show the info text and lines
    this.showX = this.x(this.tick.value) + this.margin.left;
    this.adjustX = this.showX > this.width / 2 ? -300 : 0;
    let f = +this.freq(0).range[0] + this.freq_idx * this.freq(0).range[2];
    let v = this.data.spectrum.levels[this.tick.index].level[this.freq_idx];
    this.showY = this.y(v) + this.margin.top;
    this.infoText = `${v}dB at ${f}${this.hz[this.freq(0).exp]}`;
    if (this.data.rdsNames[this.freq_idx]) this.infoText += ` (${this.data.rdsNames[this.freq_idx]})`;
    this.infoText += ` at ${dt_format(new Date(this.tick.value))}`;
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
