var { GitObject } = require('./gitobject');
var { Tree } = require('./tree');
var debug = require('debug')('commit');
var crypto = require('crypto');

export class Commit extends GitObject {
  constructor(gitContext){
    super(gitContext)
  }

  getTree(){
    return new Tree(async (git) => {
      var commitSha = await this.getSha(git);
      var commitObj = await git.getCommit(commitSha);
      return commitObj.tree;
    })
  }

  static create(tree, parents=[], message=""){
    return new Commit(async (git) => {
      var treeSha = await tree.getSha(git);
      var parentShas = await Promise.all(parents.map(p => p.getSha(git)));
      return await git.commitTree(treeSha, parentShas, message);
    });
  }

  grow(tesli){
    var fnToString = tesli.ფუნქცია.toString();
    var message = tesli.სახეობა + '(' + tesli.ანაბეჭდი() + ')';
    return new Commit(async (git) => {
      var newRootCommit = await this.getSha(git);
      var [roots, oldStates] = await Promise.all([
        git.exec(
          'rev-list --first-parent ' + newRootCommit,
          [x => x.split('\n').slice(0, -1)]
        ),
        git.exec(
          `rev-list --reflog --all --min-parents=2 --max-parents=2 --parents --grep '^${message}'`,
          [x => x.split('\n').slice(0, -1).map(x => x.split(' '))]
        )
      ]);
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
      var oldTree = oldState
        ? await git.revParse(oldState[1] + '^{tree}')
        : (tesli.საწყისი_მდგომარეობა
            ? await tesli.საწყისი_მდგომარეობა.getSha(git)
            : Tree.emptySha);

      var newTree = tesli.ფუნქცია(new Tree(oldRoot), new Tree(newRoot), new Tree(oldTree));

      console.log();
      console.log(roots);
      console.log(oldStates);
      console.log('->', oldRoot, newRoot, oldTree);

      var newCommit = oldState ? oldState[0]: await git.commitTree(oldTree, [], "საწყისი მდგომარეობა");
      return await git.commitTree(
        await newTree.getSha(git),
        [newCommit, newRootCommit],
        message + '\n' + fnToString
      );
    });
  }
}

function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
