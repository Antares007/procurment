var transform = require('./transform.js');
var parseOrganizationsList = require('./parseOrganizationsList');

module.exports = function(session) {
  session.stream(
    'https://tenders.procurement.gov.ge/engine/controller.php?action=org_list&search_org_type=0&page=1',
    function(prevUrl, $) {
      return     'https://tenders.procurement.gov.ge/engine/controller.php?action=org_list&search_org_type=0&page=next';
    },
    function($) {
      var list = parseOrganizationsList($);
      return list.length > 0 ? list : null;
    }
  ).pipe(
    transform(function(chunk, next) {
      var cbcount = chunk.length;
      var ds = this;
      chunk.forEach(function(x) {
        tematika(x.id, function(err, tematika) {
          x.tematika = tematika;
          ds.push(JSON.stringify(x) + '\n');
          if(--cbcount === 0) next();
        });
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

