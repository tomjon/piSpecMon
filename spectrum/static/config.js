define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  function checked() {
    return d3.select(this).property("checked");
  }

  function freqInput(x) {
    var input = d3.select(x).select("input");
    if (input.size() == 0) {
      return null;
    }
    var f = input.node()["value"];
    var select = d3.select(x).select("select");
    if (select.size() == 0) {
      return f;
    }
    return { exp: select.node()["value"], f: f };
  }

  function freqOutput(freq, x) {
    x.select("input").property("value", freq.f || freq);
    if (freq.exp) {
      x.select("select").property("value", freq.exp);
    }
  }

  function addHz(selection) {
    selection.selectAll("option")
             .data(['Hz', 'kHz', 'MHz', 'GHz']).enter().append('option')
             .text(function (d) { return d })
             .property("value", function (d, i) { return i * 3 });
  }

  function addRow() {
    var table = d3.select("#discreteSet table");
    var tr = table.append("tr");
    tr.append("td").text("Frequency");
    tr.append("td").append("input");
    addHz(tr.append("td").append("select").attr("class", "hz"));
    tr.append("td").append("button").text("Remove").on("click", removeRow.bind(tr));
    return tr;
  }

  function removeRow() {
    this.remove();
  }

  return function () {
    // wire up range/discrete radio buttons and divs
    d3.select("#range").on("change", function () {
      d3.select("#rangeSet").style("display", "initial");
      d3.select("#discreteSet").style("display", "none");
    });
    d3.select("#discrete").on("change", function () {
      d3.select("#rangeSet").style("display", "none");
      d3.select("#discreteSet").style("display", "initial");
    });
    d3.select("#rangeSet").style("display", "none");

    // fill kHz/MHz/GHz selects
    addHz(d3.selectAll("select.hz"));

    // wire up 'Add' button for discrete freqs
    // <tr><td>Frequency</td><td><input /></td><td><select class="hz" /></td></tr>
    addRow();
    d3.select("#add").on("click", addRow);

    return {
      /* read config out of the UI */
      get: function () {
        var conf = { monitor: {}, scan: {} };
        readUI("monitor", conf.monitor);
        readUI("scan", conf.scan);

        var type = d3.selectAll("input[name=type]").filter(checked).attr("id");
        if (type == "range") {
          var exp = d3.select("#rangeSet select").property("value");
          conf.freqs = { exp: exp, range: [ freqInput("#f0"), freqInput("#f1"), freqInput("#df") ] };
        } else if (type == "discrete") {
          conf.freqs = { freqs: [] };
          d3.selectAll("#discreteSet tr").each(function () {
            var f = freqInput(this);
            if (! f) {
              d3.select(this).remove();
            } else {
              conf.freqs.freqs.push(f);
            }
          });
        }

        return conf;
      },

      q: function () { return '/spectrum/config/' + values.freqs_set.config_id + '?fields=json' },

      update: function (resp) {
        var conf = JSON.parse(resp.fields.json[0]);

        /* render config in the UI */
        updateUI(conf.monitor);
        updateUI(conf.scan);

        if (conf.freqs) {
          if (conf.freqs.range) {
            d3.select("#rangeSet").style("display", "initial");
            d3.select("#discreteSet").style("display", "none");
            d3.select("#range").property("checked", true);
            freqOutput(conf.freqs.range[0], d3.select("#f0"));
            freqOutput(conf.freqs.range[1], d3.select("#f1"));
            freqOutput(conf.freqs.range[2], d3.select("#df"));
            d3.select("#rangeSet select").property("value", conf.freqs.exp);
          } else if (conf.freqs.freqs) {
            d3.select("#rangeSet").style("display", "none");
            d3.select("#discreteSet").style("display", "initial");
            d3.select("#discrete").property("checked", true);
            d3.selectAll("#discreteSet tr").remove();
            for (var idx in conf.freqs.freqs) {
              freqOutput(conf.freqs.freqs[idx], addRow());
            }
          }
        }

        d3.select("#" + conf.mode).property("checked", true);

        dispatch.config(conf);
      }
    };
  };
});
