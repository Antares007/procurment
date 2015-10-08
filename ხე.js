var crypto = require('crypto')
var Tree = require('./tesli/tree').Tree
// var Blob = require('./tesli/tree').Blob
var Commit = require('./tesli/commit').Commit
// var debug = require('debug')('khe')

export class ხე {

  constructor (commit, differ) {
    this.commit = commit
  }

  reduce (fn) {
    var _reduce = function (tree, key) {
      return tree.toBlob(function (buffers) {
        var values = buffers.map(x => JSON.parse(x))
        var value = fn(values, key)
        return new Buffer(JSON.stringify(value))
      })
    }
    return this.grow(
      (oldRoot, newRoot, oldTree) => new Tree(async git => {
        var patchStream = await git.diffTree(await oldRoot.getSha(git), await newRoot.getSha(git), ['--raw'])
          .transform(async function (x) {
            var key = new Buffer(x.path, 'base64').toString('utf8')
            var isDeleted = x.status === 'D'
            this.push({
              newMode: '100644',
              status: isDeleted ? 'D' : 'A',
              path: x.path,
              newSha: isDeleted ? undefined : await _reduce(new Tree(x.newSha), key).getSha(git)
            })
          })
        return await git.mkDeepTree(await oldTree.getSha(git), patchStream)
      }),
      `reduce(${hash(fn.toString())})`
    )
  }

  map (fn) {
    return this.grow(
      function (oldRoot, newRoot, oldTree) {
        return new Tree(async (git) => {
          var diff = git.diffTree(await oldRoot.getSha(git), await newRoot.getSha(git))
          var patchStream = diff.transform(async function (patch) {
            var ds = this
            var mkMaper = function () {
              return function (buffer, status) {
                fn.call(
                  { emit: (key, value) => ds.push({ status, path: key, value }) },
                  buffer,
                  patch.path
                )
              }
            }
            if (patch.oldSha) mkMaper()(await git.cat(patch.oldSha), 'D')
            if (patch.newSha) mkMaper()(await git.cat(patch.newSha), 'A')
            // batchCat.end()
          }).transform(async function (x) {
            var sha = await git.hashObject(x.value)
            x[x.status === 'A' ? 'newSha' : 'oldSha'] = sha
            x[x.status === 'A' ? 'newMode' : 'oldMode'] = '100644'
            this.push(x)
          })
          var newTreeSha = await git.mkDeepTree(await oldTree.getSha(git), patchStream)
          return newTreeSha
        })
      },
      `map(${hash(fn.toString())})`
    )
  }

  filter (fn) {
    return this.grow(
      function (oldRoot, newRoot, oldTree) {
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

  orderBy (fn) {
    var reorder = function (baseCommit, newRootCommit) {
      return new Commit(async git => {
        var commit = (await git.diffTree(
          await baseCommit.getTree().getSha(git),
          await newRootCommit.getTree().getSha(git)
        ).transform(async function (patch) {
          this.push({ sortValue: fn(await git.cat(patch.newSha), patch.path), patch })
        })
        .reduce((state, x) => {
          var { sortValue, patch } = x
          state[sortValue] = (state[sortValue] || []).concat(patch)
          return state
        }, {})
        .transform(function (state, next) {
          for (var key of Object.keys(state).sort((a, b) => a < b ? -1 : (a > b ? 1 : 0))) {
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
        var isAppendOnly = async function (tree1, tree2) {
          var rez = await git.diffTree(await tree1.getSha(git), await tree2.getSha(git), ['--raw'])
            .transform(function (patch, next) {
              if (patch.status !== 'A') {
                this.push(false)
                this.push(null)
              } else {
                next()
              }
            }).toArray()
          return rez.length === 0
        }
        var findBaseCommit = async function (commit) {
          if (await isAppendOnly(commit.getTree(), newRootCommit.getTree())) {
            return commit
          } else {
            return await findBaseCommit(commit.getParent())
          }
        }
        return await reorder(await findBaseCommit(oldTreeCommit), newRootCommit).getSha(git)
      }),
      `orderBy(${hash(fn.toString())})`
    )

    return new ხე(newTreeCommit)
  }

  grow (seed, identity) {
    var message = identity
    return new ხე(
      this.commit.grow(
        function (newRootCommit) {
          var newTree = seed(new Tree(), newRootCommit.getTree(), new Tree())
          var newTreeCommit = Commit.create(newTree, [], message)
          return new Commit(async git => await newTreeCommit.getSha(git))
        },
        function (oldRootCommit, newRootCommit, oldTreeCommit) {
          var newTree = seed(oldRootCommit.getTree(), newRootCommit.getTree(), oldTreeCommit.getTree())
          var newTreeCommit = Commit.create(newTree, [oldTreeCommit, newRootCommit], message)
          return new Commit(async git => await newTreeCommit.getSha(git))
        },
        identity
      )
    )
  }
}

function hash (value) {
  var shasum = crypto.createHash('sha1')
  shasum.update(value.toString())
  return shasum.digest('hex')
}
