lua = require "./lua.json"

libraries =
  get_time: lua["get_time.lua"]
  refresh_running: lua["refresh_running.lua"]
  conditions_check: lua["conditions_check.lua"]
  refresh_expiration: lua["refresh_expiration.lua"]
  validate_keys: lua["validate_keys.lua"]

templates =
  init:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["refresh_expiration"]
    code: lua["init.lua"]
  update_settings:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_expiration"]
    code: lua["update_settings.lua"]
  running:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running"]
    code: lua["running.lua"]
  done:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running"]
    code: lua["done.lua"]
  group_check:
    keys: (id) -> ["b_#{id}_settings"]
    libs: []
    code: lua["group_check.lua"]
  check:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running", "conditions_check"]
    code: lua["check.lua"]
  submit:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running", "conditions_check", "refresh_expiration"]
    code: lua["submit.lua"]
  register:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running", "conditions_check", "refresh_expiration"]
    code: lua["register.lua"]
  free:
    keys: (id) -> ["b_#{id}_settings", "b_#{id}_running", "b_#{id}_executing"]
    libs: ["validate_keys", "refresh_running"]
    code: lua["free.lua"]
  current_reservoir:
    keys: (id) -> ["b_#{id}_settings"]
    libs: ["validate_keys"]
    code: lua["current_reservoir.lua"]
  increment_reservoir:
    keys: (id) -> ["b_#{id}_settings"]
    libs: ["validate_keys"]
    code: lua["increment_reservoir.lua"]

exports.names = Object.keys templates

exports.keys = (name, id) ->
  templates[name].keys id

exports.payload = (name) ->
  templates[name].libs.map (lib) -> libraries[lib]
  .join("\n") + templates[name].code
