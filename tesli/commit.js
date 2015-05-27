var { GitObject } = require('./gitobject');
var { Tree } = require('./tree');
var debug = require('debug')('commit');

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

  static create(tree, parents=[]){
    return new Commit(async (git) => {
      var treeSha = await tree.getSha(git);
      var parentShas = await Promise.all(parents.map(p => p.getSha(git)));
      return await git.commitTree(treeSha, parentShas);
    });
  }
}
