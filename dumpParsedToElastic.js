var level = require('level');
var transform = require('./transform.js');
var request = require('request').defaults({
  json: true
});

level('./parsedDb', {
  keyEncoding: require('bytewise'),
  valueEncoding: 'json'
}).createReadStream({
  // reverse: true,
  gt: ['tender', null],
  lt: ['tender', undefined],
  // limit: 20,
}).pipe(
  (function(){
    var lastId;
    var collected = {};
    return transform(function(kv, next){
      var parts = kv.key;
      var id = parts[1];
      var page = parts[2];

      if(lastId !== id){
        this.push(collected);
        collected = { id: id };
      }

      collected[page] = kv.value;
      lastId = id;
      next();
    }, function(done){
      this.push(collected);
      done();
    });

  })()
).pipe(
  transform(function(obj, next){
    if(Object.keys(obj).length > 0){
      this.push(obj);
    }
    next();
  })
).pipe(
  transform(function(obj, next){
    request.put({
      url: 'http://localhost:9200/procurment/tender/' + obj.id,
      body: obj
    },
    function(err, res, body){
      if(err){
        this.emit('error', err);
      }
      console.log(res.statusCode, body);
      next();
    });
  })
).pipe(
  process.stdout
);
