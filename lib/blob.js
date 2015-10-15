import { GitObject } from './gitobject'
import { Tree } from './tree'

export class Blob extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isBlob = true
  }

  static of (value) {
    return new Blob(async (git) => {
      return await git.hashObject(new Buffer(JSON.stringify(value)))
    })
  }

  update (fn) {
    return new Blob(
      async (git) => await git.hashObject(
        ensureBuffer(
          convertArgs(fn)(await git.cat(await this.getSha(git)))
        )
      )
    )
  }

  merge (other, merger) {
    return new Blob(async (git) => {
      return await git.hashObject(
        ensureBuffer(
          convertArgs(merger)(
            await git.cat(await this.getSha(git)),
            await git.cat(await other.getSha(git))
          )
        )
      )
    })
  }

  toTree (fn) {
    return new Tree(async (git) => {
      var entries = []
      var buffer = await git.cat(await this.getSha(git))

      convertArgs(fn).call({
        emit: function (path, buffer) {
          entries.push({ path, buffer: ensureBuffer(buffer) })
        },
        link: function (path, sha) {
          entries.push({ path, sha })
        }
      }, buffer)

      var treeEntries = await Promise.all(
        entries.map(async e => ({
          mode: '100644',
          type: 'blob',
          sha: e.sha ? e.sha : await git.hashObject(e.buffer),
          path: e.path
        }))
      )

      return await git.mkDeepTree(Tree.emptySha, treeEntries)
    })
  }
}

function convertArgs (fn) {
  var fnstr = fn.toString()
  var argNames = fnstr.slice(fnstr.indexOf('(') + 1, fnstr.indexOf(')'))
    .split(',')
    .map(x => x.trim())
  return function (...args) {
    var convertedArgs = args.map(
      (a, i) => !argNames[i].toLowerCase().endsWith('buffer') && a instanceof Buffer
        ? JSON.parse(a.toString())
        : a
    )
    return fn.apply(this, convertedArgs)
  }
}
function ensureBuffer (rez) {
  if (typeof rez !== 'undefined') {
    return rez instanceof Buffer ? rez : new Buffer(JSON.stringify(rez, null, '  '))
  }
}
