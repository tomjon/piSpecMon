define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return function (parent, dispatch) {
      return {
        q: 'monitor',

        render: function (data) {
          dispatch.running(true);
        },

        error: function (error) {
          dispatch.running(false);
        }
      };
    }
  };
});
