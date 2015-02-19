var transform = require('./transform.js');

module.exports = function(session) {

  var i = 1;
  var makeUrl = function(n) {
    return 'https://tenders.procurement.gov.ge/engine/controller.php?action=org_list&search_org_type=0&page=' + n;
  };

  session.stream(
    makeUrl(i),
    function(prevUrl, $) {
      return makeUrl(++i);
    },
    function($) {
      var list = $('tbody tr').map(function(i, e){
        var el = $(this);
        var tds = el.children('td');
        var c = tds.first();
        return {
          id: el.attr('onclick').trim().slice('ShowProfile('.length, -1),
          name: c.find('span').text().trim(),
          date: (c = c.next().next(), c.text()).trim(),
            type: (c = c.next(), c.text()).trim()
        };
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
      tematika(chunk.id, function(err, tematika) {
        chunk.tematika = tematika;
        ds.push(JSON.stringify(chunk) + '\n');
        next();
      });
    })
  ).pipe(
    process.stdout
  );

  function tematika(orgId, cb) {
    session.get('https://tenders.procurement.gov.ge/engine/controller_profile.php?org_id=' + orgId + '&tab=subj&_=1424276559284', function(err, $) {
      if(err) {
        return cb(err);
      }
      var list = $('ul li').map(function(i, e) { return $(this).text().trim(); }).get();
      cb(null, list);
    });
  }
};

