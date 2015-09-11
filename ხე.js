var crypto = require('crypto');
var Tree = require('./tesli/tree').Tree,
  Commit = require('./tesli/commit').Commit,
  Blob = require('./tesli/blob').Blob;
var debug = require('debug')('khe');

export class ხე {
  constructor(commit){
    this.commit = commit;
  }

  filter(fn) {
    return this.grow(
      function(oldRoot, newRoot, oldTree) {
        return new Tree(async (git) => {
          var diff = git.diffTree(await oldRoot.getSha(git), await newRoot.getSha(git))
          var patchStream = diff.filter(x => fn(x.path))
          var newTreeSha = await git.mkDeepTree(await oldTree.getSha(git), patchStream)
          return newTreeSha
        })
      },
      `filter(${hash(fn.toString())})`
    )
  }

  orderBy(fn) {
    var reorder = function(baseCommit, newRootCommit) {
      return new Commit(async git => {
        var commit = (await git.diffTree(
            await baseCommit.getTree().getSha(git),
            await newRootCommit.getTree().getSha(git)
        ) .reduce((state, patch) => {
            var sortValue = fn(patch.path)
            state[sortValue] = (state[sortValue] || []).concat(patch)
            return state
          }, {})
          .transform(function(state, next) {
            for(var key of Object.keys(state).sort((a,b) => a < b ? -1 : (a > b ? 1 : 0))) {
              var patchs = state[key]
              this.push({key, patchs})
            }
            next()
          })
          .reduce(
            (state, x) => Commit.create(state.getTree().applyPatch(x.patchs), [state], x.key),
            baseCommit
          )
          .toArray())[0]
        return await (commit.getSha(git))
      })
    }
    var newTreeCommit = this.commit.grow(
      (newRootCommit) => reorder(Commit.create(new Tree(), [], ''), newRootCommit),
      (oldRootCommit, newRootCommit, oldTreeCommit) => new Commit(async git => {
        var minValue = (await git.diffTree(
            await oldRootCommit.getTree().getSha(git),
            await newRootCommit.getTree().getSha(git)
        ) .map(patch => fn(patch.path))
          .reduce((state, x) => state > x ? x : state, '\uffff')
          .toArray())[0]

        var baseCommit =  await git.revListWalk(
          (cmt) => cmt.message < minValue || cmt.message === '' ? new Commit(cmt.sha) : undefined,
          await oldTreeCommit.getSha(git)
        )
        return await reorder(baseCommit, newRootCommit).getSha(git)
      }),
      `orderBy(${hash(fn.toString())})`
    )

    return new ხე(newTreeCommit)
  }

  grow(seed, identity) {
    var message = identity
    return new ხე(
      this.commit.grow(
        function (newRootCommit) {
          return Commit.create(
            seed(new Tree(), newRootCommit.getTree(), new Tree()),
            [],
            message
          )
        },
        function (oldRootCommit, newRootCommit, oldTreeCommit) {
          return Commit.create(
            seed(oldRootCommit.getTree(), newRootCommit.getTree(), oldTreeCommit.getTree()),
            [oldTreeCommit, newRootCommit],
            message
          )
        },
        identity
      )
    )
  }
}

function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
