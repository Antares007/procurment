var { GitObject } = require('./gitobject')
var { Tree } = require('./tree')

export class Commit extends GitObject {
  constructor (gitContext) {
    super(gitContext)
  }

  getTree () {
    return new Tree(async (git) => {
      var commitSha = await this.getSha(git)
      var commitObj = await git.getCommit(commitSha)
      return commitObj.tree
    })
  }

  static create (tree, parents=[], message='') {
    return new Commit(async (git) => {
      var treeSha = await tree.getSha(git)
      var parentShas = await Promise.all(parents.map(p => p.getSha(git)))
      return await git.commitTree(treeSha, parentShas, message)
    })
  }

  grow (tesli) {
    var fnToString = tesli.ფუნქცია.toString()
    var message = tesli.სახეობა + '(' + tesli.ანაბეჭდი() + ')'
    return new Commit(async (git) => {
      var commitNewTree = async function (newTree, root, oldtree) {
        var parents = [oldtree, root]
        return { 
          sha: await git.commitTree(newTree, parents, message + '\n' + fnToString),
          tree: newTree,
          parents: parents
        }
      }
      var makeInitialTree = async () => ({ 
        sha: await git.commitTree(Tree.emptySha, [], 'საწყისი მდგომარეობა'),
        tree: Tree.emptySha
      })
      var findTree = await (async function(){
        var treesByRoot = (await git.exec(
          `rev-list --reflog --all --min-parents=2 --max-parents=2 --parents --grep '^${message}'`,
          [x => x.split('\n').slice(0, -1).map(x => x.split(' '))]
        )).reduce(
          (state, x) => (
            state[x[2]] = { sha: x[0], tree: x[0] + '^{tree}', parents: [x[1], x[2]] },
            state
          ),
          {}
        )
        return (commit) => treesByRoot[commit.sha]
      })()
      var grow = async function (rootCommit) {
        var newTreeCommit = await findTree(rootCommit)
        if(newTreeCommit) return newTreeCommit
        var oldRoot = rootCommit.parents
          ? new Tree(rootCommit.parents[0] + '^{tree}')
          : new Tree()
        var newRoot = new Tree(rootCommit.tree)
        var oldTreeCommit = rootCommit.parents
          ? await grow(await git.getCommit(rootCommit.parents[0]))
          : await makeInitialTree()
        var oldTree = rootCommit.parents
          ? new Tree(oldTreeCommit.tree)
          : new Tree()
        var newTree = tesli.ფუნქცია(oldRoot, newRoot, oldTree)
        return await commitNewTree(await newTree.getSha(git), rootCommit.sha, oldTreeCommit.sha)
      }
      return (await grow(await git.getCommit(await this.getSha(git)))).sha
    })
  }
}
