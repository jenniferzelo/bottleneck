lua = require "./lua.json"

headers =
  refs: lua["refs.lua"]
  validate_keys: lua["validate_keys.lua"]
  refresh_expiration: lua["refresh_expiration.lua"]
  process_tick: lua["process_tick.lua"]
  conditions_check: lua["conditions_check.lua"]
  get_time: lua["get_time.lua"]

defaultKeys = (id) -> [
  ###
  HASH
  ###
  "b_#{id}_settings"

  ###
  HASH
  job index -> weight
  ###
  "b_#{id}_job_weights"

  ###
  ZSET
  job index -> expiration
  ###
  "b_#{id}_job_expirations"

  ###
  HASH
  job index -> client
  ###
  "b_#{id}_job_clients"

  ###
  ZSET
  client -> sum running
  ###
  "b_#{id}_client_running"

  ###
  HASH
  client -> num queued
  ###
  "b_#{id}_client_num_queued"
]

templates =
  init:
    keys: defaultKeys
    headers: ["process_tick"]
    refresh_expiration: true
    code: lua["init.lua"]
  group_check:
    keys: (id) -> ["b_#{id}_settings"]
    headers: []
    refresh_expiration: false
    code: lua["group_check.lua"]
  register_client:
    keys: defaultKeys
    headers: ["validate_keys"]
    refresh_expiration: false
    code: lua["register_client.lua"]
  heartbeat:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: false
    code: lua["heartbeat.lua"]
  update_settings:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: true
    code: lua["update_settings.lua"]
  running:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: false
    code: lua["running.lua"]
  done:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: false
    code: lua["done.lua"]
  check:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick", "conditions_check"]
    refresh_expiration: false
    code: lua["check.lua"]
  submit:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick", "conditions_check"]
    refresh_expiration: true
    code: lua["submit.lua"]
  register:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick", "conditions_check"]
    refresh_expiration: true
    code: lua["register.lua"]
  free:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: false
    code: lua["free.lua"]
  current_reservoir:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: false
    code: lua["current_reservoir.lua"]
  increment_reservoir:
    keys: defaultKeys
    headers: ["validate_keys", "process_tick"]
    refresh_expiration: true
    code: lua["increment_reservoir.lua"]

exports.names = Object.keys templates

exports.keys = (name, id) ->
  templates[name].keys id

exports.payload = (name) ->
  template = templates[name]
  Array::concat(
    headers.refs,
    template.headers.map((h) -> headers[h]),
    (if template.refresh_expiration then headers.refresh_expiration else ""),
    template.code
  )
  .join("\n")
