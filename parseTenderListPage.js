module.exports = function($) {
  return $('tbody tr').map(function(i, e) {
    var id = $(this).attr('id');
    if(!id || id[0] !== 'A') {
      return;
    }
    id = id.slice(1);
    var td = $(this).children('td').last().children('p').map(function(){
      return $(this).text().split('\n').map(function(x){return x.trim();});
    }).get().reduce(function(acc, textLine) {
      var segments = textLine.split(':');
      if(segments.length === 1) {
        acc.states.push(textLine.trim());
        acc.states = acc.states.filter(isTruethy);
      } else {
        acc[segments[0]] = segments.splice(1).join(':').trim();
      }
      return acc;
    }, {id: id, states: []});
    return td;
  }).get().filter(isTruethy);
};
function isTruethy(x){return x;}
