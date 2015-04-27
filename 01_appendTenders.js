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

  var level = require('level');
  var db = level('/data/tapes');
  var tapedb = require('./tapedb.js')(db);
  var tape = tapedb.getTape('procPages');

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
  .pipe(
    tape.createAppendStream()
  )
  .on('error', defer.reject.bind(defer))
  .on('finish', defer.resolve.bind(defer));

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
