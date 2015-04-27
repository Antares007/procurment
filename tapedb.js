var stream = require('stream');
var assert = require('assert');

module.exports = function(db){
  var tapes = {};
  return {
    getTape: function(name){
      if(tapes[name]){
        return tapes[name];
      } else {
        return tapes[name] = makeTape(db, name);
      }
    }
  };
};

function makeTape(recordsDb, tapeName){
  var lastRecNo;
  var keyEncoding = {
    encode : function (val) { return new Buffer('tape!' + tapeName + '!' + ('00000000000' + val).slice(-11), 'utf8'); },
    decode : function (val) { return Number(val.toString('utf8').slice(-11)); },
    buffer : true,
    type   : 'tape'
  };
  var opts = {
    keyEncoding: keyEncoding,
    valueEncoding: 'json'
  };

  return { createReadStream: createReadStream, createAppendStream: createAppendStream };

  function createAppendStream(){
    return new stream.Writable({
      objectMode: true,
      write: function(chunk, encoding, next) {
        if(typeof lastRecNo === 'undefined'){
          getLastRecordId(function(err, recNo){
            if(err) return next(err);
            if(typeof lastRecNo === 'undefined'){
              lastRecNo = recNo;
            }
            writeRecord(chunk, next);
          });
        } else {
          writeRecord(chunk, next);
        }
      }
    });
  }
  function getLastRecordId(cb){
    var lastKey = -1;
    createReadStream({ limit: 1, reverse: true })
      .on('data', function(data){ lastKey = data.key; })
      .on('end', function(){ cb(null, lastKey); })
      .on('error', cb);
  }
  function writeRecord(data, cb){
    recordsDb.put(++lastRecNo, data, opts, cb);
  }

  function createReadStream(opt){
    opt = opt || {};
    return recordsDb.createReadStream({
      gte: opts.keyEncoding.encode(opt.from || 0),
      lte: opts.keyEncoding.encode(99999999999),
      limit: opt.limit,
      reverse: opt.reverse,
      keyEncoding: opts.keyEncoding,
      valueEncoding: opts.valueEncoding
    });
  }
}
