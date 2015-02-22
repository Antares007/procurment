var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;
var transform = require('./transform.js');
var parseTender = require('./parseTenderListPage.js');

module.exports = function(session) {
  var searchForm = {
    action:'search_app', search:'', app_reg_id:'', app_shems_id:'0', org_a:'',
    app_monac_id:'0', org_b:'', app_status:'0', app_agr_status:'0', app_type:'0',
    app_t:'0', app_basecode:'0', app_codes:'',
    app_date_type:'1',
    app_date_from:argv.from,
    app_date_tlll:argv.to,
    app_amount_from:'', app_amount_to:'', app_pricelist:'0', app_manufacturer_id:'0',
    app_manufacturer:'', app_model_id:'0', app_model:'', app_currency:'2'
  };
  session.postForm('https://tenders.procurement.gov.ge/engine/controller.php', searchForm, function(err) {
    if(err) {
      throw err;
    }
    session.stream(
      'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=1',
      function(prevUrl, $) {
        return 'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=next';
      },
      function($) {
        var list = parseTender($);
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
  });

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
