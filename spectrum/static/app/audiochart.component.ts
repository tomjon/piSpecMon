import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { AUDIO_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-audiochart',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Audio Samples" class="chart">
               <form class="form-inline" role="form">
                 <span *ngIf="infoText">{{infoText}}</span>
                 <div class="form-group">
                  <audio #audio controls preload='none'></audio>
                 </div>
               </form>
               <svg #chart
                 viewBox="0 0 ${AUDIO_CHART_OPTIONS.width} ${AUDIO_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
               </svg>
             </psm-widget>`
})
export class AudioChartComponent {
  svg: any;
  g: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;
  rh: number;
  rw: number;
  margin: any;
  infoText: string;

  @Input() freqs: any;
  @Input() audio: any;

  @ViewChild('chart') chart;
  @ViewChild('audio') audioControl;

  constructor() { }

  ngOnInit() {
    this.margin = AUDIO_CHART_OPTIONS.margin;
    this.width = AUDIO_CHART_OPTIONS.width - this.margin.left - this.margin.right,
    this.height = AUDIO_CHART_OPTIONS.height - this.margin.top - this.margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.time.scale().range([0, this.height]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left").tickFormat(dt_format);
//    if (AUDIO_CHART_OPTIONS.x_ticks) this.xAxis().ticks(AUDIO_CHART_OPTIONS.x_ticks);
//    if (AUDIO_CHART_OPTIONS.y_ticks) this.yAxis().ticks(AUDIO_CHART_OPTIONS.y_ticks);

    this.svg = d3.select(this.chart.nativeElement);
    this.g = this.svg.insert("g", ":first-child")
                 .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
  }

  isHidden() {
    return this.audio.length == 0;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.g.selectAll("g").remove();

    if (this.isHidden()) return;

    var f0 = +this.freqs.range[0];
    var f1 = +this.freqs.range[1];
    let df = +this.freqs.range[2];
    this.x.domain([f0 - df/2, f1 + df/2]);
    this.y.domain(d3.extent(this.audio, d => d.sort[0]));

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

     let nf = (this.freqs.range[1] - this.freqs.range[0]) / this.freqs.range[2];
     this.rw = 20;//this.width / nf;
     this.rh = 20;//this.height / this.audio.length;

     this.g.selectAll('rect')
         .data(this.audio)
         .enter().append('rect')
         .attr('x', d => this.x(f0 + d.fields.freq_n[0] * df) - this.rw / 2)
         .attr('y', d => this.y(d.sort[0]) - this.rh / 2)
         .attr('width', this.rw + 1)
         .attr('height', this.rh + 1)
         .attr('style', (d, i) => d != null ? `fill:black` : 'display:none')
         .on('click', d => {
           let f = f0 + d.fields.freq_n[0] * df;
           this.infoText = `${f.toFixed(-Math.log10(df))}${HZ_LABELS[this.freqs.exp]} at ${dt_format(new Date(d.sort[0]))}`;
           let a = this.audioControl.nativeElement;
           a.src = `/wav/${d.fields.config_id[0]}/${d.fields.sweep_n[0]}/${d.fields.freq_n[0]}`;
           a.load();
           a.play();
         });
  }
}
