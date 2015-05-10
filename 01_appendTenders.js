var argv = require('yargs')
  .usage('Module usage: -from [fromDate] -to [toDate]')
  .demand(['from','to'])
  .argv;

var transform = require('./transform.js');
var asyncTransform = require('./asyncTransform.js');
var denodeify = require('./denodeify.js');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


var main = async function(){
  var pages = ['app_main', 'app_docs', 'app_bids', 'app_result', 'agency_docs'];
  var openSession = denodeify(require('./procurmentSession.js'));
  var sessions = await Promise.all(
    require('./users.json')
      .map(async function(x){
        return denodeify(await openSession(x));
      })
  );

  var defer = Promise.defer();

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
    require('./logprogress.js')(1, (d, i) => i + '\t' + d.tenderId + '\t' + d.pages.join('').length)
  )
  .on('error', defer.reject.bind(defer))
  .pipe(transform(function(x, next){
    var tender = {
      id: x.tenderId,
      pages: x.pages
    };
    var baseDir = '/data/procurment-data2/tenders';
    var strId = ('000000' + tender.id).slice(-6);
    var dir = path.join(baseDir, strId.slice(0, 3));
    var filePath = path.join(dir, strId.slice(3, 6) + '.zsv');

    mkdirp(dir, function(err){
      if(err) throw err;
      fs.writeFile(filePath, tender.pages.join(String.fromCharCode(0)), function(err){
        if(err) throw err;
        next();
      });
    });
  }))
  .on('error', defer.reject.bind(defer))
  .on('finish', defer.resolve.bind(defer))
  .resume();

  console.log('awaiting');
  await defer.promise;
  console.log('awaited');
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
