'use strict';

var THREE = require('three');
var step = 100;

function Unit(scene, material){
  var geometry = new THREE.PlaneGeometry(100, 100, 1, 1);
  var mesh = new THREE.Mesh(geometry, material);
  this.mesh = mesh;
  scene.add(this.mesh);
  this._scene = scene;
  this._position = {x: 0, y: 0};
  this._isInitPositioned = false;
}

Object.defineProperty(Unit.prototype, 'direction', {
  get: function(){
    return this._direction;
  },
  set: function(value){
    this._direction = value;
    switch(value){
      case 'n':
        this.mesh.rotation.z = 0;
        break;
      case 'w':
        this.mesh.rotation.z = Math.PI / 2;
        break;
      case 'e':
        this.mesh.rotation.z = Math.PI + Math.PI / 2;
        break;
      case 's':
        this.mesh.rotation.z = Math.PI;
        break;
    }
  }
});

Object.defineProperty(Unit.prototype, 'position', {
  get: function(){
    return this._position;
  },
  set: function(value){
    if(!this._isInitPositioned){
      this._position = value;
      this.mesh.position.z = 1;
      this._isInitPositioned = true;
    }
    this.mesh.position.x = this._position.x * step;
    this.mesh.position.y = this._position.y * step;
    this._position = value;
  }
});

Unit.prototype.die = function die(){
  this._scene.remove(this.mesh);
};

Unit.prototype.animate = function move(){
  if(!this._isInitPositioned){
    return;
  }
  var currentX = this.mesh.position.x / step;
  var currentY = this.mesh.position.y / step;

  if(currentX < this.position.x){
    this.mesh.position.x += 10;
  }
  else if(currentX > this.position.x){
    this.mesh.position.x -= 10;
  }

  if(currentY < this.position.y){
    this.mesh.position.y += 10;
  }
  else if(currentY > this.position.y){
    this.mesh.position.y -= 10;
  }
};

module.exports = Unit;
