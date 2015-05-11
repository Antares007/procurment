var tesli = require('./03_.js');
var debug = require('debug')('tesliRunner');
var { AStream } = require('./astream.js');
var transform = require('./transform.js');
var mygit = require('./mygit.js');
var denodeify = require('./denodeify.js');

class Tree {
  constructor(sha, git){
    this.sha = sha;
    this.git = git;
  }
  diff(other){
    var batchCat = this.git.catFileBatch();
    var cat = denodeify(batchCat.cat);
    return this.git.diffTree(this.sha, other.sha)
      .map(x => new Patch(x, cat))
      .once('finish', function(){
        batchCat.end();
      });
  }
}

class Patch {
  constructor(patch, cat){
    Object.assign(this, patch);
    this.cat = cat;
  }
  newContent(){
    return this.cat(this.newSha);
  }
  oldContent(){
    return this.cat(this.oldSha);
  }
}

var rez = tesli(
  new Tree('4b825dc642cb6eb9a060e54bf8d69288fbee4904', mygit('/data/procurment-data2/.git')),
  new Tree('38f5e5fa6f33cac790c29650bead4f88905b2abb', mygit('/data/procurment-data2/.git')),
  null
);

debug(rez);
