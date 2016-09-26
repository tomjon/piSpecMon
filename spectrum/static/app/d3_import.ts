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

export var timeTicks = function (axis, domain, ticks) {
  let extent = domain[1] - domain[0];
  if (extent > 1468800000) {
    let step = Math.ceil(extent / (604800000 * ticks));
    axis.ticks(d3.time.mondays, step);
  } else if (extent > 172800000) {
    let step = Math.ceil(extent / (86400000 * ticks));
    axis.ticks(d3.time.days, step);
  } else if (extent > 3600000) {
    let step = Math.ceil(extent / (3600000 * ticks));
    axis.ticks(d3.time.hours, step);
  } else {
    let step = Math.ceil(extent / (60000 * ticks));
    axis.ticks(d3.time.minutes, step);
  }
  axis.tickFormat(dt_format);
}
