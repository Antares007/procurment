var { Tree } = require('./tesli.js');
var parsers = require('./parser');

module.exports = function(oldRoot, newRoot) {

  var oldTenders = this.parsedTenders || new Tree();

  var newTenders = oldRoot.get('tenders', new Tree())
    .diff(newRoot.get('tenders'))
    .filter(p => p.path.indexOf('001/7') === 0)
    .map(mapTender)
    // .transform(function(patch){
    //   return patch.
    // })
    .apply(oldTenders);

  var delta = oldTenders
    .diff(newTenders)
    .map(mapStatuses)
    .toTree();

  this.ტენდერებისტატუსებისმიხედვით = (this.ტენდერებისტატუსებისმიხედვით || new Tree())
    .cd(function(){

      var reducer = function(buffers){
        return new Buffer(
          JSON.stringify(
            buffers.reduce((s, b) => s.concat(JSON.parse(b)), [])
          )
        );
      };

      this.reduced1 = delta.get('A').cd(function(){
        Object.keys(this).forEach(dir => this[dir] = this[dir].reduce(reducer));
      });

      this.reduced = delta.reduce(reducer);
    });




  function mapStatuses(key, buffer){
    var id = parseInt(key.split('/')[0], 10);
    console.log(id);
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
