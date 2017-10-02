declare var d3: any;

export var _d3: any = d3;

export var dt_format = d3.time.format("%d/%m/%Y %X");

export var insertLineBreaks = function (d) {
  var el = d3.select(this);
  var x = el.attr('x') || 0;
  var words = dt_format(d).split(' ');
  el.text('');

  for (let i = 0; i < words.length; i++) {
    var tspan = el.append('tspan').text(words[i]);
    if (i > 0) {
      tspan.attr('x', x).attr('dy', '15');
    }
  }
};

/* period * step * ticks = extent */
/* step = extent / (period * ticks) */
export var timeTicks = function (axis, domain, ticks) {
  let extent = domain[1] - domain[0]; // milliseconds
  let period, type;
  if (extent > 5 * 7 * 24 * 60 * 60 * 1000) {
    period = 7 * 24 * 60 * 60 * 1000;
    type = d3.time.mondays;
  } else if (extent > 5 * 24 * 60 * 60 * 1000) {
    period = 24 * 60 * 60 * 1000;
    type = d3.time.days;
  } else if (extent > 5 * 60 * 60 * 1000) {
    period = 60 * 60 * 1000;
    type = d3.time.hours;
  } else {
    period = 60 * 1000;
    type = d3.time.minutes;
  }
  axis.ticks(type, Math.ceil(extent / (period * ticks)));
  axis.tickFormat(dt_format);


}
