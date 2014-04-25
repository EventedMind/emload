var DDPClient = require('ddp');
var vm = require('vm');
var path = require('path');
var fs = require('fs');
var MongoDb = require('mongodb');
var Fiber = require('fibers');
var _ = require('underscore');
var User = require('./user.js');

Playbook = function (name, handler, options) {
  var self = this;

  this.options = options || {};
  this._timers = [];
  this._users = [];
  this.name = name;
  this.handler = handler;
  this.ddp = new DDPClient({
    host: 'localhost',
    port: 3000
  });

  if (this.options.mongoUrl) {
    var mongoOptions = {db: {safe: true}};

    MongoDb.connect(this.options.mongoUrl, mongoOptions, function (err, db) {
      if (err) {
        console.error('Error connecting to MongoDb: ' + err.toString())
        console.error(err.stack);
        process.exit(1);
      }

      self._db = db;
    });
  }

  process.on('exit', function () {
    self.stop();
  });
};

Playbook.prototype = {
  constructor: Playbook,

  call: function () {
    return this.ddp.call.apply(this.ddp, arguments);
  },

  subscribe: function () {
    return this.ddp.subscribe.apply(this.ddp, arguments);
  },
  
  unsubscribe: function () {
    return this.ddp.unsubscribe.apply(this.ddp, arguments);
  },

  createUser: function (props) {
    var user = User.create(this, props);
    this._users.push(user);
    return user;
  },

  loginWithToken: function (token, cb) {
    return this.ddp.loginWithToken(token, cb);
  },

  logout: function () {
    return this.ddp.call('logout');
  },

  setRandomInterval: function (fn, min, max) {
    var random = function (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    var id = setInterval(fn, random(min, max) * 1000);
    this._timers.push({
      stop: function () {
        clearInterval(id);
      }
    });
  },

  run: function () {
    var self = this;
    var ddp = this.ddp;

    ddp.connect(function (err) {
      if (err) {
        console.log('DDP connection error: ' + JSON.stringify(err));
        return;
      }

      try {
        Fiber(function () {
          self.handler.call(self);
        }).run();
      } catch (e) {
        console.error("Error running playbook: " + e.message);
        console.error(e.stack);
        self.stop();
        process.exit(1);
      }
    });

    ddp.on('socket-error', function (err) {
      console.error('Error connecting to DDP server: ', err.message);
      self.stop();
      process.exit(1);
    });
  },

  stop: function () {
    try {
    this.ddp.close();
    _.each(this._timers, function (t) { t.stop(); });
    _.each(this._users, function (u) { u.destroy(); });
    } catch (e) {}
  }
};

Playbooks = function (opts) {
  this.options = opts || {};
  this._playbooks = [];
};

Playbooks.prototype = {
  constructor: Playbooks,

  count: function () {
    return this._playbooks.length;
  },

  get: function (name) {
    return _.findWhere(this._playbooks, {name: name});
  },

  playbook: function (name, handler) {
    this._playbooks.push(new Playbook(name, handler, this.options));
  },

  chooseRandom: function () {
    var idx = Math.floor(Math.random() * this._playbooks.length);
    return this._playbooks[idx];
  },

  readSync: function (filepath) {
    if (!_.isString(filepath))
      throw new Error("Missing filepath parameter.");

    var code = fs.readFileSync(filepath, 'utf8');
    var wrapped = "(function(playbook){" + code + "\n})";
    var func = require('vm').runInThisContext(wrapped);

    try {
      func.call(global, _.bind(this.playbook, this));
      return true;
    } catch (e) {
      console.log("Error reading playbooks file: " + e.message);
      return false;
    }
  }
};

module.exports = Playbooks;
