var parsers = require('./parser');
var { Tree, Blob, Commit } = require('./tesli.js');


module.exports = function(oldRoot, newRoot) {



  function khe(ფესვი_ხე, ეს_ხე){

    var ტენდერების_ხე =
      ფესვი_ხე.გამოხშირე(მისამართი => მისამართი.იწყება('tenders/'))
              .გაფურჩქნე(ფოთოლი => ფოთოლი.გადაიყვანე(ტენდერში))
              .ამოკრიბე((ხე, ფოთოლი) => ხე.შეკრიბე(ფოთოლი.გაფურჩქნე(ოცეულების_ხედ)));


    var სტატუსების_ხე = ტენდერების_ხე.ამოკრიბე((ხე, ხ) => {
      ფოთლები.reduce(function(ხე, ფოთოლი) {
        return ხე.დაუმატე(ფოთოლი.გაფურჩქნე((ხე, ტენდერი) => ხე.მიაბი(ტენდერი.status, ტენდერი.id)))
      }, ახალი_ხე())

    })

    return ეს_ხე.მიაბი('data/.json/tenders', ტენდერების_ხე);
  }

  var tree = function daitote(oldRoot, newRoot, oldTree){
    var oldTenders = oldTree.get('data/.json/tenders', new Tree());
    var tenders = oldRoot.get('tenders', new Tree())
                         .diff(newRoot.get('tenders'))
                         .filter(path => path.indexOf('001/7') === 0)
                         .transform(mapTenders)
                         .apply(oldTenders);

    var oldStatusebisMikhedvit = oldTree.get('data/.json/statusebisMikhedvit', new Tree());
    var statusebisMikhedvit = function daitote(oldRoot, newRoot, oldTree){
      var oldStatusebisMikhedvit = oldTree.get('statusebisMikhedvit', new Tree());
      var statusebisMikhedvit = oldRoot.diff(newRoot).transform(mapStatesebi).apply(oldStatusebisMikhedvit);

      return oldTree.cd(function(){
        this.statusebisMikhedvit = statusebisMikhedvit;
        this.reduced = statusebisMikhedvit.reduce(arrConcat);
      });
    }(oldTenders, tenders, oldStatusebisMikhedvit);

    return oldTree.cd(function(){
      this['data'] = this['data'].cd(function(){
        this['.json'] = this['.json'].cd(function(){
          this['tenders'] = tenders;
          this['by-status'] = statusebisMikhedvit;
        })
      })
    });
  }(oldRoot, newRoot, this.tree || Tree.of({ data: { '.json': {} } }));

  this.tree = tree;

  function arrConcat(buffers){
    var concated = buffers.map(b => JSON.parse(b.toString()))
      .reduce((arr1, arr2) => arr1.concat(arr2), []);
    return new Buffer(JSON.stringify(concated));
  }

  function mapStatesebi(path, buffer){
    var tender = JSON.parse(buffer.toString());
    var mapKey = tender.app_main
      ? tender.app_main['ტენდერის სტატუსი']
      : 'შეცდომა';
    var mapValue = [tender.id];
    this.emit(mapKey, new Buffer(JSON.stringify(mapValue)));
  }

  function mapTenders(path, buffer){
    var id = parseInt(path.split(/\/|\./).splice(0, 2).join(''), 10);
    var tender = parseTender(buffer);
    tender.id = id;
    this.emit(id.toString(), new Buffer(JSON.stringify(tender)));
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
