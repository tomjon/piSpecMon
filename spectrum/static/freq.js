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
                   .y(function(d) { return y(d.level.value) });

      var svg = parent.append("svg")
                      .attr("width", width + margin.left + margin.right)
                      .attr("height", height + margin.top + margin.bottom)
                      .append("g")
                      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      return {
        q: function (config_id, opts, conf) {
          if (! config_id || conf.freqs.freqs) {
            return null;
          }
          if (opts.sweep == 'latest') {
            return {
              query: {
                query_string: {
                  query: "config_id:" + config_id
                }
              },
              aggs: {
                latest: {
                  terms: {
                    field: "timestamp",
                    size: 1,
                    order: {
                      _term: "desc"
                    }
                  },
                  aggs: {
                    index: {
                      terms: {
                        field: "index",
                        size: 0
                      },
                      aggs: {
                        level: {
                          avg: {
                            field: "level"
                          }
                        }
                      }
                    }
                  }
                }
              }
            };
          } else {
            var level_agg = {};
            level_agg[opts.sweep] = { field: "level" };
            return {
              query: {
                query_string: {
                  query: "config_id:" + config_id
                }
              },
              aggs: {
                index: {
                  terms: {
                    field: "index",
                    size: 0
                  },
                  aggs: {
                    level: level_agg
                  }
                }
              }
            };
          }
        },

        clear: function () {
          svg.selectAll("*").remove();
        },

        render: function (resp, opts, conf) {
          var data;
          if (resp.aggregations.latest) {
            if (resp.aggregations.latest.buckets.length > 0) {
              data = resp.aggregations.latest.buckets[0].index.buckets;
            } else {
              return;
            }
          } else {
            data = resp.aggregations.index.buckets;
          }

          x.domain([conf.freqs.range[0], conf.freqs.range[1]]);
          if (options.y_axis) {
            y.domain([options.y_axis[0], options.y_axis[1]]);
            yAxis.tickValues(d3.range(options.y_axis[0], options.y_axis[1] + options.y_axis[2], options.y_axis[2]));
          } else {
            y.domain(d3.extent(data, function (d) { return d.level.value }));
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
             .datum(data)
             .attr("class", "line")
             .attr("d", line);
        }
      };
    };
  };
});
