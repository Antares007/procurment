var parsers = require('./parser');
var { Tree, Blob } = require('./tesli.js');


module.exports = function(oldRoot, newRoot) {



// var tenders = root
//   .map(function(path, buffer){
//     var id = parseId(path);
//     this.emit(id % 1000, id);
//   })
//   .reduce(function(buffers){
//     return buffers[0];
//   })
//   .transform();

  var partition = parseInt(process.env.PARTITION, 10);

  this.tenders = oldRoot.get('tenders', new Tree())
    .diff(newRoot.get('tenders'))
        // .filter(path => parseInt(path.split(/\/|\./).splice(0, 2).join(''), 10) % 5 === partition)
        .filter(path => path.indexOf('100/') === 0)
        .transform(function(path, buffer){
          var id = parseInt(path.split(/\/|\./).splice(0, 2).join(''), 10);
          var tender = parseTender(buffer);
          this.emit(id.toString(), new Buffer(JSON.stringify(tender)));
        })
    .apply(this.tenders || new Tree());

  this.t = Blob.of(['a','b','c']).toTree(function(buffer){
    this.emit('a/b/c', buffer);
    this.emit('e', buffer);
  })

  function parseTender(buffer){
    var pages = buffer.toString('utf8').split(String.fromCharCode(0));
    try {
      return {
        app_main: parsers.app_main(pages[0]),
        app_docs: parsers.app_docs(pages[1]),
        app_bids: parsers.app_bids(pages[2]),
        app_result: parsers.app_result(pages[3]),
        agency_docs: parsers.agency_docs(pages[4])
      };
    } catch(e) {
      return {
        err: e.toString()
      };
    }
  }
};
