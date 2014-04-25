var MongoDb = require('mongodb');
var Future = require('fibers/future');
var crypto = require('crypto');
var _ = require('underscore');

var hashLoginToken = function (loginToken) {
  var hash = crypto.createHash('sha256');
  hash.update(loginToken);
  return hash.digest('base64');
};

/*
 * stampedToken: {
 *  when: new Date,
 *  token: 'abc'
 * }
 */
var hashStampedToken = function (stampedToken) {
  return _.extend(_.omit(stampedToken, 'token'), {
    hashedToken: hashLoginToken(stampedToken.token)
  });
};

var generateStampedLoginToken = function () {
  return {token: MongoDb.ObjectID().toString(), when: (new Date)};
};

User = function (playbook, props) {
  this._playbook = playbook;
  this._props = props;
  this._db = playbook._db;
};

User.prototype = {
  constructor: User,

  withDb: function (cb) {
    if (!this._db)
      throw new Error("No database connection.");
    cb && cb(this._db);
  },

  isNew: function () {
    return !this._id;
  },
  
  create: function () {
    var self = this;
    var future = new Future;

    if (!self.isNew()) {
      return;
    }

    this.withDb(function (db) {
      var id = self._id = MongoDb.ObjectID();
      var token = self.stampedLoginToken = generateStampedLoginToken();
      db.collection('users').insert({
        _id: id,
        services: {
          resume: {
            loginTokens: [hashStampedToken(token)]
          }
        }
      }, function (err) {
        if (err)
          future.throw(err);
        else
          future.return();
      });
    });

    return future.wait();
  },

  login: function () {
    var future = new Future;
    return this._playbook.loginWithToken(this.stampedLoginToken.token, function (err) {
      if (err)
        future.throw(err)
      else
        future.return();
    });
    return future.wait();
  },

  logout: function () {
    return this._playbook.logout();
  },

  get: function (prop) {
  },

  destroy: function () {
    var self = this;
    var future = new Future;
    this.withDb(function (db) {
      db.collection('users').remove({_id: self._id}, function (err) {
        if (err)
          future.throw(err);
        else
          future.return();
      });
    });
    return future.wait();
  }
};

User.create = function (playbook, props) {
  var user = new User(playbook, props);
  user.create();
  return user;
};

module.exports = User;
