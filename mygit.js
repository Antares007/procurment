var stream = require('stream');
var split = require('split');
var transform = require('./transform.js');
var assert = require('assert');
var {AStream} = require('./astream.js');

module.exports = function gitStreamer(gitDir) {
  var gitCmdBase = `git --git-dir=${gitDir} `;

  var git = function (cmd, mappers, options, cb) {
    if(typeof options === 'function') {
      cb = options;
      options = { encoding: 'utf8', timeout: 0, maxBuffer: 100*1024, killSignal: 'SIGTERM' };
    }
    return exec(gitCmdBase + cmd, options, function(err, stdout) {
      if(err) {
        cb(err);
      } else {
        cb(null, mappers.reduce((m, fn) => fn(m), stdout));
      }
    });
  };
  var spawn = function(args){
    var spawn = require('child_process').spawn;
    var args2 = [`--git-dir=${gitDir}`].concat(args);
    return spawn('git', args2);
  }

  var mappers = {
    parseDiffLine: function(x){
      var [rest, path] = x.split('\t');
      var [_, mode, oldSha, newSha, status] = rest.split(' ');
      if(newSha * 1 === 0) return { path, status, oldSha, mode };
      if(oldSha * 1 === 0) return { path, status, newSha, mode };
      return { path, status, newSha, oldSha, mode };
    },
    parseDiffOutput: function(stdout){
      return stdout.split('\n')
      .filter(x => x.length > 7)
      .map(this.parseDiffLine)
    },
    trimOutput: (stdout) => stdout.trim()
  };
  return {
    exec: git,
    spawn: spawn,
    mappers: mappers,
    diffTree: function(tree1, tree2){
      var child = spawn(['diff-tree', '--raw', '-r', tree1, tree2]);
      return new AStream(child.stdout.pipe(split()))
        .transform(function(x, n){
          if(x){
            this.push(mappers.parseDiffLine(x.toString()));
          }
          n();
        });
    },
    getBlob: function(sha, cb) {
      var self = this;
      git(
        'cat-file -p ' + sha,
        [mappers.trimOutput, x => new Buffer(x, 'binary')],
        { encoding: 'binary', timeout: 0, maxBuffer: 1000*1024, killSignal: 'SIGTERM' },
        cb
      );
    },
    hashObject: function(buffer, cb) {
      git(
        'hash-object --stdin -t blob -w',
        [git.mappers.trimOutput],
        cb
      ).stdin.end(buffer);
    },
    makeTree: function(entries, cb) {
      var data = entries.map(x => (
        (x.type === 'tree' ? '040000 tree' : '100644 blob') + ' ' + x.sha + '\t' + x.name
      )).join('\n');
      git(
        'mktree --missing',
        [git.mappers.trimOutput],
        cb
      ).stdin.end(data, 'utf8');
    },
    catFileBatch: function(){
      var cbs = [];
      var child = spawn(['cat-file', '--batch']);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe((function(){
        var StringDecoder = require('string_decoder').StringDecoder;
        var parser = makeHeadParser();

        return transform(function(chunk, next){
          parser.call(this, chunk);
          next();
        });

        function makeHeadParser(){
          var decoder = new StringDecoder('utf8');
          var head = '';

          return function(chunk){
            var indexOfLF = chunk.indexOf('\n');
            if(indexOfLF !== -1) {
              head += decoder.write(chunk.slice(0, indexOfLF));
              parser = makeContentParser.call(this, head);
              var rest = chunk.slice(indexOfLF + 1);
              parser.call(this, rest);
            } else {
              head += decoder.write(chunk);
            }
          }
        }

        function makeContentParser(headStr){
          var segments = headStr.trim().split(' ');
          if(segments[1] === 'missing') {
            this.push({header: segments})
            return makeHeadParser();
          }
          var length = parseInt(segments[2], 10);
          var curLength = 0;
          var contents = [];

          return function(chunk){
            if(chunk.length > length - curLength){
              contents.push(chunk.slice(0, length - curLength));
              this.push({header: segments, content: Buffer.concat(contents, length) });
              parser = makeHeadParser();
              parser.call(this, chunk.slice(length - curLength + 1));
            } else {
              contents.push(chunk);
              curLength += chunk.length;
            }
          }
        }

      })())
      .on('data', function(data){
        var cb = cbs.shift();
        assert(cb.sha === data.header[0]);
        if(data.header[1] === 'missing'){
          cb.cb(new Error('missing'));
        } else {
          cb.cb(null, data.content);
        }
      });

      return {
        cat: function(sha, cb){
          cbs.push({ sha, cb });
          child.stdin.write(sha + '\n');
        },
        end: function(){
          child.stdin.end();
        }
      };
    }
  };
}

function exec(str, opt, cb) {
  if(typeof opt === 'function') {
    cb = opt;
    opt = { encoding: 'utf8', timeout: 0, maxBuffer: 200*1024, killSignal: 'SIGTERM' };
  }
  return require('child_process').exec(
    str,
    opt,
    function (error, stdout, stderr) {
      if (error !== null || stderr) {
        cb({ error: error, stderr: stderr });
      } else {
        cb(null, stdout);
      }
    }
  );
};