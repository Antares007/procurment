var transform = require('./transform.js');

module.exports = function(session) {
  session.stream(
    'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=1',
    function(prevUrl, $) {
      return 'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=next';
    },
    function($) {
      var list = $('tbody tr').map(function(i, e) {
        var id = $(this).attr('id').slice(1);
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
      var cbcount = chunk.length;
      var ds = this;
      chunk.forEach(function(x) {
        shetavazebebi(x.id, function(err, shetavazebebi) {
          x.shetavazebebi = shetavazebebi;
          ds.push(JSON.stringify(x) + '\n');
          if(--cbcount === 0) next();
        });
      });
    })
  ).pipe(
    process.stdout
  );

  function shetavazebebi(tenderId, cb) {
    session.get('https://tenders.procurement.gov.ge/engine/controller.php?action=app_bids&app_id=' + tenderId, function(err, $, body) {
      if(err) {
        return cb(err);
      }
      var shetavazebebi = $('tbody tr', $('table').first()).map(function(){
        var td = $(this).children('td').first();
        return {
          orgId: td.children('a').first().attr('onclick').trim().slice('ShowProfile('.length, -1),
          orgName: td.find('span').text().trim(),
          boloShetavazeba: (td = td.next(), td.find('strong').text()),
          pirveliShetavazeba: (td = td.next(), td.text().split(String.fromCharCode(160))[0].trim()),
        };
      }).get();
      cb(null, shetavazebebi);
    });
  }
};
