import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { LEVEL_CHART_OPTIONS, HZ_LABELS, MAX_N } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks, timeTicks } from './d3_import';

@Component({
  selector: 'psm-level',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Level / Time" class="chart">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="top">Top</label>
                   <select class="form-control" #selectN [(ngModel)]="N" (ngModelChange)="ngOnChanges()" name="top"></select>
                 </div>
                 <div class="form-group">
                   <label for="by">by</label>
                   <select class="form-control" [(ngModel)]="top" (ngModelChange)="ngOnChanges()" name="by">
                     <option value="avg">Average</option>
                     <option value="max">Maximum</option>
                     <option value="min">Minimum</option>
                   </select>
                 </div>
               </form>
               <svg #chart (click)="onClick($event)"
                 viewBox="0 0 ${LEVEL_CHART_OPTIONS.width} ${LEVEL_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
                 <svg:line class="horizontal" *ngIf="showInfo" [attr.x1]="margin.left" [attr.x2]="width + margin.left" [attr.y1]="showY" [attr.y2]="showY" />
                 <svg:line class="vertical" *ngIf="showInfo" [attr.x1]="showX" [attr.x2]="showX" [attr.y1]="height + margin.top" [attr.y2]="showY" />
                 <svg:rect class="info" *ngIf="showInfo" [attr.x]="showX + 10 + adjustX" [attr.y]="showY - 30" [attr.width]="textWidth + 20" height=21 rx=5 ry=5 />
                 <svg:text #text class="info" *ngIf="showInfo" [attr.x]="showX + 20 + adjustX" [attr.y]="showY - 15">{{infoText}}</svg:text>
               </svg>
             </psm-widget>`
})
export class LevelComponent {
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

  @Input() freqs: any;
  @Input() data: any;
  @Input('names') rdsNames: any;

  @ViewChild('chart') chart;
  @ViewChild('text') text;
  @ViewChild('selectN') selectN;

  constructor() { }

  ngOnInit() {
    this.margin = LEVEL_CHART_OPTIONS.margin;
    this.width = LEVEL_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = LEVEL_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

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
      .data(d3.range(1, MAX_N + 1))
      .enter().append("option")
      .text(d => d);
  }

  isHidden() {
    return this.data.levels == undefined || this.data.levels.length < 2;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("g").remove();
    this.showInfo = false;

    if (this.isHidden()) return;

    let data = this.data.levels;
    let agg = this.data.agg[this.top];
    let freq_idxs = this.data.freq_idxs;

    for (let i = 0; i < this.N; ++i) {
      if (freq_idxs[this.top][i] == undefined) {
        this.N = i;
        break;
      }
    }
    freq_idxs = freq_idxs[this.top].slice(0, this.N);

    this.x.domain(d3.extent(data, d => d.fields.timestamp));
    if (LEVEL_CHART_OPTIONS.y_axis) {
      this.y.domain([LEVEL_CHART_OPTIONS.y_axis[0], LEVEL_CHART_OPTIONS.y_axis[1]]);
      this.yAxis.tickValues(d3.range(LEVEL_CHART_OPTIONS.y_axis[0], LEVEL_CHART_OPTIONS.y_axis[1] + LEVEL_CHART_OPTIONS.y_axis[2], LEVEL_CHART_OPTIONS.y_axis[2]));
    } else {
      this.y.domain([
        d3.min(data, function (d) { return d3.min(d.timestamp.buckets, function (v) { return v.level.value }) }),
        d3.max(data, function (d) { return d3.max(d.timestamp.buckets, function (v) { return v.level.value }) })
      ]);
    }
    timeTicks(this.xAxis, this.x.domain(), LEVEL_CHART_OPTIONS.x_ticks);

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text("Time");

    this.svg.selectAll('g.x.axis g text').each(insertLineBreaks);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", -10)
        .attr("y", -10)
        .text("dB");

    let freq = this.svg.selectAll(".freq")
                   .data(freq_idxs)
                   .enter().append("g")
                   .attr("class", "freq");

    freq.append("path")
        .attr("class", "line")
        .attr("d", idx => {
          let line = d3.svg.line()
                       .x(d => this.x(d.fields.timestamp))
                       .y(d => this.y(d.fields.level[idx]))
                       .defined(d => d.fields.level[idx] != null);
          return line(data);
        })
        .attr("id", idx => `level_line_${idx}`)
        .style("stroke", d => this.colour(d));

    let discreteFn = idx => {
      let freq = this.freqs.freqs[idx];
      let s = (+freq.f).toFixed(3) + ' ' + HZ_LABELS[freq.exp];
      if (this.rdsNames[idx]) s += ` (${this.rdsNames[idx]})`;
      return s;
    };

    let rangeFn = idx => {
      var range = this.freqs.range;
      var f = +range[0] + idx * +range[2];
      let s = +f.toFixed(3) + ' ' + HZ_LABELS[this.freqs.exp];
      if (this.rdsNames[idx]) s += ` (${this.rdsNames[idx]})`;
      return s;
    };

    // plot label for top frequency list
    freq.append("text")
        .attr("x", this.width + 24)
        .attr("y", (idx, i) => 16 * i)
        .attr("dy", 12)
        .text(this.freqs.freqs ? discreteFn : rangeFn)
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
    this.tick = this.nearestTick(t, this.data.levels.map(d => +d.fields.timestamp)); // find nearest timestamp in the levels array
    this.showText();
  }

  private showText() {
    if (! this.tick) return;
    // decide where to show the info text and lines
    this.showX = this.x(this.tick.value) + this.margin.left;
    this.adjustX = this.showX > this.width / 2 ? -300 : 0;
    let f = +this.freqs.range[0] + this.freq_idx * this.freqs.range[2];
    let v = this.data.levels[this.tick.index].fields.level[this.freq_idx];
    this.showY = this.y(v) + this.margin.top;
    this.infoText = `${v}dB at ${f}${HZ_LABELS[this.freqs.exp]}`;
    if (this.rdsNames[this.freq_idx]) this.infoText += ` (${this.rdsNames[this.freq_idx]})`;
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
