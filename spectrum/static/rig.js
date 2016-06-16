define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    d3.select("#rig").selectAll("input, select").on("change", function() {
      /* read rig config out of the UI */
      var rig = { };
      readUI("rig", rig);
      dispatch.rig(rig);
    });

    return {
      update: function (rig) {
        /* render rig config in the UI */
        updateUI(rig);
      }
    };
  };
});
