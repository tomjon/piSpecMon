import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { AUDIO_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-audiochart',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Audio Samples" class="chart">
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

  @Input() freqs: any;
  @Input() audio: any;

  @ViewChild('chart') chart;

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

    console.log(this.audio);

    var f0 = +this.freqs.range[0];
    var f1 = +this.freqs.range[1];
    let df = +this.freqs.range[2];
    this.x.domain([f0, f1]);
    this.y.domain(d3.extent(this.audio, d => d.fields.timestamp));

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
     this.rw = this.width / nf;
     this.rh = this.height / this.audio.length;

     this.g.selectAll('rect')
         .data(this.audio)
         .enter().append('rect')
         .attr('x', d => this.rw * d.fields.freq_n[0])
         .attr('y', d => this.rh * d.fields.sweep_n[0])
         .attr('width', this.rw + 1)
         .attr('height', this.rh + 1)
         .attr('style', (d, i) => d != null ? `fill:black` : 'display:none')
         .on('click', d => {
           var audio = new Audio();
           audio.src = `http://localhost:8080/wav/${d.fields.config_id}/${d.fields.sweep_n}/${d.fields.freq_n}`;
           console.log("play", audio.src);
           audio.load();
           audio.play();
         });
  }

  onClick(e) {
  }
}
