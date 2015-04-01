#!/usr/bin/env iojs

var argv = require('yargs').demand(['key']).argv;

var multilevel = require('multilevel');
var net = require('net');
var db = multilevel.client();
var con = net.connect(3000);
con.pipe(db.createRpcStream()).pipe(con);

db.get(argv.key, function(err, page){
  if(err) {
    console.error(err);
  } else {
    console.log(page);
  }
  db.close();
});
