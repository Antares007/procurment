var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;
var debugLevel = require('debug')('level');

module.exports = async function(session) {
  var multilevel = require('multilevel');
  var net = require('net');
  var db = multilevel.client();
  var con = net.connect(3000);
  con.pipe(db.createRpcStream()).pipe(con);

  var postForm = require('./denodeify.js')(session.postForm);
  var get = require('./denodeify.js')(session.get);
  var dbGet = require('./denodeify.js')(db.get.bind(db));
  var dbPut = require('./denodeify.js')(db.put.bind(db));
  var dbBatch = require('./denodeify.js')(db.batch.bind(db));

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
  await postForm('https://tenders.procurement.gov.ge/engine/controller.php', searchForm)

  var i = 1;
  var k = 0;
  session.stream(
    'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=' + i,
    function(prevUrl, body) {
      i++;
      return 'https://tenders.procurement.gov.ge/engine/controller.php?action=search_app&page=' + i;
    },
    function(body) {
      var list = require('./parseTenderListPage.js')(body);
      return list.length > 0 ? list : null;
    }
  ).pipe(
    transform(function(ids, next){
      ids.forEach(id => this.push(id));
      next();
    })
  ).pipe(
    asyncTransform(async function(tenderId){

      var tenderKey = 'tender!' + tenderId;
      try{
        await dbGet(tenderKey);
        return tenderKey;

      } catch(err) {
        if(err.notFound) {
          var makePageUrl = (action) =>
            `https://tenders.procurement.gov.ge/engine/controller.php?action=${action}&app_id=${tenderId}`;
          var pages = ['app_main', 'app_docs', 'app_bids', 'app_result', 'agency_docs'];
          var promisedRequests = pages.map(p => get(makePageUrl(p)));
          var htmlPages = await Promise.all(promisedRequests);
          var validContents = htmlPages.filter((str, i) => str.indexOf(`<div id="${pages[i]}">`) >= 0);
          if(validContents.length !==  pages.length) {
            throw new Error('invalid page content');
          }
          var mainJson = require('./parseTenderMainPage.js')(htmlPages[0]);

          await dbBatch(htmlPages.map((value, i) => ({
            type: 'put',
            key: makePageUrl(pages[i]),
            value: value
          })).concat([{
            type: 'put',
            key: 'tender!' + tenderId,
            value: 'n/a'
          }]));

          return {
            id: tenderId,
            appDate: mainJson['ტენდერის გამოცხადების თარიღი'],
            status: mainJson['ტენდერის სტატუსი'],
          };
        } else {
          throw err;
        }
      }

    })
  ).pipe(
    transform(function(x, next){
      this.push((++k) + ' ' +JSON.stringify(x) + '\n');
      next();
    })
  ).on('finish', function(){
    db.close();
    console.log('finish');
  }).pipe(
    process.stdout
  );
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
