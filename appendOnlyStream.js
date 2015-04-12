var level = require('level');
var bytewise = require('bytewise');
var stream = require('stream');

module.exports = function appendOnlyStream(path, cb) {
  level(path, {
    keyEncoding: bytewise,
    valueEncoding: bytewise
  }, function(err, db){
    if(err){
      return cb(err);
    } 

    db.get(-1, function (err, value) {
      var id;
      if (err) {
        if (err.notFound) {
          id = 0;
        } else {
          return cb(err);
        }
      } else {
        id = value;
      }

      var appendOnly = {
        createWriteStream: function createWriteStream(){
          var writable = new stream.Writable({
            objectMode: true,
            write: function(chunk, encoding, next) {
              db.batch()
              .put(id++, chunk)
              .put(-1, id)
              .write(next);
            }
          });
          return writable;
        },
        createReadStream: function createReadStream(from){
          var readable = db.createReadStream({
            gte: bytewise.encode(from),
            lt: bytewise.encode(+Infinity),
            // values: false,
            // keys: true
          });
          return readable;
        }
      };

      cb(null, appendOnly);
    });

  });
};
