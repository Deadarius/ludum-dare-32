'use strict';

var THREE = require('three');
var socket = require('socket.io-client');
var Unit = require('./unit');
var audio = require('./audio');

var _ = require('lodash');

var minimist = require('minimist');

var scene = new THREE.Scene();

 var backMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
});
var backGeometry = new THREE.PlaneGeometry(100000, 100000, 500, 500);
var backMesh = new THREE.Mesh(backGeometry, backMaterial);
backMesh.position.set(0, 0, 0);
scene.add(backMesh);

var viewport = document.getElementById('viewport');

var renderer = new THREE.WebGLRenderer();
renderer.setSize(viewport.clientWidth, viewport.clientHeight);

viewport.appendChild(renderer.domElement);



//var camera = new THREE.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, 0.1, 1000);
var camera = new THREE.PerspectiveCamera( 90, viewport.clientWidth/viewport.clientHeight, 0.1, 1000000 );

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

camera.position.z = 800;

var socketIo = socket();
var username;
var currentPlayer;
var kills = 0;

setInterval(function(){
  socketIo.emit('heart-beat');
}, 5000);

var players = {};
var bullets = [];
var logger = document.getElementById('log');

function addLog(text){
  var newElement = document.createElement('div');
  newElement.innerHTML = text;
  logger.appendChild(newElement);
  logger.scrollTop = logger.scrollHeight;
  return newElement;
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
  }
  else if (data.killer === username) {
    kills++;
    addWarning('You killed ' + data.died);
  }

  players[data.died].die();
});

socketIo.on('commands', function(commands){
  if(_.some(commands, {command: 'shot'})){
    audio.shot();
  }
});

socketIo.on('notifications', function(notifications){
  if(_.some(notifications, {key: 'login'})){
    audio.spawn();
  }

  if(_.some(notifications, {command: 'dead'})){
    audio.die();
  }

  _.each(notifications, function(notification){
    addLog(notification.text);
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

  state.bullets.forEach(function(bulletServer, index){
    var bullet = bullets[index];
    if(!bullet){
      bullet = bullets[index] = new Unit(scene, bulletMaterial);
    }

    bullet.position = bulletServer.position;
    bullet.direction = bulletServer.direction;
  });
});

var commandInput = document.getElementById('command');
commandInput.onkeyup = checkKey;

function checkKey(e) {
  var code = e.which || e.keyCode;

  if (+code !== 13) {
    return;
  }
  var commandInputValue = commandInput.value;
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
  }
  else if(cmd === 'help'){
    addLog('login &lt;username&gt;');
    addLog('move');
    addLog('reverse');
    addLog('left');
    addLog('right');
    addLog('uturn');
    addLog('shot');
    addLog('stats');
    addLog('submit');
    addLog('best');
    addLog('about');
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
  if(currentPlayer){
    camera.lookAt(currentPlayer.mesh.position);
    var xx = Math.pow(currentPlayer.mesh.position.x, 2);
    var yy = Math.pow(currentPlayer.mesh.position.y, 2);
    var distanceFromCentre =  Math.sqrt(xx + yy);
    camera.position.z = 800 + distanceFromCentre;
  }
  renderer.render(scene, camera);
};

addLog('CMDer v1.0.0');
addLog('Initialising...');
addLog('=========WELCOME=========');
addLog('type \'help\' for available commands');

render();
