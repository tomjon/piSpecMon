// globals
var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
var format = "%d/%m/%Y %X";
var debug = false;
var insertLineBreaks;

define(['lib/d3/d3.v3', 'util', 'stats', 'level', 'freq', 'waterfall', 'process', 'options', 'config', 'sweep', 'rig'],
       function (d3, util, stats, level, freq, waterfall, process, options, config, sweep, rig) {
  "use strict";

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

  function LOG() {
    if (debug) {
      console.log.apply(console, arguments);
    }
  }

  var dispatch = d3.dispatch("options", "config", "config_id", "running");

  return function () {
    var widgets = {
      "#rig": rig(),
      "#process": process(),
      "#stats": stats(),
      "#sweep_set": sweep(),
      "#config": config(),
      "#charts": options(),
      "#frequency-chart": freq({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 }),
      "#level-chart": level({ y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 }),
      "#waterfall-chart": waterfall({ heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: 1200, height: 400 })
    };

    //FIXME is the config panel 'locked' when the sweeper thread is running? - and you send the config set in the REST API /start call

    function _handle(opts, conf, error, resp) {
      if (error) {
        if (this.error) {
          this.error(error);
        } else {
          //FIXME: put this somewhere on the page
          LOG(error);
        }
      } else {
        LOG("RENDER", this.selector, this.query, resp);
        if (this.clear) {
          this.clear();
        }
        d3.select(this.selector).style("display", "initial");
        this.render(resp, opts, conf);
      }
    }

    var conf_id = null;
    var opts = null;
    var conf = null;

    function update(selector) {
      LOG("UPDATE", selector, opts, conf);
      var widget = widgets[selector];
      var q = widget.q;
      if (! q) {
        LOG("HIDE", selector);
        d3.select(selector).style("display", "none");
        return;
      }
      if (typeof q == 'function') {
        // if the widget returned a function, evaluate it to get the query
        q = q(conf_id, opts, conf);
      }
      if (! q) {
        LOG("HIDE", selector);
        d3.select(selector).style("display", "none");
        return;
      }
      widget.query = q;
      var handler = _handle.bind(widget, opts, conf);
      if (typeof q == 'object') {
        // widget returned a JSON query body - POST it to Elasticsearch
        var type = widget.type || 'signal';
        var xhr = d3.json('/spectrum/' + type + '/_search?size=0');
        xhr.header("Content-Type", "application/json");
        xhr.post(JSON.stringify(q), handler);
      } else if (typeof q == 'string') {
        // widget returned a URL path - use it to query the server
        d3.json('/' + q, handler);
      } else {
        //FIXME: put this somewhere on the page
        LOG("ERROR: bad q value from widget", q, widget);
      }
    };

    var timer;

    d3.select("#start").on("click", function () {
      var conf = widgets["#config"].get();
      LOG("START", conf);
      var xhr = d3.json('/monitor');
      xhr.header("Content-Type", "application/json")
      xhr.send('PUT', JSON.stringify(conf), function (xhr) {
        if (xhr.response) {
          LOG(xhr.response);
        }
        update("#sweep_set");
        update("#process");
      });
      d3.select(this).property("disabled", true);
    });

    d3.select("#stop").on("click", function () {
      d3.select(this).property("disabled", true);
      var xhr = d3.json('/monitor');
      xhr.send('DELETE');
    });

    dispatch.on("options", function (_opts) {
      opts = _opts;
      update("#frequency-chart");
      update("#level-chart");
      update("#waterfall-chart");
    });

    dispatch.on("config_id", function (_config_id) {
      conf_id = _config_id;
      update("#config");
    });

    dispatch.on("config", function (_conf) {
      conf = _conf;
      update("#frequency-chart");
      update("#level-chart");
      update("#waterfall-chart");
    });

    dispatch.on("running", function (running) {
      if (running && timer == null) {
        d3.select("#stop").property("disabled", false);
        timer = setInterval(function () {
          update("#process");
          update("#stats");
          update("#frequency-chart");
          update("#level-chart");
          update("#waterfall-chart");
        }, 940);
      } else if (! running && timer != null) {
        d3.select("#start").property("disabled", false);
        clearInterval(timer);
        timer = null;
      }
    });

    d3.select("#debug").on("change", function () {
      debug = d3.select(this).property("checked");
    });

    for (var selector in widgets) {
      widgets[selector] = widgets[selector](d3.select(selector), dispatch);
      widgets[selector].selector = selector;
    }

    update("#rig");
    update("#sweep_set");
    update("#stats");
    update("#process");

    d3.select("#stop").property("disabled", true);
    setTimeout(function () { d3.select("body").style("display", "block") }, 100);
  };
});
