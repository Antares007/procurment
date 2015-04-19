var stream = require('stream');
var assert = require('assert');

module.exports = function(recordsDb){

  return {
    getTape: function(tapeName){
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
        var writable = new stream.Writable({
          objectMode: true,
          write: function(chunk, encoding, next) {
            if(typeof lastRecNo === 'undefined'){
              getLastRecordId(function(err, recNo){
                assert(typeof lastRecNo === 'undefined');
                lastRecNo = recNo;
                writeRecord(chunk, next);
              });
            } else {
              writeRecord(chunk, next);
            }
          }
        });
        return writable;
      }
      function getLastRecordId(cb){
        var lastKey;
        var readable = recordsDb.createKeyStream({
          gte: opts.keyEncoding.encode(0),
          lte: opts.keyEncoding.encode(99999999999),
          limit: 1,
          reverse: true,
          keyEncoding: opts.keyEncoding
        }).on('data', function(value){
          lastKey = value;
        }).on('end', function(){
          cb(null, typeof lastKey === 'undefined' ? -1 : lastKey);
        }).on('error', cb);
      }
      function writeRecord(data, cb){
        recordsDb.put(++lastRecNo, data, opts, cb);
      }

      function createReadStream(opt){
        var readable = recordsDb.createReadStream({
          gte: opts.keyEncoding.encode(opt.from || 0),
          lte: opts.keyEncoding.encode(99999999999),
          limit: opt.limit,
          keyEncoding: opts.keyEncoding,
          valueEncoding: opts.valueEncoding
        });
        return readable;
      }
    }
  };
};
