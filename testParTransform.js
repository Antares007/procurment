var parTransform = require('./parallel-transform.js');
var transform = require('./transform.js');


var from = 0;
var to = 100;
new require('stream').Readable({
  objectMode: true,
  read: function(){
    this.push(from);
    from = from + 1;
    if(from >= to) {
      this.push(null);
    }
  }
}).pipe(
  parTransform(10, function(i, next){
    var ds = this;
    setTimeout(function(){
      ds.push(i.toString() + '\n');
      next();
    }, 100);
  })
).pipe(
  process.stdout
)
