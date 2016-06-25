#!/usr/bin/env node
'use strict'
const argv = require('yargs')
  .default('git-dir', require('path').resolve(process.cwd(), '.git'))
  .demand(1)
  .argv
const gitDir = argv.gitDir
const seedHash = argv._[0]

const debug = require('debug')('grow')
const api = require('../src/repo')(gitDir)
const deasync = require('deasync')
const valueOf = deasync(function (hashish, cb) {
  hashish
    .valueOf(api)
    .then((v) => cb(null, v))
    .catch((err) => {
      cb(err)
    })
})

const path = require('path')
const fs = require('fs')

const Seed = require('gittypes/seed')
const Json = require('gittypes/json')
const Tree = require('gittypes/tree')
const mkdirp = require('mkdirp')
require('../src/gitrequire')(valueOf)

api.grow = function (seedHash) {
  return grow(seedHash)
    .catch((err) => process.nextTick(function () { throw err }))
}

debug('start')
grow(seedHash)
    .then((v) => console.log(v))
    .catch((err) => process.nextTick(function () { throw err }))

function grow (seedHash) {
  var rez
  var cachePath = path.resolve(__dirname, '../.cache', seedHash.slice(0, 2), seedHash.slice(2))
  try {
    mkdirp.sync(path.dirname(cachePath))
    rez = fs.readFileSync(cachePath, 'utf8')
    return Promise.resolve(rez)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return new Seed(() => Promise.resolve(seedHash)).bind(Tree, function (s) {
      var exports = s.fn.load()
      return s.args.bind(Tree, function (t) {
        var args = Object.keys(t).map((i) => t[i])
        var argsStr = args.map((a) => `${a.constructor.name}_${a.hash.slice(0, 6)}`).join(', ')
        return Tree.of({
          result: exports.apply(s.fn, args),
          stats: Json.of(`${s.fn.name}_${s.fn.hash.slice(0, 6)}(${argsStr})`)
        })
      })
    })
    .valueOf(api).then(function (rez) {
      return Promise.all([rez.stats.valueOf(api), rez.result.getHash(api)]).then(function ([stats, hash]) {
        fs.writeFileSync(cachePath, hash, 'utf8')
        debug(`${stats} => ${hash.slice(0, 6)}`)
        return hash
      })
    })
  }
}
