var parsers = require('./parser');
var { Tree, Blob } = require('./tesli.js');

module.exports = function(oldRoot, newRoot) {

  // var oldTenders = this.parsedTenders || new Tree();

  // var newTenders = oldRoot.get('tenders', new Tree())
  //   .diff(newRoot.get('tenders'))
  //   .filter(path => path.indexOf('001/70') === 0)
  //   .transform(function(path, buffer) {
  //     var emiter = (key, value) => this.emit(key, new Buffer(JSON.stringify(value)));
  //     mapTender.call({ emit:  emiter }, path, buffer);
  //   })
  //   .apply(oldTenders);


  this.r = Tree.of({
    a: 1,
    b: {
      a: 1,
      b: 2,
      c: {
        a: 99,
        b: 77,
        c: {
          a: 66
        }
      }
    },
    c:{
      a:{
        b:{
          c: 88
        }
      },
      b:{
        b:{
          c: 88
        }
      }
    }
  }).reduce(1, function(buffers){
    return Buffer.concat(buffers);
  });

  this.r0 = this.r.toBlob(function(buffers){
    return Buffer.concat(buffers);
  });

  return;
  var mapReduce = makeMapReducer();

  this.სტატუსები = mapReduce({
    tenders: function(path, buffer){
      var id = parseInt(key.split(/\/|\./).splice(0, 2).join(''), 10);
      var tender = parseTender(buffer);
      var mapKey = tender.app_main
        ? tender.app_main['ტენდერის სტატუსი']
        : 'შეცდომა';
      var mapValue = [id];

      this.emit(mapKey, new Buffer(JSON.stringify(mapValue)));
    }
  }, function(buffers){
    var values = buffers.map(JSON.parse);
    var reducedValue = values.reduce((s, b) => s.concat(b), []);
    return new Buffer(JSON.stringify(reducedValue));
  });


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

function makeMapReducer(){
  return function(mapers, reducer){

  };
};
