var transform = require('./transform.js');

function pipe(u, d){
  u.on('error', function(err){
    d.emit('error', err);
  });
  u.pipe(d);
  return d;
}

export class AStream {

  constructor(readableStreamFactory){
    this.readableStreamFactory = readableStreamFactory;
  }

  valueOf(){
    return this.readableStreamFactory();
  }

  writeTo(writable){
    var defer = Promise.defer();
    this.valueOf()
      .on('error', err => defer.reject(err))
      .pipe(writable)
      .on('error', err => defer.reject(err))
      .on('finish', () => setTimeout(() => defer.resolve(), 1000));
      // TODO: after finish index is still locked. wait process to exit
    return defer.promise;
  }

  pipe(stream){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      stream
    ));
  }

  transform(fn){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(fn)
    ));
  }

  map(fn){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
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
    ));
  }

  filter(fn){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function(x, next){
        if(fn(x)){
          this.push(x);
        }
        next();
      })
    ));
  }

  scan(fn, state){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function(x, next){
        state = fn(state, x);
        this.push(state);
        next();
      })
    ));
  }

  reduce(fn, state){
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function(x, next){
        state = fn(state, x);
        next();
      }, function(done){
        this.push(state);
        done();
      })
    ));
  }
  // groupBy(fn){
  //   var downStreams = {};
  //   return new AGroupedStream(
  //     this.stream.pipe(
  //       transform(function(x, next){
  //         var key = fn(x);
  //         var groupStream = downStreams[key];
  //         if(!groupStream) {
  //           groupStream = downStreams[key] = transform(function(x,n){ this.push(x); n(); });
  //           var aGroupStream = new AStream(groupStream);
  //           aGroupStream.key = key;
  //           this.push(aGroupStream);
  //         }
  //         groupStream.write(x, next);
  //       }, function(done){
  //         Object.keys(downStreams).forEach(key => downStreams[key].end());
  //         done();
  //       })
  //     )
  //   );
  // }
}

// export class AGroupedStream {
//   constructor(stream){
//     this.stream = stream;
//   }
//   flatten(fn){
//     var groupedStreamsCount = 0;
//     var upstreamDone;
//     var downStream = this.stream.pipe(
//       transform(function(aGroupStrem, next){
//         var gs = fn(aGroupStrem).valueOf();
//         var ds = this;
//         groupedStreamsCount++;
//         gs.on('data', function(data){
//           if(!ds.push(data)){
//             gs.pause();
//             gs.once('drain', gs.resume.bind(gs));
//           };
//         }).on('end', function(){
//           groupedStreamsCount--;
//           if(groupedStreamsCount === 0 && upstreamDone){
//             upstreamDone()
//           }
//         })
//         next();
//       }, function(done){
//         if(groupedStreamsCount === 0){
//           done();
//         } else {
//           upstreamDone = done;
//         }
//       })
//     );
//     return new AStream(downStream);
//   }
// }
