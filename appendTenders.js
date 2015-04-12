var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;

var transform = require('./transform.js');
var asyncTransform = require('./asyncTransform.js');
var denodeify = require('./denodeify.js');


var main = async function(){
  var pages = ['app_main', 'app_docs', 'app_bids', 'app_result', 'agency_docs'];
  var openSession = denodeify(require('./procurmentSession.js'));
  var sessions = await Promise.all(
    require('./users.json')
      .map(async function(x){
        return denodeify(await openSession(x));
      })
  );

  var appendOnlyStream = await denodeify(require('./appendOnlyStream.js'))('/data/streams/tenderSnapshots');
  var defer = Promise.defer();

  var ids = {};
  var read = appendOnlyStream.createReadStream(0);
  var cheerio = require('cheerio');
  read.pipe(
    transform(function(kv, next){
      var tenderId = kv.value.tenderId;
      var key = kv.key;
      var tables = cheerio.load(kv.value.pages[0])('#app_main #print_area table tr');

      if([17, 19].indexOf(tables.length) === -1){
        console.log(tenderId, tables.length);
      }
      if(key % 1000 === 0){
        console.log(key, tenderId);
      }
      if(!ids[tenderId]){
        ids[tenderId] = 1;
      } else{
        ids[tenderId]++;
      }
      next();
    })
  )
  .on('error', defer.reject.bind(defer))
  .on('finish', defer.resolve.bind(defer))
  .pipe(process.stdout);

  await defer.promise;
  var rezs = Object.keys(ids).map(x => parseInt(x, 10)).sort((a,b) => a-b);
  console.log()
  console.log(rezs.length, rezs[rezs.length-1] - rezs[0] + 1);
  rezs.slice(1).reduce(function(a,b){
    if(a+1 !== b){
      console.log('hole:', a, b);
    }
    return b;
  }, rezs[0]);
  return;

  streamRange(
    parseInt(argv.from), parseInt(argv.to)
  )
  .on('error', defer.reject.bind(defer))
  .pipe(
    asyncTransform(async function(id){
      var requests = pages.map(async function(page, i){
        var getter = sessions.sort(function() { return .5 - Math.random(); })[i];
        var body = await getter('https://tenders.procurement.gov.ge/engine/controller.php?action=' + page + '&app_id=' + id);

        if(body.indexOf(`<div id="${page}">`) < 0) {
          throw new Error('invalid page content');
        }

        return body;
      });
      var contents = await Promise.all(requests);
      return { tenderId: id, pages: contents, date: new Date() };
    })
  )
  .on('error', defer.reject.bind(defer))
  .pipe(
    logProgress((data, i) => i + '\t' + data.tenderId + '\t' + data.pages.join('').length)
  )
  .on('error', defer.reject.bind(defer))
  .pipe(
    appendOnlyStream.createWriteStream()
  )
  .on('error', defer.reject.bind(defer))
  .on('finish', defer.resolve.bind(defer));

  await defer.promise;
};

main().then(function(){
  console.log('done!');
}).catch(function(err){
  console.error('error', err.stack);
});

function streamRange(from, to){
  return new require('stream').Readable({
    objectMode: true,
    read: function(){
      this.push(from);
      from = from + 1;
      if(from >= to) {
        this.push(null);
      }
    }
  });
}

function logProgress(fn){
  var i = 1;
  var debug = require('debug')('progress');
  return transform(function(x, next){
    debug(fn(x, i++));
    this.push(x);
    next();
  });
}
