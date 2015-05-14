var { Tree } = require('./tesli.js');
var parsers = require('./parser');

module.exports = function(oldRoot, newRoot) {

  var oldTenders = this.parsedTenders || new Tree();

  var newTenders = oldRoot.get('tenders', new Tree())
    .diff(newRoot.get('tenders'))
    .filter(p => p.path.indexOf('001/70') === 0)
    .map(mapTender)
    .apply(oldTenders);

  this.parsedTenders = newTenders;

  // var diffTree = oldParsedTendersTree
  //   .diff(newParsedTendersTree)
  //   .map(function(key, buffer){
  //     var tender = JSON.parse(buffer.toString());
  //     this.emit((tender.app_main || { 'ტენდერის სტატუსი': 'შეცდომა' })['ტენდერის სტატუსი'], 1);
  //   })
  //   .apply(oldTree)
  //   .checkout(function(){
  //     var self = this;
  //     this.ავოე1 = this['ხელშეკრულება დადებულია'].checkout(function(){
  //       this.sopikuna = self['ხელშეკრულება დადებულია'].checkout(function(){
  //         this.achikuna = self['ხელშეკრულება დადებულია'];
  //       });
  //     });
  //     this.ავოე2 = this['ხელშეკრულება დადებულია'];
  //     this.ავოე3 = this['ხელშეკრულება დადებულია'];
  //     this.ავოე4 = this['ხელშეკრულება დადებულია'];
  //   });



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
