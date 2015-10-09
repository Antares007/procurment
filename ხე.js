var Tree = require('./tesli/tree').Tree
var Blob = require('./tesli/blob').Blob
var Commit = require('./tesli/commit').Commit
var purify = require('./purify')

export class ხე {

  constructor (commit, differ) {
    this.commit = commit
  }

  select (path) {
    return this.grow(
      function (oldRoot, newRoot, oldTree) {
        return newRoot.get(path, new Tree())
      },
      `select(${path})`
    )
  }

  reduce (fn, initialState) {
    fn = purify(fn)
    var mkTree = function (initialState, oldRoot, newRoot, oldTree) {
      return new Tree(async git => {
        initialState = JSON.parse((await git.cat(await initialState.getSha(git))).toString())
        return await oldTree.merge(oldRoot, newRoot, x => x.transform(async function (patch) {
          initialState = fn.call(
            {
              emit: (path, buffer) => this.push({ path, buffer })
            },
            initialState,
            await git.cat(patch.newSha),
            patch.path
          )
        }).transform(async function (x) {
          this.push({
            newMode: '100644',
            status: 'A',
            path: 'data/' + x.path,
            newSha: await git.hashObject(x.buffer)
          })
        })).getSha(git)
      }).cd(function () {
        this['state.json'] = Blob.of(initialState)
      })
    }
    return this._grow(
      (newRootCommit) =>
        Commit.create(
          mkTree(
            Blob.of(initialState),
            new Tree(),
            newRootCommit.getTree(),
            new Tree()
          ),
          [],
          ''),
      (oldRootCommit, newRootCommit, oldTreeCommit) =>
        Commit.create(
          mkTree(
            oldTreeCommit.getTree().getBlob('state.json'),
            oldRootCommit.getTree(),
            newRootCommit.getTree(),
            oldTreeCommit.getTree()
          ),
          [oldTreeCommit]),
      `reduce_${fn.id}`
    ).select('data/')
  }

  map (fn) {
    fn = purify(fn)
    return this.grow(
      function (oldRoot, newRoot, oldTree) {
        return new Tree(async (git) => {
          return await oldTree.merge(oldRoot, newRoot, x => x.transform(async function (patch) {
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
          }).transform(async function (x) {
            var sha = await git.hashObject(x.value)
            x[x.status === 'A' ? 'newSha' : 'oldSha'] = sha
            x[x.status === 'A' ? 'newMode' : 'oldMode'] = '100644'
            this.push(x)
          })).getSha(git)
        })
      },
      `map_${fn.id})`
    )
  }

  filter (fn) {
    fn = purify(fn)
    return this.grow(
      function (oldRoot, newRoot, oldTree) {
        return new Tree(async (git) => {
          var diff = git.diffTree(await oldRoot.getSha(git), await newRoot.getSha(git))
          var patchStream = diff.filter(x => fn(x.path))
          var newTreeSha = await git.mkDeepTree(await oldTree.getSha(git), patchStream)
          return newTreeSha
        })
      },
      `filter${fn.id}`
    )
  }

  orderBy (fn) {
    fn = purify(fn)
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
    return this._grow(
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
      `orderBy_${fn.id}`
    )
  }

  grow (seed, identity) {
    var message = identity
    return this._grow(
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
  }

  _grow (fn1, fn2, seedId) {
    return new ხე(
      this.commit.grow(
        (newRootCommit) => new Commit(async git => {
          return await fn1(newRootCommit).getSha(git)
        }),
        (oldRootCommit, newRootCommit, oldTreeCommit) => new Commit(async git => {
          return await fn2(oldRootCommit, newRootCommit, oldTreeCommit).getSha(git)
        })
      )
    )
  }
}
