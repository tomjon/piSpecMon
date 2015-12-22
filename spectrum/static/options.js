define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return function (parent, dispatch) {
      d3.select("#N")
        .selectAll("option")
        .data([1, 2, 3, 4, 5])
        .enter().append("option")
        .text(function (d) { return d });

      var inputs = d3.selectAll(".option");

      function change() {
        var opts = {};
        inputs.each(function () {
          var d = d3.select(this);
          opts[d.attr("id")] = d.property("value");
        });
        dispatch.options(opts);
      }

      inputs.on("change",  change);
      change();

      return {
      };
    };
  };
});
