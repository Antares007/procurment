'use strict'
const GitObject = require('./gitobject')
const Blob = require('./blob')
const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const modeOfTree = parseInt('40000', 8)
const modeOfBlob = parseInt('100644', 8)
const modeOfCommit = parseInt('160000', 8)

class Tree extends GitObject {
  valueOf (repo) {
    return super.valueOf(repo).then(function (go) {
      if (go.type !== 'tree') throw new Error('not a tree')
      var entries = decodeTree(go.body)
      return Object.keys(entries).reduce(function (tree, name) {
        var e = entries[name]
        var obj = e.mode === modeOfTree || e.mode === modeOfCommit ? repo.get(Tree, e.hash) : repo.get(Blob, e.hash)
        obj.hash = e.hash
        obj.mode = e.mode
        tree[name] = obj
        return tree
      }, {})
    })
  }

  static of (value) {
    var keys = Object.keys(value)
    if (keys.length === 0) return new Tree(() => Promise.resolve(emptyTreeHash))
    return new Tree(
      (repo) => Promise.all(
        keys.map((name) => {
          var obj = value[name]
          return obj.getHash(repo).then((hash) => ({
            name,
            hash,
            mode: obj.mode || (obj instanceof Tree ? modeOfTree : modeOfBlob)
          }))
        })
      ).then((entries) => {
        var tree = entries.reduce(function (s, e) {
          s[e.name] = { mode: e.mode, hash: e.hash }
          return s
        }, {})
        return GitObject.of({ type: 'tree', body: encodeTree(tree) }).getHash(repo)
      })
    )
  }
}
module.exports = Tree

function decodeTree (body) {
  var i = 0
  var length = body.length
  var start
  var mode
  var name
  var hash
  var tree = {}
  while (i < length) {
    start = i
    i = body.indexOf(0x20, start)
    if (i < 0) throw new SyntaxError('Missing space')
    mode = parseOct(body, start, i++)
    start = i
    i = body.indexOf(0x00, start)
    name = toUnicode(body, start, i++)
    hash = toHex(body, i, i += 20)
    tree[name] = { mode: mode, hash: hash }
  }
  return tree
}

function parseOct (buffer, start, end) {
  var val = 0
  while (start < end) {
    val = (val << 3) + buffer[start++] - 0x30
  }
  return val
}

function toUnicode (binary, start, end) {
  return binary.slice(start, end).toString('utf8')
}

function toHex (binary, start, end) {
  var hex = ''
  if (end === undefined) {
    end = binary.length
    if (start === undefined) start = 0
  }
  for (var i = start; i < end; i++) {
    var byte = binary[i]
    hex += String.fromCharCode(nibbleToCode(byte >> 4)) + String.fromCharCode(nibbleToCode(byte & 0xf))
  }
  return hex
}

function nibbleToCode (nibble) {
  nibble |= 0
  return (nibble + (nibble < 10 ? 0x30 : 0x57)) | 0
}

function treeMap (key) {
  /* jshint validthis:true */
  var entry = this[key]
  return { name: key, mode: entry.mode, hash: entry.hash }
}

function treeSort (a, b) {
  var aa = (a.mode === modeOfTree) ? a.name + '/' : a.name
  var bb = (b.mode === modeOfTree) ? b.name + '/' : b.name
  return aa > bb ? 1 : aa < bb ? -1 : 0
}

function encodeTree (body) {
  var tree = ''
  if (Array.isArray(body)) throw new TypeError('Tree must be in object form')
  var list = Object.keys(body).map(treeMap, body).sort(treeSort)
  for (var i = 0, l = list.length; i < l; i++) {
    var entry = list[i]
    tree += entry.mode.toString(8) + ' ' + encodeUtf8(entry.name) + '\0' + decodeHex(entry.hash)
  }
  return new Buffer(tree, 'binary')
}

function decodeHex (hex) {
  var j = 0
  var l = hex.length
  var raw = ''
  while (j < l) {
    raw += String.fromCharCode((codeToNibble(hex.charCodeAt(j++)) << 4) | codeToNibble(hex.charCodeAt(j++))
    )
  }
  return raw
}

function codeToNibble (code) {
  code |= 0
  return (code - ((code & 0x40) ? 0x57 : 0x30)) | 0
}

function encodeUtf8 (unicode) {
  return unescape(encodeURIComponent(unicode))
}
