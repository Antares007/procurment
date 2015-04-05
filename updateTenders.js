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
  var request = require('request');
  request.get({
    url: 'http://localhost:9200/procurment/tender/_search',
    json: true,
    body: {
      "sort": [ { "id": { "order": "desc" } } ],
      "fields": [ "id" ],
      "from": 0,
      "size": 10240,
      "query": {
        "filtered": {
          "filter": {
            "terms": {
              "app_main.ტენდერის სტატუსი": [
                "მიმდინარეობს ხელშეკრულების მომზადება",
                "ტენდერი გამოცხადებულია",
                "სატენდერო განცხადების პროექტი", //???
                "წინადადებების მიღება დაწყებულია",
                "შერჩევა/შეფასება",
                "წინადადებების მიღება დასრულებულია"
              ]
            }
          }
        }
      }
    }
  }).pipe(
    (function(){
      var body = '';
      return transform(function(chunk, next){
        body += chunk
        next();
      }, function(done){
        var ds = this;
        JSON.parse(body).hits.hits.forEach(function(x){
          ds.push(x._id);
        })
        done();
      })
    })()
  ).pipe(
    asyncTransform(async function(tenderId){

      var tenderKey = 'tender!' + tenderId;
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
