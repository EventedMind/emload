#!/usr/bin/env node
var cluster = require('cluster');
var argv = require('minimist')(process.argv.slice(2));
var args = argv._;

var Playbooks = require('../lib/playbooks.js');
var Master = require('../lib/master.js');
var Client = require('../lib/client.js');

var playbooks = new Playbooks(argv);

// read in the playbooks file for
// master and each client
if (!playbooks.readSync(args[0]))
  process.exit(1);

if (cluster.isMaster) {
  Master(playbooks, {
    clients: argv.c || 1
  }).run();
} else {
  Client(playbooks).run();
}
