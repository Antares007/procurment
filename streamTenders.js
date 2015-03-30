var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;

module.exports = function(session) {
  var get = require('./denodeify.js')(session.get);
  
  var searchForm = {
    action:'search_app', search:'', app_reg_id:'', app_shems_id:'0', org_a:'',
    app_monac_id:'0', org_b:'', app_status:'0', app_agr_status:'0', app_type:'0',
    app_t:'0', app_basecode:'0', app_codes:'',
    app_date_type:'1',
    app_date_from: argv.from,
    app_date_tlll: argv.to,
    app_amount_from:'', app_amount_to:'', app_pricelist:'0', app_manufacturer_id:'0',
    app_manufacturer:'', app_model_id:'0', app_model:'', app_currency:'2'
  };
  session.postForm('https://tenders.procurement.gov.ge/engine/controller.php', searchForm, function(err) {
    if(err) {
      throw err;
    }
    session.stream(
      'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=1',
      function(prevUrl, body) {
        return 'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=next';
      },
      function(body) {
        var list = require('./parseTenderListPage.js')(body);
        return list.length > 0 ? list : null;
      }
    ).pipe(
      asyncTransform(async function(tenderIds){
        var mainPages = tenderIds.map(async function(tenderId) {
          var rez = await get('https://tenders.procurement.gov.ge/engine/controller.php?action=app_main&app_id=' + tenderId)
          console.log('parseMainPage' + tenderId);
          return require('./parseTenderMainPage.js')(rez);
        });

        var bidsPages = tenderIds.map(async function(tenderId) {
          var rez = await get('https://tenders.procurement.gov.ge/engine/controller.php?action=app_bids&app_id=' + tenderId)
          console.log('parseBidsPage' + tenderId);
          return require('./parseTenderBidsPage.js')(rez);
        });

        var agencyDocsPages = tenderIds.map(async function(tenderId) {
          var rez = await get('https://tenders.procurement.gov.ge/engine/controller.php?action=agency_docs&app_id=' + tenderId)
          console.log('parseAgencyDocsPages' + tenderId);
          return require('./parseTenderAgencyDocsPage.js')(rez);
        });

        var tenders = await Promise.all(mainPages);
        var bids = await Promise.all(bidsPages);
        var docs = await Promise.all(agencyDocsPages);

        return tenderIds.reduce(
          (s, id, i) => (
            s.push(Object.assign({ id: id }, tenders[i], { 'შეთავაზებები': bids[i], 'მიმწოდებელი': docs[i] })), 
            s
          ), []);
      })
    ).pipe(
      transform(function(tenders, next){
        var ds = this;
        tenders.forEach(function(t){
          ds.push(JSON.stringify(t) + '\n\n');
        });
        next();
      })
    ).pipe(
      process.stdout
    );
  });
};

function transform(fn){
  return new require('stream').Transform({
    objectMode: true,
    transform: function(chunk, _, next){
      fn.call(this, chunk, next);
    }
  })
}

function asyncTransform(fn){
  return new require('stream').Transform({
    objectMode: true,
    transform: function(chunk, _, next){
      var ds = this; 
      fn(chunk).then(function(rez){ 
        ds.push(rez);
        next(); 
      }).catch(function(err){
        process.nextTick(function(){
          ds.emit('error', err);
        })
      });
    }
  })
}
