#!/usr/bin/env node
'use strict'
require('babel/register')({ extensions: ['.es6', '.es', '.jsx', '.js'] })

var path = require('path')
var fs = require('fs')
var argv = require('yargs').argv
var mygit = require('../lib/engine/mygit')
var Commit = require('../lib/commit').Commit
var scriptPath = path.resolve(process.cwd() + '/' + argv._[0])
var seedScript = fs.readFileSync(scriptPath, 'utf8')

mygit.getGitDir(function (err, dir) {
  if (err) throw err
  var git = mygit(dir)
  var batchCat = git.catFileBatch()
  git.cat = batchCat.cat

  git.revParse('HEAD')
    .then(function (sha) {
      return new Commit(sha).plant(seedScript).getSha(git)
    })
    .then(function (sha) {
      batchCat.end()
      console.log(sha)
    })
    .catch(function (err) {
      process.nextTick(function () {
        throw err
      })
    })
})
