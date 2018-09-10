parser = require "./parser"
BottleneckError = require "./BottleneckError"
RedisConnection = require "./RedisConnection"
IORedisConnection = require "./IORedisConnection"

class RedisDatastore
  constructor: (@instance, @storeOptions, storeInstanceOptions) ->
    @originalId = @instance.id
    parser.load storeInstanceOptions, storeInstanceOptions, @
    @clients = {}

    @connection = if @_groupConnection then @_groupConnection
    else if @instance.datastore == "redis" then new RedisConnection { @clientOptions, @Promise, Events: @instance.Events }
    else if @instance.datastore == "ioredis" then new IORedisConnection { @clientOptions, @clusterNodes, @Promise, Events: @instance.Events }

    @ready = @connection.ready
    .then (@clients) => @connection.loadScripts()
    .then => @runScript "init", false, @prepareInitSettings @clearDatastore
    .then =>
      @connection.addLimiter @instance, (message) =>
        pos = message.indexOf(":")
        [type, data] = [message.slice(0, pos), message.slice(pos+1)]
        if type == "capacity"
          @instance._drainAll(if data.length > 0 then ~~data)
        else if type == "message"
          @instance.Events.trigger "message", [data]
    .then => @clients

  __publish__: (message) ->
    { client } = await @ready
    client.publish(@instance._channel(), "message:#{message.toString()}")

  __disconnect__: (flush) ->
    @connection.removeLimiter @instance
    if !@_groupConnection?
      @connection.disconnect flush

  runScript: (name, hasNow, args) ->
    await @ready unless name == "init"
    if hasNow then args[args.length - 1] = Date.now().toString()
    new @Promise (resolve, reject) =>
      @instance.Events.trigger "debug", ["Calling Redis script: #{name}.lua", args]
      arr = @connection.scriptArgs name, @originalId, args, (err, replies) ->
        if err? then return reject err
        return resolve replies
      @connection.scriptFn(name).apply {}, arr
    .catch (e) =>
      if e.message == "SETTINGS_KEY_NOT_FOUND"
        @runScript("init", false, @prepareInitSettings(false))
        .then => @runScript(name, hasNow, args)
      else @Promise.reject e

  prepareArray: (arr) -> (if x? then x.toString() else "") for x in arr

  prepareObject: (obj) ->
    arr = []
    for k, v of obj then arr.push k, (if v? then v.toString() else "")
    arr

  prepareInitSettings: (clear) ->
    args = @prepareObject Object.assign({}, @storeOptions, {
      id: @originalId,
      nextRequest: Date.now(),
      running: 0,
      done: 0,
      unblockTime: 0,
      version: @instance.version,
      groupTimeout: @timeout
    })
    args.unshift (if clear then 1 else 0), Date.now().toString(), @instance.version
    args

  convertBool: (b) -> !!b

  __updateSettings__: (options) ->
    await @runScript "update_settings", false, @prepareObject options
    parser.overwrite options, options, @storeOptions

  __running__: -> @runScript "running", true, [0]

  __done__: -> @runScript "done", true, [0]

  __groupCheck__: -> @convertBool await @runScript "group_check", false, []

  __incrementReservoir__: (incr) -> @runScript "increment_reservoir", true, [incr, 0]

  __currentReservoir__: -> @runScript "current_reservoir", false, []

  __check__: (weight) -> @convertBool await @runScript "check", true, @prepareArray [weight, 0]

  __register__: (index, weight, expiration) ->
    [success, wait, reservoir] = await @runScript "register", true, @prepareArray [index, weight, expiration, 0]
    return {
      success: @convertBool(success),
      wait,
      reservoir
    }

  __submit__: (queueLength, weight) ->
    try
      [reachedHWM, blocked, strategy] = await @runScript "submit", true, @prepareArray [queueLength, weight, 0]
      return {
        reachedHWM: @convertBool(reachedHWM),
        blocked: @convertBool(blocked),
        strategy
      }
    catch e
      if e.message.indexOf("OVERWEIGHT") == 0
        [overweight, weight, maxConcurrent] = e.message.split ":"
        throw new BottleneckError("Impossible to add a job having a weight of #{weight} to a limiter having a maxConcurrent setting of #{maxConcurrent}")
      else
        throw e

  __free__: (index, weight) ->
    running = await @runScript "free", true, @prepareArray [index, 0]
    return { running }

module.exports = RedisDatastore
