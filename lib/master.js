var cluster = require('cluster');
var _ = require('underscore');

Master = function (playbooks, opts) {
  if (!(this instanceof Master))
    return new Master(playbooks, opts);

  this.options = opts || {};
  this._playbooks = playbooks;
};

Master.prototype = {
  constructor: Master,

  run: function () {
    var playbooks = this._playbooks;
    var numClients = this.options.clients || 1;

    for (var i = 0; i < numClients; i++) {
      cluster.fork();
    }

    cluster.on('exit', function (worker, code, signal) {
      console.log('client ' + worker.process.pid + ' died');
    });

    workerIds = Object.keys(cluster.workers);

    console.log(workerIds.length + ' clients are online.');

    var playbookCounts = {};

    var incPlaybookCount = function (name) {
      playbookCounts[name] = playbookCounts[name] || 0;
      playbookCounts[name]++;
    };

    workerIds.forEach(function (id) {
      var playbook = playbooks.chooseRandom();
      cluster.workers[id].send({msg: 'playbook', name: playbook.name});
      incPlaybookCount(playbook.name);
    });

    _.each(playbookCounts, function (count, name) {
      console.log(name + ': ' + count + ' clients running this playbook.');
    });
  },

  stop: function () {
    process.exit();
  }
};

module.exports = Master;
