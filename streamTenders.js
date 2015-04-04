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

  var get = require('./denodeify.js')(session.get);
  var dbGet = require('./denodeify.js')(db.get.bind(db));
  var dbPut = require('./denodeify.js')(db.put.bind(db));
  var dbBatch = require('./denodeify.js')(db.batch.bind(db));


  var k = 0;
  var from = parseInt(argv.from);
  var to = parseInt(argv.to);

  new require('stream').Readable({
    objectMode: true,
    read: function(){
      this.push(from);
      from = from + 1;
      if(from >= to) {
        this.push(null);
      }
    }
  }).pipe(
    asyncTransform(async function(tenderId){

      var tenderKey = 'tender!' + tenderId;
      try{
        await dbGet(tenderKey);
        return tenderKey + ' ok';
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

          await dbBatch(
            pages
              .map(p => ({ type: 'put', key: p.url, value: p.body }))
              .concat({ type: 'put', key: 'tender!' + tenderId, value: 'n/a' })
          );

          return tenderKey;
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
