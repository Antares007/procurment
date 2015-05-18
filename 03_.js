var parsers = require('./parser');
var { Tree, Blob } = require('./tesli.js');

module.exports = function(oldRoot, newRoot) {

  this.treeFromBlob = Blob.of(['a','v','i'])
    .toTree(function(buffer){
      var list = JSON.parse(buffer.toString());
      list.forEach(x => this.emit('avi/' + x, new Buffer(x)));
    });

  this.version = Blob.of({ Hello: 'Tree' });

  var j = 0;
  var fn = function(){
    this.value = Blob.of(1);

    if(j++ < 10) {
      this['d' + j] = new Tree().cd(fn);
    }
  };
  fn.call(this);

  this.d1Reduced = this.d1.reduce(function(buffers){
    return Buffer.concat(buffers);
  });

  var oldTenders = this.parsedTenders || new Tree();

  var newTenders = oldRoot.get('tenders', new Tree())
    .diff(newRoot.get('tenders'))
    .filter(path => path.indexOf('001/7') === 0)
    .transform(function(path, buffer) {
      var emiter = (key, value) => this.emit(key, new Buffer(JSON.stringify(value)));
      mapTender.call({ emit:  emiter }, path, buffer);
    })
    .apply(oldTenders);

  var reducer = function(buffers){
    return new Buffer(
      JSON.stringify(
        buffers.reduce((s, b) => s.concat(JSON.parse(b)), [])
      )
    );
  };
  var merger = (a, b) => reducer([a, b]);

  var prevState = this.state;

  this.state = new Tree().cd(function(){
    if(prevState){
      this.prevState = prevState;
    }

    this.delta = oldTenders.diff(newTenders)
      .transform(function(path, buffer) {
        var emiter = (key, value) => this.emit(key, new Buffer(JSON.stringify(value)));
        mapStatuses.call({ emit:  emiter }, path, buffer);
      })
      .toTree();

    if(!prevState){
      this.reduced = this.delta.get('A/new').cd(function(){
        for(var key in this){
          this[key] = this[key].reduce(reducer);
        }
      });
    } else {
      this.reduced = new Tree()
        .merge(
          this.delta.get('A', new Tree()).cd(function(){
            for(var key in this){
              this[key] = this[key].reduce(reducer)
                .merge(prevState.get('reduced/' + key, new Tree()).reduce(reducer), merger);
            }
          }),
          merger
        ).merge(
          this.delta.get('D', new Tree()).cd(function(){
            var recurse = function(key, prevState, deteted){
              return function(){
                this.values = prevState.get()
              }
            }
            for(var key in this){
              this[key] = new Tree().cd(recurse(key, prevState, this[key])).reduce(reducer);
            }
          }),
          merger
        ).merge(
          this.delta.get('M', new Tree()).cd(function(){

          }),
          merger
        );
    }

  });


  function mapStatuses(key, buffer){
    var id = parseInt(key.split('/')[0], 10);
    var tender = JSON.parse(buffer.toString());
    this.emit((tender.app_main || { 'ტენდერის სტატუსი': 'შეცდომა' })['ტენდერის სტატუსი'], [id]);
  }

  function mapTender(key, buffer){
    var tender = parseTender(buffer);
    var id = parseInt(key.split(/\/|\./).splice(0, 2).join(''), 10);
    this.emit(id.toString(), tender);
  }

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

var crypto = require('crypto');
function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
