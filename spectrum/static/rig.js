define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return function (parent) {
      function setSelect(id, data, text, value) {
        var options = d3.select('#' + id)
                        .selectAll('option')
                        .data(data);
        options.enter().append('option')
               .text(text)
               .attr('value', value);
        options.exit().remove();
      }

      return {
        q: "rig",

        render: function (data) {
          data.models.sort(function (a, b) {
            if (a.manufacturer == b.manufacturer) {
              return a.name < b.name ? -1 : 1;
            } else {
              return a.manufacturer < b.manufacturer ? -1 : 1;
            }
          });

          setSelect('model',
                    data.models,
                    function (d) { return d.manufacturer + ' ' + d.name +
                                          ' v' + d.version + ' (' + d.status + ')' },
                    function (d) { return d.model });

          d3.select('#model').property("value", 1);

          setSelect('mode',
                    data.modes,
                    function (d) { return d.name },
                    function (d) { return d.mode });

          //FIXME: ungrey the config panel
        }
      };
    }
  };
});
