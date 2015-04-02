var level = require('level');
var transform = require('./transform.js');
var querystring = require('querystring');

var parsers = {
  app_main: require('./parseTenderMainPage.js'),
  app_bids: require('./parseTenderBidsPage.js'),
  agency_docs: require('./parseTenderAgencyDocsPage.js')
}
var counters = Object.keys(parsers).reduce(function(s,k){
  s[k] = 0;
  return s;
}, {});

var parsedDb = level('./parsedDb', {
  keyEncoding: require('bytewise'),
  valueEncoding: 'json'
});

var i = 0;
level('/data/cache').createReadStream({
  gt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=!',
  lt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=~',
  // limit: 10000
}).pipe(
  transform(function(kv, next){
    var ds = this;
    var params = querystring.parse(kv.key.split('?')[1]);
    if(kv.value.indexOf(`<div id="${params.action}">`) < 0){
      ds.emit('error', new Error('invalid value'));
    }

    if(parsers[params.action]){
      var key = ['tender', parseInt(params.app_id, 10), params.action];
      var json = parsers[params.action](kv.value);
      if(json){
        parsedDb.put(key, json);
        counters[params.action]++;
        // ds.push(key + '\n');
      }
    }
    if(++i % 1000 === 0){
      this.push(JSON.stringify(counters) + '\n');
    }
    next();
  })
).on('finish', function(){
  console.log('finish', counters);
}).pipe(
  process.stdout
);
