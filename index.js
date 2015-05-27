var argv = require('yargs').argv;
var path = require('path');
var mygit = require('./mygit.js');
var crypto = require('crypto');

var Tree = require('./tesli/tree').Tree,
  Commit = require('./tesli/commit').Commit,
  Blob = require('./tesli/blob').Blob;
var i = 0;
class ხე {
  constructor(commit){
    this.commit = commit;
  }

  გამოხშირე(fn){
    var tesli = {
      სახეობა: 'გამოხშირე',
      ფუნქცია: hash(fn.toString())
    };
    var message = tesli.სახეობა + '(' + tesli.ფუნქცია + ')';

    return this.გაზარდე(tesli, message, function(oldRoot, newRoot, oldTree){
      return oldTree;
    });
  }

  გაზარდე(tesli, message, fn){
    var commit = new Commit(async (git) => {
      var newRootCommit = await this.commit.getSha(git);
      var roots = await git.exec(
        'rev-list --first-parent ' + newRootCommit,
        [x => x.split('\n').slice(0, -1)]
      );
      var oldStates = await git.exec(
        `rev-list --reflog --all --min-parents=2 --max-parents=2 --parents --grep '${message}'`,
        [x => x.split('\n').slice(0, -1).map(x => x.split(' '))]
      );
      var rec = function(roots, oldStates){
        var oldState = oldStates.shift();
        if(!oldState) return;
        if(roots.indexOf(oldState[2]) >= 0) return oldState;
        return rec(roots, oldStates);
      }
      var oldState = rec(roots, oldStates);
      if(oldState && oldState[2] === newRootCommit){
        return oldState[0];
      }
      var oldRoot = oldState ? await git.revParse(oldState[2] + '^{tree}') : Tree.emptySha;
      var newRoot = await git.revParse(newRootCommit + '^{tree}');
      var oldTree = oldState ? await git.revParse(oldState[1] + '^{tree}') : Tree.emptySha;

      var newTree = fn(new Tree(oldRoot), new Tree(newRoot), new Tree(oldTree));

      console.log();
      console.log(roots);
      console.log(oldStates);
      console.log('->', oldRoot, newRoot, oldTree);

      var newCommit = oldState ? oldState[0]: await git.commitTree(oldTree, [], "საწყისი მდგომარეობა");
      return await git.commitTree(await newTree.getSha(git), [newCommit, newRootCommit], message);
    });

    return new ხე(commit);
  }
}

var git = mygit(argv.gitDir + '/.git');
var rootTreeSha = argv._;
var tesliPath = path.resolve(argv.tesli);

var main = async function(){
  
  var ეს_ხე = new ხე(new Commit('initial'))
      .გამოხშირე(() => 2)
      .გამოხშირე(() => 4)
      .გამოხშირე(() => 4); 

  return await ეს_ხე.commit.getSha(git);
  // return await Commit.create(Tree.of({
  //   'ჰელლო': 'ვორლდ',
  //   'აი': 'ია',
  //   'აქ': {
  //     'აც': 'ია'
  //   }
  // })).getSha(git);
};

main().then((sha) => console.log(sha))
  .catch(function(err){
    console.log(argv);
    process.nextTick(function(){
      throw err;
    });
  });
return;
// var ფესვი_ხე = new ხე(new Commit(argv.p));

// var ახალი_ხე = ფესვი_ხე.გამოხშირე()
//   .getCommit(function(rootCommit, Tesli){

//     return {};
//   });

// ახალი_ხე.getSha(git)

function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
