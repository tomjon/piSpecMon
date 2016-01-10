// globals, available to all modules
var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
var format = "%d/%m/%Y %X";
var debug = false;
var insertLineBreaks;
var getOptions;
var LOG;
var dispatch;
var values = { config_id: null, config: null };

define(['lib/d3/d3.v3', 'util', 'stats', 'level', 'freq', 'waterfall', 'config', 'sweep', 'rig', 'charts'],
       function (d3, util, stats, level, freq, waterfall, config, sweep, rig, charts) {
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

  dispatch = d3.dispatch("config", "config_id", "running");

  // main module definition
  return function () {
    // initialise widgets
    var widgets = {
      rig: rig(),
      stats: stats(),
      sweep: sweep(),
      config: config(),
      frequency: freq({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 }),
      level: level({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 }),
      waterfall: waterfall({ heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: 1200, height: 400 })
    };
    widgets.charts = charts(widgets);

    function update(id) {
      var widget = widgets[id];
      var path = widget.q ? widget.q() : '/' + id;
      d3.json(path, function (error, resp) {
        if (error) {
          LOG(error);
          d3.select("#error").text(error);
        } else {
          LOG("UPDATE", id, values, resp);
          widget.update(resp);
        }
      });
    }

    var timer = null, awaitingStop = false;

    function checkRunning() {
      d3.json('/monitor', function (error, resp) {
        if (error == null) {
          // monitor running
          d3.select("#start").property("disabled", true);
          if (! awaitingStop) {
            d3.select("#stop").property("disabled", false);
          }
          update("stats");
          if (values.config_id) {
            update("charts");
          }
          if (timer == null) {
            timer = setInterval(checkRunning, 1000);
          }
        } else {
          // monitor not running
          awaitingStop = false;
          d3.select("#start").property("disabled", false);
          d3.select("#stop").property("disabled", true);
          if (timer != null) {
            clearInterval(timer);
            timer = null;
          }
        }
      });
    }

    d3.select("#start").on("click", function () {
      var conf = widgets.config.get();
      LOG("START", conf);
      var xhr = d3.json('/monitor');
      xhr.header("Content-Type", "application/json")
      xhr.send('PUT', JSON.stringify(conf), function (xhr) {
        if (xhr.response) {
          LOG(xhr.response);
        }
        update("sweep");
        checkRunning();
      });
      d3.select(this).property("disabled", true);
    });

    d3.select("#stop").on("click", function () {
      d3.select(this).property("disabled", true);
      awaitingStop = true;
      d3.json('/monitor').send('DELETE');
    });

    dispatch.on("config_id", function (config_id) {
      values.config_id = config_id;
      update("config");
    });

    dispatch.on("config", function (config) {
      values.config = config;
      if (values.config_id) {
        update("charts");
      }
    });

    d3.select("#debug").on("change", function () {
      debug = d3.select(this).property("checked");
    });

    update("rig");
    update("sweep");
    update("stats");
    checkRunning();

    // wire up options
    d3.select("#N")
      .selectAll("option")
      .data([1, 2, 3, 4, 5])
      .enter().append("option")
      .text(function (d) { return d });
    d3.selectAll("#N, #top").on("change", function () {
      setTimeout(widgets.charts.updateLevel, 1);
    });
    d3.select("#sweep").on("change", function () {
      setTimeout(widgets.charts.updateFreq, 1);
    });

    d3.select("body").style("display", "block");
  };
});
