var transform = require('./transform.js');
var level = require('level');
var db = level('/data/tapes');
var tapedb = require('./tapedb.js')(db);
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


tapedb.getTape('procPages')
  .createReadStream({
    // from:0,
    // limit:10
  })
  .pipe(require('./logprogress.js')(1000))
  .pipe(transform(function(x, next){
    var ds = this;
    var tender = {
      id: x.value.tenderId,
      pages: x.value.pages
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
  .resume();
