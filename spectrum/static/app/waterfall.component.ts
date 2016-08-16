import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { WATERFALL_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-waterfall',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Waterfall" class="chart">
               <svg #chart (click)="onClick($event)"
                 viewBox="0 0 ${WATERFALL_CHART_OPTIONS.width} ${WATERFALL_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
                 <svg:g #group />
                 <svg:rect id="infoText" class="info" *ngIf="showInfo" [attr.x]="showX + 10" [attr.y]="showY - 30" [attr.width]="textWidth + 20" height=21 rx=5 ry=5 />
                 <svg:text #text class="info" [attr.x]="showX + 20" [attr.y]="showY - 15">{{infoText}}</svg:text>
               </svg>
             </psm-widget>`
})
export class WaterfallComponent {
  svg: any;
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

  //FIXME these attributes are copied from frequency chart... abstract?
  showInfo: boolean;
  showX: number;
  showY: number;
  infoText: string = "";
  textWidth: number = 0;

  @Input() freqs: any;
  @Input() data: any;

  @ViewChild('chart') chart;
  @ViewChild('text') text;
  @ViewChild('group') group;

  constructor() { }

  ngOnInit() {
    this.margin = WATERFALL_CHART_OPTIONS.margin;
    this.width = WATERFALL_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = WATERFALL_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.time.scale().range([0, this.height]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left").tickFormat(dt_format);
//    if (WATERFALL_CHART_OPTIONS.x_ticks) this.xAxis().ticks(WATERFALL_CHART_OPTIONS.x_ticks);
//    if (WATERFALL_CHART_OPTIONS.y_ticks) this.yAxis().ticks(WATERFALL_CHART_OPTIONS.y_ticks);

    this.heat = d3.scale.linear().domain(WATERFALL_CHART_OPTIONS.heat).range(["blue", "yellow", "red"]).clamp(true);

    this.svg = d3.select(this.chart.nativeElement);
    this.g = this.svg.insert("g", ":first-child")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
  }

  isHidden() {
    return this.data.levels == undefined || this.freqs.freqs || this.data.levels.length < 2;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.g.selectAll("g *").remove();

    if (this.isHidden()) return;

    let data = this.data.levels;

    var f0 = +this.freqs.range[0];
    var f1 = +this.freqs.range[1];
    let df = +this.freqs.range[2];
    this.x.domain([f0, f1]);
    this.y.domain(d3.extent(data, d => d.fields.timestamp));

    this.g.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text(HZ_LABELS[this.freqs.exp]);

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

     let g = this.g.selectAll('g.row')
                 .data(data)
                 .enter().append('g').attr("class", 'row')
                 .attr('transform', (d, i) => `translate(1, ${this.rh * i - 1})`);

     g.selectAll('rect')
      .data(d => d.fields.level)
      .enter().append('rect')
      .attr('x', (d, i) => this.rw * i)
      .attr('width', this.rw + 1)
      .attr('height', this.rh + 1)
      .attr('style', (d, i) => d != null ? `fill:${this.heat(d)}` : 'display:none');
  }

  //FIXME much copied from frequency chart, abstract?
  onClick(e) {
    if (e.target.tagName == "text" || (e.target.tagName == "rect" && e.target.id == "infoText")) {
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
    let i = Math.round((f - this.freqs.range[0]) / this.freqs.range[2]);
    f = +this.freqs.range[0] + i * this.freqs.range[2]; // 'snap' to an actual frequency value
    f = f.toFixed(-Math.log10(this.freqs.range[2]));
    if (i < 0 || i >= this.data.levels[0].fields.level.length) {
      // out of bounds - hide info text
      this.showInfo = false;
      this.infoText = "";
      return;
    }

    // find timestamp of click...
    let j = Math.round(z.y / this.rh) - 1;
    if (j < 0 || j >= this.data.levels.length) {
      // out of bounds - hide info text
      this.showInfo = false;
      this.infoText = "";
      return;
    }
    let t = this.data.levels[j].fields.timestamp;

    // decide where to show the info text and lines
    this.showX = this.margin.left + this.x(f);
    if (z.x > this.width / 2) {
      this.showX -= 300;
    }
    this.showY = (j + 1) * this.rh + this.margin.top;
    let v = this.data.levels[j].fields.level[i];
    this.infoText = `${v}dB at ${f}${HZ_LABELS[this.freqs.exp]} at ${dt_format(new Date(+t))}`;
    setTimeout(() => this.textWidth = this.text.nativeElement.getComputedTextLength());
    this.showInfo = true;
  }
}
