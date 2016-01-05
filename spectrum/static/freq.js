define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function(options) {
    return function (parent) {
      var margin = options.margin,
           width = options.width - margin.left - margin.right,
          height = options.height - margin.top - margin.bottom;

      var x = d3.scale.linear().range([0, width]);
      var y = d3.scale.linear().range([height, 0]);

      var xAxis = d3.svg.axis().scale(x).orient("bottom");
      var yAxis = d3.svg.axis().scale(y).orient("left");

      var line = d3.svg.line().interpolate("monotone")
                   .y(function(d) { return y(d.v) });

      var svg = parent.append("svg")
                      .attr("width", width + margin.left + margin.right)
                      .attr("height", height + margin.top + margin.bottom)
                      .append("g")
                      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      return {
        q: function (config_id) {
          return 'spectrum/sweep/_search?size=10000&q=config_id:' + config_id + '&fields=*';
        },

        clear: function() {
          svg.selectAll("*").remove();
        },

        render: function (resp, opts, conf) {
          if (conf.freqs.freqs) {
            return false;
          }

          var data = resp.hits.hits;
          if (data.length == 0) {
            return;
          }

          data.sort(function (x, y) { return x.fields.timestamp - y.fields.timestamp });

          /* find top N by avg, min or max */
          var agg = [];
          if (opts.sweep == 'latest') {
            for (var freq_idx in data[data.length - 1].fields.level) {
              agg[freq_idx] = { idx: freq_idx, v: data[data.length - 1].fields.level[freq_idx] };
            }
          } else {
            for (var sweep_idx in data) {
              for (var freq_idx in data[sweep_idx].fields.level) {
                var level = data[sweep_idx].fields.level[freq_idx];
                if (opts.sweep == 'min') {
                  if (agg[freq_idx] == null || level < agg[freq_idx].v) {
                    agg[freq_idx] = { idx: freq_idx, v: level };
                  }
                } else if (opts.sweep == 'max') {
                  if (agg[freq_idx] == null || level > agg[freq_idx].v) {
                    agg[freq_idx] = { idx: freq_idx, v: level };
                  }
                } else {
                  if (agg[freq_idx] == null) {
                    agg[freq_idx] = { idx: freq_idx, v: 0 };
                  }
                  agg[freq_idx].v += level / data.length;
                }
              }
            }
          }

          x.domain([conf.freqs.range[0], conf.freqs.range[1]]);
          if (options.y_axis) {
            y.domain([options.y_axis[0], options.y_axis[1]]);
            yAxis.tickValues(d3.range(options.y_axis[0], options.y_axis[1] + options.y_axis[2], options.y_axis[2]));
          } else {
            y.domain(d3.extent(agg, function (d) { return d.v }));
          }

          line.x(function (d, i) { return x(+conf.freqs.range[0] + i * conf.freqs.range[2]) });

          svg.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis)
             .append("text")
             .attr("transform", "translate(" + width + ",0)")
             .attr("x", 40)
             .attr("y", 6)
             .style("text-anchor", "end")
             .text(hz[conf.freqs.exp]);

          svg.append("g")
             .attr("class", "y axis")
             .call(yAxis)
             .append("text")
             .attr("x", -10)
             .attr("y", -10)
             .text("dB");

          svg.append("path")
             .datum(agg)
             .attr("class", "line")
             .attr("d", line);
        }
      };
    };
  };
});
