// globals, available to all modules
var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
var format = "%d/%m/%Y %X";
var debug = false;
var insertLineBreaks;
var getOptions;
var LOG, readUI, updateUI;
var dispatch;
var values = { data_set: { config_id: null, config: null, range: null }, freqs_set: { config_id: null, config: null } };
var maxN = 10;
var units = [' bytes', 'k', 'M', 'G'];
var chartHeight = 400;

function convertBytes(bytes, hideUnits) {
  var m = Math.floor(Math.log2(bytes) / 10);
  if (m >= units.length) m = units.length - 1;
  var s = (bytes / Math.pow(2, 10 * m)).toFixed(1);
  return hideUnits ? s : s + units[m];
}

define(['lib/d3/d3.v3', 'util', 'stats', 'level', 'freq', 'waterfall', 'config', 'sweep', 'caps', 'rig', 'charts', 'error', 'range'],
       function (d3, util, stats, level, freq, waterfall, config, sweep, caps, rig, charts, error, range) {
  "use strict";

  // initialise globals
  format = d3.time.format(format);

  insertLineBreaks = function (d) {
    var el = d3.select(this);
    var words = format(d).split(' ');
    el.text('');

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0) {
        tspan.attr('x', 0).attr('dy', '15');
      }
    }
  };

  LOG = function () {
    if (debug) {
      console.log.apply(console, arguments);
    }
  };

  updateUI = function (conf) {
    for (var id in conf) {
      d3.select("#" + id).property("value", conf[id]);
    }
  }

  readUI = function (id, conf) {
    d3.select("#" + id).selectAll("select, input").each(function () {
      var d = d3.select(this);
      conf[d.attr("id")] = d.property("value");
    });
  }

  dispatch = d3.dispatch("config", "config_id", "range", "rig");

  // main module definition
  return function () {
    // initialise widgets
    var widgets = {
      caps: caps(),
      rig: rig(),
      stats: stats(),
      sweep: sweep(),
      config: config(),
      error: error(),
      range: range(),
      frequency: freq({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: chartHeight }),
      level: level({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 85, bottom: 40 }, width: 1200, height: chartHeight }),
      waterfall: waterfall({ heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: 1200, height: chartHeight })
    };
    widgets.charts = charts(widgets);

    function update(id, callback, progress) {
      var widget = widgets[id];
      var path = widget.q ? widget.q() : '/' + id;
      var xhr = d3.json(path)
                  .on("load", function (json) {
                    if (progress) {
                      progress();
                    }
                    LOG("UPDATE", id, values, json);
                    setTimeout(function () {
                      widget.update(json);
                      if (callback) {
                        callback(widget);
                      }
                    }, 0);
                  })
                  .on("error", function (error) {
                    LOG(error);
                    alert("Server error while updating " + id);
                  });
      if (progress) {
        xhr.on("progress", function () {
          progress(d3.event.loaded, d3.event.total);
        });
      }
      xhr.get();
    }

    function checkRunning() {
      d3.json('/monitor', function (error, resp) {
        d3.select("#worker_error").text(resp.error != null ? resp.error : '');
        if (resp.error != null) {
          d3.select("#start").property("disabled", true);
          d3.select("#stop").property("disabled", true);
          d3.select("#current").style("visibility", "hidden");
          return;
        }
        if (resp.config_id != null) {
          // monitor running
          values.current_id = resp.config_id;
          d3.select("#start").property("disabled", true);
          d3.select("#stop").property("disabled", false);
          d3.select("#current").style("visibility", "visible");
          update("stats");

          // current number of sweeps
          d3.json('/spectrum/sweep/_search?size=0&q=config_id:' + resp.config_id, function (e, r) {
            if (e == null) {
              d3.select("#current span").text(r.hits.total);
            }
          });
        } else {
          // monitor not running
          values.current_id = null;
          d3.select("#start").property("disabled", false);
          d3.select("#stop").property("disabled", true);
          d3.select("#current").style("visibility", "hidden");
        }
      });
    }

    d3.select("#start").on("click", function () {
      var conf = widgets.config.get();
      LOG("START", conf);
      d3.xhr('/monitor')
        .header("Content-Type", "application/json")
        .send('PUT', JSON.stringify(conf), function (error, xhr) {
          setTimeout(function () {
            update("sweep", function (sweep) {
              sweep.selectLatest('freqs_set');
            });
          }, 500);
        });
      d3.select(this).property("disabled", true);
    });

    d3.select("#stop").on("click", function () {
      d3.select(this).property("disabled", true);
      d3.json('/monitor').send('DELETE');
    });

    d3.select("#lock").on("change", function () {
      if (! d3.select(this).property("checked")) {
        d3.select("#sweep_set select").property("disabled", false);
      }
    });

    d3.select("#delete").on("click", function () {
      d3.select(this).property("disabled", true);
      d3.xhr('/spectrum/_query?refresh=true&q=config_id:' + values.freqs_set.config_id)
        .send('DELETE', function (error, xhr) {
          d3.xhr('/spectrum/config/' + values.freqs_set.config_id + '?refresh=true')
            .send('DELETE', function (error, xhr) {
              dispatch.config_id('freqs_set');
              update("sweep");
              d3.select("#delete").property("disabled", false);
            });
        });
    });

    d3.select("#export").on("click", function () {
      d3.xhr('/export/' + values.data_set.config_id)
        .post(null, function (error, xhr) {
          if (error) {
            alert(error);
            LOG(error);
          } else {
            alert("CSV written to " + xhr.responseText);
          }
        });
    });

    d3.select("#download").on("click", function () {
      window.open('/export/' + values.data_set.config_id, '_blank');
    });

    dispatch.on("config_id", function (select_id, config_id, start) {
      values[select_id].config_id = config_id;
      values[select_id].start = start;
      if (select_id == 'freqs_set') {
        if (config_id) {
          update("config");
          d3.select("#delete").property("disabled", false);
        } else {
          d3.select("#delete").property("disabled", true);
        }
      }
      if (select_id == 'data_set') {
        d3.selectAll("#controls, #error").style("visibility", config_id ? "visible" : "hidden");
        d3.selectAll("#charts, #progress, #count").style("visibility", "hidden");
        if (config_id) {
          d3.json('/spectrum/config/' + values.data_set.config_id + '?fields=json', function (error, resp) {
            if (error) {
              alert(error);
              LOG(error);
            } else {
              values.data_set.config = JSON.parse(resp.fields.json[0]);
            }
          });
          update("range");
          update("error");
        }
      }
    });

    dispatch.on("range", function (range) {
      values.data_set.range = range;
      d3.selectAll("#charts, #progress").style("visibility", "visible");
      d3.select("#go").property("disabled", true);
      update("charts", function () {
        d3.select("#go").property("disabled", false);
      }, function (progress, total) {
        if (progress) {
          d3.selectAll("#progress").style("visibility", "visible");
          d3.select("#n span").text(convertBytes(progress, true));
          d3.select("#total").text(convertBytes(total));
        } else {
          d3.select("#n").style("visibility", "hidden");
        }
      });
    });

    dispatch.on("config", function (config) {
      values.freqs_set.config = config;
    });

    dispatch.on("rig", function (rig) {
      d3.xhr('/rig')
        .header("Content-Type", "application/json")
        .send('PUT', JSON.stringify(rig), function (error, xhr) {
          if (error) {
            alert(error);
            LOG(error);
          }
        });
    });

    d3.select("#update").on("click", function () {
      if (values.data_set.config_id) {
        update("range");
      }
    });

    d3.select("#debug").on("change", function () {
      debug = d3.select(this).property("checked");
    });

    update("caps");
    update("rig");
    update("sweep");
    update("stats");

    // wire up tabs
    var selectTab = function (id) {
      if (id == null) {
        id = d3.select(this).property("id");
      }
      d3.select("#tabs").selectAll("span").classed("selected", function (d, i) {
        return d3.select(this).property("id") == id;
      });
      d3.selectAll("div.content").style("display", function (d, i) {
        return d3.select(this).classed(id) ? "initial" : "none";
      });
    };
    d3.select("#tabs").selectAll("span").on("click", selectTab);
    selectTab("data");

    // wire up options
    d3.select("#N")
      .selectAll("option")
      .data(d3.range(1, maxN + 1))
      .enter().append("option")
      .text(function (d) { return d });
    d3.selectAll("#N, #top").on("change", function () {
      setTimeout(widgets.charts.updateLevel, 1);
    });
    d3.select("#sweep").on("change", function () {
      setTimeout(widgets.charts.updateFreq, 1);
    });

    setInterval(checkRunning, 1000);

    d3.selectAll("#charts, #progress, #count, #controls").style("visibility", "hidden");
    d3.select("body").style("display", "block");
  };
});
