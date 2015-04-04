var stream = require('stream');
var assert = require('assert');

var parallelTransform = function(maxLevel, transformFn){
  var currenLevel = 0;
  var savedNext = null;
  var savedDone = null;
  return new require('stream').Transform({
    objectMode: true,
    transform: function(chunk, _, next){

      currenLevel++;

      transformFn.call(this, chunk, function(){

        currenLevel--;

        if(savedNext) {
          assert(savedDone === null);
          var n = savedNext;
          savedNext = null;
          n();
        }

        if(savedDone && currenLevel === 0){
          assert(savedNext === null);
          savedDone();
        }
        
      });

      if(currenLevel < maxLevel){
        next();
      } else {
        assert(savedNext === null);
        savedNext = next;
      }

    },
    flush: function(done){
      if(currenLevel === 0){
        assert(savedNext === null);
        done();
      } else {
        assert(savedDone === null);
        savedDone = done;
      }
    }
  })
};

module.exports = parallelTransform;
