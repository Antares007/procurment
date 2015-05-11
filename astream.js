var transform = require('./transform.js');

export class AStream {
  constructor(stream){
    this.stream = stream;
    this.ons = [];
    this.onces = [];
  }
  on(event, fn){
    this.ons.push({ event, fn });
    return this;
  }
  once(event, fn){
    this.onces.push({ event, fn });
    return this;
  }
  valueOf(){
    this.ons.forEach(x => this.stream.on(x.event, x.fn));
    this.onces.forEach(x => this.stream.once(x.event, x.fn));
    return this.stream;
  }
  transform(fn){
    this.stream = this.stream.pipe(transform(fn));
    return this;
  }
  map(fn){
    this.stream = this.stream.pipe(
      transform(function(x, next){
        var ds = this;
        var value = fn(x);
        if(value instanceof Promise){
          value.then(function(rez){
            ds.push(rez);
            next();
          }).catch(function(err){
            process.nextTick(function(){
              ds.emit('error', err);
            });
          });
        } else {
          this.push(value);
          next();
        }
      })
    );
    return this;
  }
  filter(fn){
    this.stream = this.stream.pipe(
      transform(function(x, next){
        if(fn(x)){
          this.push(x);
        }
        next();
      })
    );
    return this;
  }
  scan(fn, state){
    this.stream = this.stream.pipe(
      transform(function(x, next){
        state = fn(state, x);
        this.push(state);
        next();
      })
    );
    return this;
  }
  reduce(fn, state){
    this.stream = this.stream.pipe(
      transform(function(x, next){
        state = fn(state, x);
        next();
      }, function(done){
        this.push(state);
        done();
      })
    );
    return this;
  }
  groupBy(fn){
    var downStreams = {};
    return new AGroupedStream(
      this.stream.pipe(
        transform(function(x, next){
          var key = fn(x);
          var groupStream = downStreams[key];
          if(!groupStream) {
            groupStream = downStreams[key] = transform(function(x,n){ this.push(x); n(); });
            var aGroupStream = new AStream(groupStream);
            aGroupStream.key = key;
            this.push(aGroupStream);
          }
          groupStream.write(x, next);
        }, function(done){
          Object.keys(downStreams).forEach(key => downStreams[key].end());
          done();
        })
      )
    );
  }
}

export class AGroupedStream {
  constructor(stream){
    this.stream = stream;
  }
  flatten(fn){
    var groupedStreamsCount = 0;
    var upstreamDone;
    var downStream = this.stream.pipe(
      transform(function(aGroupStrem, next){
        var gs = fn(aGroupStrem).valueOf();
        var ds = this;
        groupedStreamsCount++;
        gs.on('data', function(data){
          if(!ds.push(data)){
            gs.pause();
            gs.once('drain', gs.resume.bind(gs));
          };
        }).on('end', function(){
          groupedStreamsCount--;
          if(groupedStreamsCount === 0 && upstreamDone){
            upstreamDone()
          }
        })
        next();
      }, function(done){
        if(groupedStreamsCount === 0){
          done();
        } else {
          upstreamDone = done;
        }
      })
    );
    return new AStream(downStream);
  }
}
