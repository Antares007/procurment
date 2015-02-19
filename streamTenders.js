var transform = require('./transform.js');

module.exports = function(session) {
  session.get('https://tenders.procurement.gov.ge', function(err) {
    if(err) { 
      throw err;
    }  
    session.stream(
      'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=1',
      function(prevUrl, $) {
        return 'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=next';
      },
      function($) {
        var list = $('tbody tr').map(function(i, e) {
          var id = $(this).attr('id');
          var td = $(this).children('td').last().children('p').map(function(){
            return $(this).text();
          }).get().reduce(function(acc, textLine) {
            var segments = textLine.split(':');
            if(segments.length === 1) {
              acc.states.push(textLine.trim());
            } else {
              acc[segments[0]] = segments.splice(1).join(':').trim();
            }
            return acc;
          }, {id: id, states: []});
          return td;
        }).get();
        return list.length > 0 ? list : null;
      }
    ).pipe(
      transform(function(chunk, next) {
        var ds = this;
        chunk.forEach(function(x) {
          ds.push(x);
        });
        next();
      })
    ).pipe(
      transform(function(chunk, next) { 
        var ds = this;
        ds.push(JSON.stringify(chunk) + '\n');
        next();
      })
    ).pipe(
      process.stdout
    );
  });
};
