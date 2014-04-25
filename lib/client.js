Client = function (playbooks) {
  if (!(this instanceof Client))
    return new Client(playbooks);
  this._playbooks = playbooks;
};

Client.prototype = {
  constructor: Client,

  runPlaybook: function (name) {
    var playbook = this._playbooks.get(name);
    playbook.run();
  },

  run: function () {
    var self = this;
    process.on('message', function (msg) {
      switch (msg.msg) {
        case 'playbook':
          self.runPlaybook(msg.name);
          break;
        default:
          console.error('Message not understood: ' + JSON.stringify(msg));
          return;
      }
    });
  },

  stop: function () {
    process.exit();
  },
};

module.exports = Client;
