define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return function (parent) {
      var margin = options.margin,
           width = options.width - margin.left - margin.right,
          height = options.height - margin.top - margin.bottom;

      var x = d3.time.scale().range([0, width]);
      var y = d3.scale.linear().range([height, 0]);

      var xAxis = d3.svg.axis().scale(x).orient("bottom").tickFormat(format);
      var yAxis = d3.svg.axis().scale(y).orient("left");

      var colour = d3.scale.category10();

      var svg = parent.append("svg")
                      .attr("width", width + margin.left + margin.right)
                      .attr("height", height + margin.top + margin.bottom)
                      .append("g")
                      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      return {
        q: function (config_id) {
          return 'spectrum/sweep/_search?size=10000&q=config_id:' + config_id + '&fields=*';
        },

        clear: function () {
          svg.selectAll("*").remove();
        },

        render: function (resp, opts, conf) {
          var data = resp.hits.hits;
          if (data.length == 0) {
            return;
          }

          data.sort(function (x, y) { return x.fields.timestamp - y.fields.timestamp });

          /* find top N by avg, min or max */
          var agg = [];
          for (var sweep_idx in data) {
            for (var freq_idx in data[sweep_idx].fields.level) {
              var level = data[sweep_idx].fields.level[freq_idx];
              if (opts.top == 'min') {
                if (agg[freq_idx] == null || level < agg[freq_idx].v) {
                  agg[freq_idx] = { idx: freq_idx, v: level };
                }
              } else if (opts.top == 'max') {
                if (agg[freq_idx] == null || level > agg[freq_idx].v) {
                  agg[freq_idx] = { idx: freq_idx, v: level };
                }
              } else {
                if (agg[freq_idx] == null) {
                  agg[freq_idx] = { idx: freq_idx, v: 0 };
                }
                agg[freq_idx].v += level;
              }
            }
          }
          if (opts.top == 'min') {
            agg.sort(function (x, y) { return x.v - y.v });
          } else {
            agg.sort(function (x, y) { return y.v - x.v });
          }
          var freq_idxs = [];
          for (var n = 0; n < opts.N; ++n) {
            freq_idxs[n] = agg[n].idx;
          }

          x.domain(d3.extent(data, function (d) { return d.fields.timestamp }));
          if (options.y_axis) {
            y.domain([options.y_axis[0], options.y_axis[1]]);
            yAxis.tickValues(d3.range(options.y_axis[0], options.y_axis[1] + options.y_axis[2], options.y_axis[2]));
          } else {
            y.domain([
              d3.min(data, function (d) { return d3.min(d.timestamp.buckets, function (v) { return v.level.value }) }),
              d3.max(data, function (d) { return d3.max(d.timestamp.buckets, function (v) { return v.level.value }) })
            ]);
          }

          svg.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis)
             .append("text")
             .attr("transform", "translate(" + width + ",0)")
             .attr("x", 40)
             .attr("y", 6)
             .style("text-anchor", "end")
             .text("Time");

          svg.selectAll('g.x.axis g text').each(insertLineBreaks);

          svg.append("g")
             .attr("class", "y axis")
             .call(yAxis)
             .append("text")
             .attr("x", -10)
             .attr("y", -10)
             .text("dB");

          var freq = svg.selectAll(".freq")
                        .data(freq_idxs)
                        .enter().append("g")
                        .attr("class", "freq");

          freq.append("path")
              .attr("class", "line")
              .attr("d", function (idx) {
                var line = d3.svg.line().interpolate("monotone")
                             .x(function (d) { return x(d.fields.timestamp) })
                             .y(function (d) { return y(d.fields.level[idx]) });
                return line(data);
              })
              .style("stroke", function (d) { return colour(d) });

          /*freq.append("text")
              .datum(function (d) { return d })
              .attr("transform", function (d) { return "translate(" + x(d.value.date) + "," + y(d.value.temperature) + ")"; })
              .attr("x", 3)
              .attr("dy", ".35em")
              .text(function(d) { return d.key });*/
        }
      };
    };
  };
});
