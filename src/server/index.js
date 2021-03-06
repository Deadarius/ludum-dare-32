'use strict';

var CONSTANTS = require('../constants.json');
var Mixpanel = require('mixpanel');
var mixpanel = Mixpanel.init('9efbd3e13a579f341a23369b7be12d05');
var uuid = require('uuid');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var socketIo = require('socket.io')(server);
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGO;

var deathMessage = require('./death-message');
var commandsCache = [];
var connections = {};
var notifications = [];

function addNotification(key, text){
  notifications.push({
    key: key,
    text: text
  });
}

var state = {
	units: {},
  bullets: {},
};

socketIo.on('connection', function (socket) {
  mixpanel.track('Connection', {distinct_id: socket.id});
	console.log('User connected');
  var connection = {
    socket: socket,
    lastHeartBeat: new Date()
  };
  connections[socket.id] = connection;

  socket.emit('state', state);
  socket.emit('commands', commandsCache);

  socket.on('login', function(username){
    mixpanel.track('Login', {distinct_id: this.id});
    console.log('LOGIN: %s[%s]', username, this.id);
    addNotification('login', username + ' has just joined the party');
    state.units[this.id] = {
      id: this.id,
      position:{
        x: Math.floor(Math.random() * (CONSTANTS.MAPSIZE / 2) + CONSTANTS.MAPSIZE/3),
        y: Math.floor(Math.random() * (CONSTANTS.MAPSIZE / 2) + CONSTANTS.MAPSIZE/3)
      },
      direction: 'n',
      username: username,
      dead: false,
    };
    connection.username = username;
    connection.kills = 0;
    connection.loggedInTime = new Date();

    socketIo.emit('state', state);
  });

  socket.on('heart-beat', function(){
    var connection = connections[this.id];
    if(connection){
      connection.lastHeartBeat = new Date();
    }
  });

  socket.on('command', function (command) {
    var newCommand = {id: this.id, command: command};
    commandsCache.push(newCommand);
    socketIo.emit('new-command', newCommand);
    console.log('%s: %s', this.id, command);
  });
});

socketIo.on('disconnect', function(){
  removeConnection(this.id);
});

function removeConnection(id){
  var connection = connections[id];
  if(!connection){
    return;
  }
  connection.socket.disconnect();
  socketIo.emit('disconnect', connection.username);
  delete connections[id];
  delete state.units[id];
  console.log('user disconnected');
}

var rotateLeftDict = {
  'n': 'w',
  'w': 's',
  's': 'e',
  'e': 'n'
};

var rotateRightDict = {
  'n': 'e',
  'e': 's',
  's': 'w',
  'w': 'n'
};

var rotateUturnDict = {
  'n': 's',
  'e': 'w',
  's': 'n',
  'w': 'e'
};

var moveDict = {
  'n': function(unit){unit.position.y++;},
  'e': function(unit){unit.position.x++;},
  's': function(unit){unit.position.y--;},
  'w': function(unit){unit.position.x--;},
};

var strafeLeftDict = {
  'n': function(unit){unit.position.x--;},
  'e': function(unit){unit.position.y++;},
  's': function(unit){unit.position.x++;},
  'w': function(unit){unit.position.y--;},
};

var strafeRightDict = {
  'n': function(unit){unit.position.x++;},
  'e': function(unit){unit.position.y--;},
  's': function(unit){unit.position.x--;},
  'w': function(unit){unit.position.y++;},
};

var reverseDict = {
  'n': function(unit){unit.position.y--;},
  'e': function(unit){unit.position.x--;},
  's': function(unit){unit.position.y++;},
  'w': function(unit){unit.position.x++;},
};

function timeOutConnections(){
  var now = new Date();
  var changed = false;

  Object.keys(connections).forEach(function(id){
    var connection = connections[id];
    var noHeartBeatDuration = now - connection.lastHeartBeat;

    if(noHeartBeatDuration > 15000){
      console.log('User timed out');
      removeConnection(connection.socket.id);
      changed = true;
    }
  });

  return changed;
}

function executeCommands(){
  if(commandsCache.length === 0){
    return false;
  }

  commandsCache.forEach(function(command){
    var connection = connections[command.id];
    if(command.command === 'submit'){
      if(connection){
        MongoClient.connect(url, function(err, db) {
          var leaderboard = db.collection('leaderboard');
          leaderboard.insert({name:connection.username, kills: connection.kills}, function(err) {
            if(err){
              console.error(err);
            }
            db.close();
          });
        });
      }
      return;
    }
    else if(command.command.indexOf('subscribe') > -1){
      var email = command.command.split('subscribe')[1].trim();
      MongoClient.connect(url, function(err, db) {
        var subcribers = db.collection('subcribers');
        subcribers.insert({email:email}, function(err) {
          if(err){
            console.error(err);
          }
          db.close();
        });
      });
      return;
    }
    else if(command.command.indexOf('say') > -1){
      var text = command.command.split('say')[1].trim();
      if(connection){
        addNotification('chat', connection.username + ': ' + text);
      }
      return;
    }

    var unit = state.units[command.id];
    if(unit){
      switch(command.command){
        case 'move':
          moveDict[unit.direction](unit);
          break;
        case 'left':
          unit.direction = rotateLeftDict[unit.direction];
          break;
        case 'right':
          unit.direction = rotateRightDict[unit.direction];
          break;
        case 'uturn':
          unit.direction = rotateUturnDict[unit.direction];
          break;
        case 'reverse':
          reverseDict[unit.direction](unit);
          break;
        case 'strafe-left':
          strafeLeftDict[unit.direction](unit);
          break;
        case 'strafe-right':
          strafeRightDict[unit.direction](unit);
          break;
        case 'shoot':
          var newId = uuid.v4();
          state.bullets[newId] = {
            id: newId,
            position: _.clone(unit.position),
            direction: _.clone(unit.direction),
            shotBy: command.id
          };
          break;
      }

      if(unit.position.x < 0){
        unit.position.x = 0;
      } else if(unit.position.x > CONSTANTS.MAPSIZE){
        unit.position.x = CONSTANTS.MAPSIZE;
      }

      if(unit.position.y < 0){
        unit.position.y = 0;
      } else if(unit.position.y > CONSTANTS.MAPSIZE){
        unit.position.y = CONSTANTS.MAPSIZE;
      }

    }
  });

  commandsCache = [];
  return true;
}

function destroyBullet(id){
  delete state.bullets[id];
  socketIo.emit('destroy-bullet', id);
}

function updateBullets(){
  if(state.bullets.length === 0){
    return false;
  }

  Object.keys(state.bullets).forEach(function(bulletId){
    var bullet = state.bullets[bulletId];
    moveDict[bullet.direction](bullet);
    if(bullet.position.x > CONSTANTS.MAPSIZE || bullet.position.y > CONSTANTS.MAPSIZE ||
      bullet.position.x < 0 || bullet.position.y < 0){
        destroyBullet(bulletId);
    } else {
      Object.keys(state.units).forEach(function(id){
        var unit = state.units[id];
        if(unit.position.x === bullet.position.x &&
          unit.position.y === bullet.position.y){
          destroyBullet(bulletId);
          delete state.units[id];
          var killer = connections[bullet.shotBy];
          if(killer){
            killer.kills++;
          }
          addNotification('dead', deathMessage(killer.username, unit.username));
          var killed = connections[unit.id];
          var timeAlive = new Date() - killed.loggedInTime;
          mixpanel.track('Died', { distinct_id: unit.id, kills: killed.kills, timeAlive: timeAlive});

          socketIo.emit('dead', {
            died: unit.username,
            killer: killer.username
          });
        }
      });
    }
  });
  return true;
}

setInterval(function(){
  if(commandsCache.length > 0){
    socketIo.emit('commands', commandsCache);
  }
  var changed = false;

  changed = timeOutConnections();
  changed = executeCommands() || changed;
  changed = updateBullets() || changed;

  if(changed){
    socketIo.emit('state', state);
  }

  if(notifications.length > 0){
    socketIo.emit('notifications', notifications);
    notifications = [];
  }
}, 200);

setInterval(function(){
  socketIo.emit('alive');
}, 5000);

app.use('/leaderboard', function(req, res){
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  mixpanel.track('Leaderboard request', { distinct_id: ip });
  MongoClient.connect(url, function(err, db) {
    var leaderboard = db.collection('leaderboard');
    leaderboard.find({kills:{$gt: 0} })
      .sort( { kills: -1 } )
      .limit(10)
      .toArray(function(err, docs) {
        if(err){
          console.error(err);
        }
        db.close();
        res.send(docs);
      });
  });
});
app.use('/', express.static(path.join(__dirname, '../../dist')));

server.listen(process.env.PORT || 3000);

