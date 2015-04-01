var asyncTransform = require('./asyncTransform.js');
var parseOrganizationsList = require('./parseOrganizationsList');
var cheerio = require('cheerio');

module.exports = function(session) {
  var get = require('./denodeify.js')(session.get);

  session.stream(
    'https://tenders.procurement.gov.ge/engine/controller.php?action=tweets&page=1',
    function(prevUrl, $) {
      return 'https://tenders.procurement.gov.ge/engine/controller.php?action=tweets&page=next';
    },
    function(body) {
      var $ = cheerio.load(body);
      var rez = $('table tbody span').map(function(){
        return $(this).attr('id');
      }).get().filter(function(x){
        return x.indexOf('tb') === 0;
      });
      return rez.length > 0 ? rez : null;
    }
  ).pipe(
    asyncTransform(async function(chunk) {
      var deletes = chunk.map(function(twid){
        twid = twid.slice(2);
        return get('https://tenders.procurement.gov.ge/engine/controller.php?action=delete_tweet&tw_id=' + twid);
      });
      var results = await Promise.all(deletes);
      console.log(results);
      return 'done';
    })
  ).pipe(
    process.stdout
  );
};

