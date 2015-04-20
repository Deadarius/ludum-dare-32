'use strict';

var mixpanel = require('./mixpanel')(document, window);

var THREE = require('three');
var socket = require('socket.io-client');
var Unit = require('./unit');
var audio = require('./audio');
var CONSTANTS = require('../constants.json');
var _ = require('lodash');

var minimist = require('minimist');

var scene = new THREE.Scene();

 var backMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
});
var mapSizeInWorldCoords = CONSTANTS.MAPSIZE * CONSTANTS.STEP;
var halfMapSizeInWorldCoords = mapSizeInWorldCoords / 2;
var backGeometry = new THREE.PlaneGeometry(mapSizeInWorldCoords, mapSizeInWorldCoords, CONSTANTS.MAPSIZE, CONSTANTS.MAPSIZE);
var backMesh = new THREE.Mesh(backGeometry, backMaterial);
backMesh.position.set(halfMapSizeInWorldCoords, halfMapSizeInWorldCoords, 0);
scene.add(backMesh);

var viewport = document.getElementById('viewport');

var camera = new THREE.PerspectiveCamera( CONSTANTS.CAMERA_ANGLE, viewport.clientWidth/viewport.clientHeight, 0.1, 1000000 );
var renderer = new THREE.WebGLRenderer();
viewport.appendChild(renderer.domElement);

function setRendererSize(){
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  camera.aspect = viewport.clientWidth/viewport.clientHeight;
  camera.updateProjectionMatrix();
}

setRendererSize();
window.addEventListener('resize', setRendererSize, false);

var unitTexture;
unitTexture = THREE.ImageUtils.loadTexture('assets/unit.png');
unitTexture.minFilter = THREE.NearestFilter;
unitTexture.magFilter = THREE.NearestFilter;

var unitMaterial = new THREE.MeshBasicMaterial( { map: unitTexture, color: 0xff0000, transparent: true } );
var playerUnitMaterial = new THREE.MeshBasicMaterial( { map: unitTexture, color: 0xffffff, transparent: true } );

var bulletTexture;
bulletTexture = THREE.ImageUtils.loadTexture('assets/bullet.png');
bulletTexture.minFilter = THREE.NearestFilter;
bulletTexture.magFilter = THREE.NearestFilter;

var bulletMaterial = new THREE.MeshBasicMaterial( { map: bulletTexture, color: 0xffff00, transparent: true } );
camera.position.set(halfMapSizeInWorldCoords, halfMapSizeInWorldCoords, CONSTANTS.CAMERA_INIT_ALT);
var socketIo = socket();
var username;
var currentPlayer;
var kills = 0;
var loginTime;

setInterval(function(){
  socketIo.emit('heart-beat');
}, 5000);

var players = {};
var bullets = {};
var logger = document.getElementById('log');

function addLog(text){
  var newElement = document.createElement('div');
  newElement.innerHTML = text;
  logger.appendChild(newElement);
  logger.scrollTop = logger.scrollHeight;
  return newElement;
}

function addNotification(text){
  addLog(text).className = 'notification';
}

function addWarning(text){
  addLog(text).className = 'warning';
}

function addDanger(text){
  addLog(text).className = 'danger';
}

socketIo.on('dead', function(data){
  if(data.died === username){
    addDanger('You\'re killed by ' + data.killer);
    addWarning('Your score: ' + kills);
    addWarning('Type \'submit\' to add your result to leaderboard');
    addWarning('Type \'subscribe &lt;email&gt;\' to subscribe for updates');
  }
  else if (data.killer === username) {
    kills++;
    addWarning('You killed ' + data.died);
  }

  players[data.died].die();
  delete players[data.died];
});

socketIo.on('commands', function(commands){
  if(_.some(commands, {command: 'shoot'})){
    audio.shoot();
  }
});

socketIo.on('disconnect', function(username){
  players[username].die();
  delete players[username];
  addWarning(username + ' disconnected');
});

socketIo.on('destroy-bullet', function(id){
  bullets[id].die();
  delete bullets[id];
});

socketIo.on('notifications', function(notifications){
  if(_.some(notifications, {key: 'login'})){
    audio.spawn();
  }

  if(_.some(notifications, {key: 'dead'})){
    audio.die();
  }

  _.each(notifications, function(notification){
    addNotification(notification.text);
  });
});

socketIo.on('state', function(state){
  _.values(state.units)
    .forEach(function(unit){
      var player = players[unit.username];
      if(!player){
        if(unit.username === username){
          player = currentPlayer = players[unit.username] = new Unit(scene, playerUnitMaterial);
        } else {
          player = players[unit.username] = new Unit(scene, unitMaterial);
        }
        player.username = unit.username;
      }
      if(player.position.x !== unit.position.x || player.position.y !== unit.position.y){
        player.position = unit.position;
      }

      if(player.direction !== unit.direction){
        player.direction = unit.direction;
      }
    });

  _.values(state.bullets).forEach(function(bulletServer){
    var bullet = bullets[bulletServer.id];
    if(!bullet){
      bullet = bullets[bulletServer.id] = new Unit(scene, bulletMaterial);
    }

    if(bullet.position.x !== bulletServer.position.x || bullet.position.y !== bulletServer.position.y){
      bullet.position = bulletServer.position;
    }

    if(bullet.direction !== bulletServer.direction){
      bullet.direction = bulletServer.direction;
    }
  });
});

var commandInput = document.getElementById('command');
commandInput.focus();
commandInput.onkeyup = checkKey;

function checkKey(e) {
  var code = e.which || e.keyCode;

  if (+code !== 13) {
    return;
  }
  var commandInputValue = commandInput.value;
  var toTrack = commandInputValue;
  //prevent tracking usernames
  if(toTrack.indexOf('login') !== -1){
    toTrack = 'login';
  }

  addLog('$ ' + commandInputValue);
  commandInput.value = '';

  var args = minimist(commandInputValue.split(' '));
  var cmd = args._[0];
  if(cmd === 'login'){
    username = args._[1];
    if(!username){
      addDanger('ERROR: no username provided');
      return;
    }
    else if(players[username]){
      addDanger('ERROR: player with specified username already in game');
      return;
    }
    kills = 0;
    socketIo.emit('login', username);
    loginTime = new Date();
  }
  else if(cmd === 'help'){
    addLog('login &lt;username&gt;');
    addLog('move');
    addLog('reverse');
    addLog('left');
    addLog('right');
    addLog('strafe-left');
    addLog('strafe-right');
    addLog('uturn');
    addLog('shoot');
    addLog('say');
    addLog('stats');
    addLog('submit');
    addLog('subscribe &lt;email&gt;');
    addLog('best');
    addLog('about');
    addLog('=========================');
    addLog('This is multiplayer game');
    addLog('You control your unit via command line');
    addLog('Invite your friends to join you');
    addLog('Login to start');
  }
  else if(cmd === 'about'){
    addLog('CMDer v1.0.0');
    addLog('Ludum Dare #32 entry');
    addLog('Made by @deadarius');
  }
  else if(cmd === 'stats'){
    addLog('username: ' + username);
    addLog('kills: ' + kills);
  }
  else if(cmd === 'best'){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function(){
      if (xmlHttp.readyState === 4 && xmlHttp.status === 200){
        addLog('=======LEADERBOARD=======');
        var data = JSON.parse(xmlHttp.responseText);
        _.each(data, function(leader){
          addLog(leader.name + ': ' + leader.kills);
        });
      }
    };
    xmlHttp.open('GET', '/leaderboard', true);
    xmlHttp.send();
  }
  else{
    socketIo.emit('command', commandInputValue);
  }
}
audio.music();

var render = function () {
  requestAnimationFrame( render );
  _.each(players, function(player){
    player.animate();
  });
  _.each(bullets, function(bullet){
    bullet.animate();
  });
  if(currentPlayer){
    camera.lookAt(currentPlayer.mesh.position);
    var xx = Math.pow((currentPlayer.mesh.position.x - halfMapSizeInWorldCoords), 2);
    var yy = Math.pow((currentPlayer.mesh.position.y - halfMapSizeInWorldCoords), 2);
    var distanceFromCentre =  Math.sqrt(xx + yy);
    camera.position.z = CONSTANTS.CAMERA_INIT_ALT + distanceFromCentre / 3;
  }
  renderer.render(scene, camera);
};

addLog('CMDer v1.0.0');
addLog('Initialising...');
addLog('=========WELCOME=========');
addLog('type \'help\' for available commands');
mixpanel.track('Visit');
render();
