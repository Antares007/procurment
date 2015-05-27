var argv = require('yargs').argv;
var path = require('path');
var mygit = require('./mygit.js');

var Tree = require('./tesli/tree').Tree,
  Commit = require('./tesli/commit').Commit,
  Blob = require('./tesli/blob').Blob;

class ხე {
  constructor(commitFn){
    this.commitFn = commitFn;
  }

  გამოხშირე(fn){
    new ხე(() => {

      var tesli = {
        სახეობა: 'გამოხშირე',
        ფუნქცია: hash(fn.toString())
      };

      var newRootCommit = this.commitFn(tesli);

      // var {diff, oldTreeCommit} = getPrevCommits(rootCommit, tesli);

      var oldTreeCommit = new Commit(async (git) => {
        var newRootSha = await newRootCommit.getSha(git);

        return sha;
      });

      var newTree = new Tree(async (git) => {
        var oldTreeCommitSha = await oldTreeCommit.getSha(git);
        var oldCommit = await git.getCommit(oldTreeCommitSha);
        var oldRootTreeSha = oldCommit.parents.length > 0
          ? await git.revParse(oldCommit.parents[0] + '{tree}')
          : emptyTreeSha;
          var newRootTreeSha;
          var stream = git.diff(oldRootTreeSha, newRootTreeSha);

          var writedTreeSha;

          return writedTreeSha;
      })

      return Commit.create(newTree, [oldTreeCommit, newRootCommit], tesli);
    });
  }
}

var git = mygit(argv.gitDir + '/.git');
var rootTreeSha = argv._;
var tesliPath = path.resolve(argv.tesli);

var main = async function(){

  
  return await Commit.create(Tree.of({
    'ჰელლო': 'ვორლდ',
    'აი': 'ია',
    'აქ': {
      'აც': 'ია'
    }
  })).getSha(git);
};

main()
    .then((sha) => console.log(sha))
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
