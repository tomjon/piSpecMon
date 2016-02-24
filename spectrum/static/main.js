// globals, available to all modules
var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
var format = "%d/%m/%Y %X";
var debug = false;
var insertLineBreaks;
var getOptions;
var LOG;
var dispatch;
var values = { config_id: null, config: null, range: null };
var maxN = 10;

define(['lib/d3/d3.v3', 'util', 'stats', 'level', 'freq', 'waterfall', 'config', 'sweep', 'rig', 'charts', 'error', 'range'],
       function (d3, util, stats, level, freq, waterfall, config, sweep, rig, charts, error, range) {
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

  dispatch = d3.dispatch("config", "config_id", "range");

  // main module definition
  return function () {
    // initialise widgets
    var widgets = {
      rig: rig(),
      stats: stats(),
      sweep: sweep(),
      config: config(),
      error: error(),
      range: range(),
      frequency: freq({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 }),
      level: level({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 85, bottom: 40 }, width: 1200, height: 400 }),
      waterfall: waterfall({ heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: 1200, height: 400 })
    };
    widgets.charts = charts(widgets);

    function update(id, callback) {
      var widget = widgets[id];
      var path = widget.q ? widget.q() : '/' + id;
      d3.json(path, function (error, resp) {
        if (error) {
          LOG(error);
          if (resp && resp.responseText) {
            alert(id + ": " + resp.responseText);
          }
        } else {
          LOG("UPDATE", id, values, resp);
          widget.update(resp);
        }
        if (callback) {
          callback();
        }
      });
    }

    function checkRunning() {
      d3.json('/monitor', function (error, resp) {
        if (resp != null) {
          // monitor running
          if (d3.select("#lock").property("checked") && values.confid_id != resp.config_id) {
            update("sweep", function () {
              d3.select("#sweep_set select").property({ value: resp.config_id, disabled: true });
              dispatch.config_id(resp.config_id);
            });
          }
          update("stats");
          d3.select("#start").property("disabled", true);
          d3.select("#stop").property("disabled", false);
          if (values.config_id == resp.config_id) {
            update("charts");
          }
        } else {
          // monitor not running
          d3.select("#start").property("disabled", false);
          d3.select("#stop").property("disabled", true);
          d3.select("#sweep_set select").property("disabled", false);
          if (values.config_id) {
            update("error");
          }
        }
      });
    }

    d3.select("#start").on("click", function () {
      var conf = widgets.config.get();
      LOG("START", conf);
      d3.xhr('/monitor')
        .header("Content-Type", "application/json")
        .send('PUT', JSON.stringify(conf), function (error, xhr) {
          update("sweep");
          checkRunning();
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
      d3.xhr('/spectrum/_query?refresh=true&q=config_id:' + values.config_id)
        .send('DELETE', function (error, xhr) {
          d3.xhr('/spectrum/config/' + values.config_id + '?refresh=true')
            .send('DELETE', function (error, xhr) {
              dispatch.config_id();
              update("sweep");
              d3.select("#delete").property("disabled", false);
            });
        });
    });

    d3.select("#export").on("click", function () {
      d3.xhr('/export/' + values.config_id)
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
      window.open('/export/' + values.config_id, '_blank');
    });

    dispatch.on("config_id", function (config_id, start) {
      d3.selectAll("#shield, #controls, #error").style("display", config_id ? "initial" : "none");
      d3.selectAll("#charts").style("display", "none");
      values.config_id = config_id;
      values.start = start;
      if (config_id) {
        update("config");
        update("error");
      }
    });

    dispatch.on("range", function (range) {
      values.range = range;
      console.log(values);
      d3.selectAll("#charts").style("display", "initial");
      update("charts");
    });

    dispatch.on("config", function (config) {
      values.config = config;
      if (values.config_id) {
        update("range");
      }
    });

    d3.select("#debug").on("change", function () {
      debug = d3.select(this).property("checked");
    });

    update("rig");
    update("sweep");
    update("stats");

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

    d3.select("body").style("display", "block");
  };
});
