var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;
var transform = require('./transform.js');
var asyncTransform = require('./asyncTransform.js');

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
          var pageNames = ['app_main', 'app_docs', 'app_bids', 'app_result', 'agency_docs'];
          var promisedPages = pageNames.map(async function(page) {
            var url = makePageUrl(page);
            var str = await get(url);
            if(str.indexOf(`<div id="${page}">`) < 0) {
              throw new Error('invalid page content');
            }
            return { url, body: str };
          });

          var pages = await Promise.all(promisedPages);

          var mainJson = require('./parseTenderMainPage.js')(pages[0].body);

          await dbBatch(
            pages
              .map(p => ({ type: 'put', key: p.url, value: p.body }))
              .concat({ type: 'put', key: 'tender!' + tenderId, value: 'n/a' })
          );

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
