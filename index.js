
/*
push streams are the opposite of pull streams.
pull-streams have an active reader, and a passive readable.
push-streams have an active writer, and a passive writable.

Let's start with the writable. this is the simplest one.
just collect all input.
*/


function collect(cb) {
  var ary = []
  return {
    write: ary.push.bind(ary),
    paused: false,
    end: function (err) {
      this.ended = err || true
      cb(err, ary)
    }
  }
}

/*

it is the same as pull.collect(), (but much simpler!)
each time something is passed to it, it is added to an array.

next lets make something to write to it.
*/

function values (ary) {
  var i = 0
  return {
    resume: function () {
      //just loop until the sink pauses. when the sink unpauses
      while(!this.sink.paused && !this.ended)
        if(this.ended = i >= ary.length) this.sink.end()
        else                             this.sink.write(ary[i++])
    },
    sink: null,
    pipe: pipe
  }
}

/*

to pipe the source to the sink, attach them as a doublely linked list
and call resume on the source

pipe is the same every time, so define it once.
*/

function pipe(sink) {
  this.sink = sink
  sink.source = this
  if(!sink.paused) this.resume()
  return sink
}

values([1,2,3])
  .pipe(collect(function (err, ary) {
    console.log(ary) // => [1,2,3]
  }))

/*
  everything is sync, so far. but it's really simple.
*/

function map(fn) {
  return {
    write: function (data) {
      //we trust the source not to call us if we are paused
      //so we don't need to buffer this.
      this.sink.write(fn(data))
      this.paused = this.sink.paused //update our pause state if it changed
    },
    end: function (err) {
      this.ended = true
      this.sink.end(err)
    },
    //a map needs to start off paused
    paused: true,
    //the sink will call resume when it unpauses.
    resume: function () {
      if(!(this.paused = this.sink.paused))
        this.source.resume()
    },
    pipe: pipe,
    source: null, sink: null
  }

}

values([1,2,3])
  .pipe(map(function (a) { return a * 2 }))
  .pipe(collect(function (err, ary) {
    console.log(ary) // => [2, 4, 6]
  }))

/*
  well, that was easy. but arn't streams meant to be good for async?
  lets make an async map. mostly it's the same as the sync map.
  we just make it pause while it's doing the async bit.
*/

function asyncMap (asyncFn) {
  var _map = map()
  _map.write = function (data) {
    //we trust the source not to call us if we are paused
    //so we don't need to buffer this.
    var self = this
    self.paused = true
    asyncFn(data, function (err, mapped_data) {
      self.paused = false
      if(err) self.sink.end(this.ended = err)
      else {
        self.sink.write(mapped_data)
        self.resume()
      }
    })
  }
  return _map

}

values([1,2,3])
  .pipe(asyncMap(function (a, cb) {
      setTimeout(function () {
        cb(null, a * 10)
      }, 100)
  }))
  .pipe(collect(function (err, ary) {
    console.log(ary) // => (after a short pause) [10, 20, 30]
  }))

