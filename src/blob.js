import { GitObject } from './gitobject'
import { Tree } from './tree'

export class Blob extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isBlob = true
  }

  static of (value) {
    return new Blob(async (git) => {
      return await git.hashObject(
        value instanceof Buffer
          ? value
          : new Buffer(JSON.stringify(value, null, '  '))
      )
    })
  }

  bind (fn) {
    if (typeof fn !== 'function') throw new Error('fn should be function')
    return new Blob(
      async (git) => {
        var buffer = await git.cat(await this.getSha(git))
        var rez = convertArgs(fn)(buffer)
        return await (rez instanceof Blob ? rez : Blob.of(rez)).getSha(git)
      }
    )
  }

  toTree (fn) {
    if (typeof fn !== 'function') throw new Error('fn should be function')
    return new Tree(async (git) => {
      var entries = []
      var buffer = await git.cat(await this.getSha(git))

      var rez = convertArgs(fn).call({
        emit: function (path, buffer) {
          entries.push({ path, buffer: ensureBuffer(buffer) })
        },
        link: function (path, sha) {
          entries.push({ path, sha })
        }
      }, buffer)
      if (rez) return await (rez instanceof Tree ? rez : Tree.of(rez)).getSha(git)

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
