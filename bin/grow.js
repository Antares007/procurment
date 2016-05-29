#!/usr/bin/env node
'use strict'
const gitDir = process.argv[2]
const seedHash = process.argv[3]
const rootHash = process.argv[4]
const expand = parseInt(process.argv[5], 10)

const api = require('../src/repo')(gitDir)
const gitrequire = require('../src/gitrequire')

if (expand > 0) {
  api.grow = function grow (seedHash, rootHash) {
    return new Promise(function (resolve, reject) {
      const exec = require('child_process').exec
      exec(`grow ${gitDir} ${seedHash} ${rootHash} ${expand - 1}`, (error, stdout, stderr) => {
        if (error) return reject(error)
        resolve(stdout.trim())
      })
    })
  }
} else {
  api.grow = function (seedHash, rootHash) {
    var exports = gitrequire(api, seedHash)
    return exports(rootHash)(api)
  }
}

var exports = gitrequire(api, seedHash)
exports(rootHash)(api)
  .then((v) => console.log(v))
  .catch((err) => process.nextTick(function () { throw err }))
