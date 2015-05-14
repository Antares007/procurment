var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export class Tree {
  constructor(shaFn = (git) => Promise.resolve(emptyTreeSha)){
    this.isEmpty = true;
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    return this.promisedSha = this.shaFn(git); 
  }

  get(path, nullValue){
    return new Tree(async (git) => {
      var sha = await this.getSha(git);
      try{
        var target = await git.revParse(sha + ':' + path);
        return target;
      } catch(ex){
        if(ex.message.indexOf('does not exist in') >= 0){
          return await nullValue.getSha(git);
        }
        throw ex;
      }
    });
  }

  set(path, other){
    return new Tree(async (git) => {
      var thisTreeSha = await this.getSha(git);
      var otherTreeSha = await other.getSha(git);
      var entries = await git.lsTree(thisTreeSha);
      entries[path] = { mode: '040000', type: 'tree', sha: otherTreeSha };
      return await git.mktree(entries);
    });
  }

  diff(other){
    return new Patch(async (git) => {
      var oldTreeSha = await this.getSha(git);
      var newTreeSha = await other.getSha(git);
      return git.diffTree(oldTreeSha, newTreeSha);
    });
  }

  cd(fn){
    var self = this;
    return new Tree(async (git) => {
      var sha = await this.getSha(git);
      var entries = await git.lsTree(sha);

      Object.keys(entries)
        .forEach(function(key){
          var entry = entries[key];
          entries[key] = entry.type === 'tree' ? new Tree(entry.sha) : new Blob(entry.sha);
        });

      fn.call(entries, entries);

      entries = await Promise.all(Object.keys(entries).map(key => entries[key].getEntry(key)(git)));

      return await git.mktree(entries.reduce((t, x) => (t[x.name] = x, t), {}));
    });
  }
  
  getEntry(name){
    return git => this.getSha(git).then(function(sha){
      return { mode: '040000', type: 'tree', sha: sha, name: name };
    });
  }
}

class Blob {
  constructor(shaFn){
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    this.promisedSha = this.shaFn(git);
    return this.promisedSha; 
  }

  getEntry(name){
    return (git) => this.getSha(git).then(function(sha){
      return { mode: '100644', type: 'blob', sha: sha, name: name };
    });
  }
}

class Patch {
  constructor(promisedAStream){
    this.promisedAStream = promisedAStream;
  }
  filter(filter){
    return new Patch(git =>
      this.promisedAStream(git).then(function(astream){
        return astream.filter(filter);
      })
    );
  }
  map(mapFunction){
    return new Patch(async (git) => {
      var astream = await this.promisedAStream(git);
      return astream
        .transform(function(p, next){
          var { path, status, newSha, oldSha, mode } = p;
          if(newSha) { this.push({ path, status: 'A', sha: newSha, mode }); }
          if(oldSha) { this.push({ path, status: 'D', sha: oldSha, mode }); }
          next();
        })
        .map(async function(p){
          var ds = [];
          var emitedValues = [];
          var emiter = function (key, value) { emitedValues.push({ key, value }); };

          var buffer = await git.cat(p.sha);

          mapFunction.call({emit: emiter}, p.path, buffer);

          for(var i in emitedValues){
            var emited = emitedValues[i];
            var sha = await git.hashObject(new Buffer(JSON.stringify(emited.value), 'utf8'));
            ds.push({ path: emited.key + '/' + p.path, status: p.status, sha, mode: '100644' });
          }
          return ds;
        })
        .transform(function(values, next){
          var ds = this;
          values.forEach(function(v){
            var { path, status, sha, mode } = v;
            ds.push({ path, status, [status === 'A' ? 'newSha' : 'oldSha']: sha, mode })
          });
          next();
        });
    });
  }

  apply(tree){
    return new Tree(async (git) => {
      var patchsStream = await this.promisedAStream(git);
      var index = git.openIndex('testIndex2');
      var defer = Promise.defer();

      await index.readTree(await tree.getSha(git));
      var indexInfo = index.createUpdateIndexInfoStream()
        .on('error', err => defer.reject(err))
        .on('finish', () => setTimeout(() => defer.resolve(), 1000));
        // TODO: after finish index is still locked. wait process to exit
                  
      patchsStream
        .map(function(p){
          var { path, status, newSha, mode } = p;
          if(status === 'A'){
            return `${mode} ${newSha}\t${path}\n`
          } else {
            return `0 0000000000000000000000000000000000000000\t${path}\n`;
          }
        })
        .pipe(require('./logprogress.js')(10))
        .valueOf()
        .on('error', err => defer.reject(err))
        .pipe(indexInfo)

      await defer.promise;
      return await index.writeTree();
    });
  }
}
