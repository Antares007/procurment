var transform = require('./transform.js');
var level = require('level');
var db = level('/data/tapes');
var tapedb = require('./tapedb.js')(db);

var parsers = require('./parser');

var ids = {};
tapedb.getTape('procPages')
  .createReadStream({from:0})
  .pipe(require('./logprogress.js')(1000, (d,i) => `${i} ${d.key} ${d.value.tenderId}`))
  .pipe(
    transform(function(kv, next){
      var tenderId = kv.value.tenderId;
      if(!ids[tenderId]){
        ids[tenderId] = 1;
      } else{
        ids[tenderId]++;
      }
      next();
    })
  )
  .on('finish', function(){

    var rezs = Object.keys(ids).map(x => parseInt(x, 10)).sort((a,b) => a-b);
    var totalRecs = Object.keys(ids).reduce(function(a,x){
      return a + ids[x];
    }, 0);
    console.log();
    console.log(totalRecs);
    console.log(rezs.length, rezs[rezs.length-1] - rezs[0] + 1);
    rezs.slice(1).reduce(function(a,b){
      if(a+1 !== b){
        console.log('hole:', a, b);
      }
      return b;
    }, rezs[0]);
  })
  .pipe(process.stdout);
return;

var tenders = tapedb.getTape('procPages')
  .createReadStream({from:0})
  .pipe(logProgress(1000))
  .pipe(transform(function(kv, next){
    try {
      var tender = {
        id: kv.value.tenderId,
        date: kv.value.date,
        app_main: parsers.app_main(kv.value.pages[0]),
        app_docs: parsers.app_docs(kv.value.pages[1]),
        app_bids: parsers.app_bids(kv.value.pages[2]),
        app_result: parsers.app_result(kv.value.pages[3]),
        agency_docs: parsers.agency_docs(kv.value.pages[4])
      };
      this.push(tender);
    } catch(e) {
      this.push(new Error(`cat parse tender: ${kv.value.tenderId}`));
    }
    next();
  }));

tenders.pipe(
  transform(function(x, next){
    if(!(x instanceof Error)){
      this.push(x);
    }
    next();
  })
).on('data', function(data){
  console.log(data.id);
});

tenders.pipe(
  transform(function(x, next){
    if(x instanceof Error){
      this.push(x);
    }
    next();
  })
).on('data', function(data){
  console.log(data.id);
});
