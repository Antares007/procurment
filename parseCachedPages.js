var level = require('level');
var transform = require('./transform.js');
var parsers = {
  app_main: require('./parseTenderMainPage.js'),
  app_bids: require('./parseTenderBidsPage.js'),
  agency_docs: require('./parseTenderAgencyDocsPage.js'),
  app_docs: function(str){ return str },
  app_result: function(str){ return str },
};

level('/data/cache').createReadStream({
  gt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=!',
  lt: 'https://tenders.procurement.gov.ge/engine/controller.php?action=~',
  // limit: 10000
}).pipe(
  (function(){
    var querystring = require('querystring');
    return transform(function(kv, next){
      var params = querystring.parse(kv.key.split('?')[1]);
      if(kv.value.indexOf(`<div id="${params.action}">`) < 0){
        ds.emit('error', new Error('invalid page body'));
      } else {
        this.push({
          app_id: parseInt(params.app_id, 10),
          action: params.action,
          body: kv.value
        })
      }
      next();
    })
  })()
).pipe(
  transform(function(page, next){
    if(parsers[page.action]){
      try{
        page.value = parsers[page.action](page.body);
        this.push(page);
      } catch(err) {
        page.value = err;
        this.push(page);
      }
    } else {
      this.emit('error', new Error('cant find parser for ' + JSON.stringify(page)));
    }
    next();
  })
).pipe(
  (function(){
    var counters = Object.keys(parsers).reduce(function(s,k){
      s[k] = 0;
      s[k+'_error'] = 0;
      return s;
    }, {});
    var i = 0;
    return transform(function(page, next){
      counters[page.action + (page.value instanceof Error ? '_error' : '')]++;
      if(++i % 1000 === 0){ console.log(JSON.stringify(counters)); }
      this.push(page);
      next();
    }, function(done){
      console.log(JSON.stringify(counters));
      done();
    })
  })()
).pipe(
  transform(function(page, next){
    if(page.value) {
      var key = ['tender', page.app_id, page.action];
      if(page.value instanceof Error){
        this.push({ key: key, value: { err: page.value.message } });
      } else {
        this.push({ key: key, value: page.value });
      }
    }
    next();
  })
).pipe(
  (function(){
    var db = level('./parsedDb', { keyEncoding: require('bytewise'), valueEncoding: 'json' });
    return transform(function(kv, next){
      db.put(kv.key, kv.value, next);
    });
  })()
).pipe(
  process.stdout
);
