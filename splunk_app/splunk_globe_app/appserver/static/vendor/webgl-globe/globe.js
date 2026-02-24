/**
 * dat.globe Javascript WebGL Globe Toolkit
 * https://github.com/dataarts/webgl-globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, opts) {
  opts = opts || {};
  
  var colorFn = opts.colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
    return c;
  };
  var imgDir = opts.imgDir || '/globe/';

  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { type: 't', value: null }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'float facing = dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          'float lighting = clamp( facing * 0.5 + 0.5, 0.18, 1.0 );',
          'vec3 toned = pow( diffuse, vec3( 1.05 ) ) * 1.02;',
          'vec3 lit = toned * lighting;',
          'float rim = pow( 1.15 - facing, 4.0 );',
          'vec3 atmosphere = vec3( 0.55, 0.72, 1.0 ) * rim * 0.45;',
          'gl_FragColor = vec4( lit + atmosphere, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere' : {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'float intensity = pow( max( 0.0, 0.9 - dot( vNormal, vec3( 0, 0, 1.0 ) ) ), 10.0 );',
          'gl_FragColor = vec4( 0.35, 0.62, 1.0, 1.0 ) * intensity;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var mesh, earthMesh, atmosphere, point;
  var earthTexture = null;

  var overRenderer;

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 100000, distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;
  var autoRotateSpeed = 0;
  var minDistance = typeof opts.minDistance === 'number' ? opts.minDistance : 220;
  var maxDistance = typeof opts.maxDistance === 'number' ? opts.maxDistance : 1000;

  var NAV_MODE_GLOBAL = 'global';
  var NAV_MODE_SURFACE = 'surface';
  var NAV_MODE_LOCAL = 'local';
  var GLOBAL_THRESHOLD = typeof opts.globalThreshold === 'number' ? opts.globalThreshold : 480;
  var MID_THRESHOLD = typeof opts.midThreshold === 'number' ? opts.midThreshold : 300;
  var MODE_BLEND_MS = typeof opts.modeBlendMs === 'number' ? opts.modeBlendMs : 200;

  var navMode = NAV_MODE_GLOBAL;
  var navPrevMode = NAV_MODE_GLOBAL;
  var navBlend = 1;
  var navTransitionStart = 0;
  var devicePixelRatio = 1;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateRendererQuality() {
    if (!renderer) return;
    devicePixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    if (renderer.setPixelRatio) {
      renderer.setPixelRatio(devicePixelRatio);
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function normalizeLon(lon) {
    var value = lon;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }

  function altitudeFromDistance(value) {
    return Math.max(0, value - 200);
  }

  function computeNavMode(altitude) {
    if (altitude > GLOBAL_THRESHOLD) return NAV_MODE_GLOBAL;
    if (altitude > MID_THRESHOLD) return NAV_MODE_SURFACE;
    return NAV_MODE_LOCAL;
  }

  function modeTiltLimit(mode) {
    if (mode === NAV_MODE_LOCAL) return 30 * Math.PI / 180;
    if (mode === NAV_MODE_SURFACE) return 60 * Math.PI / 180;
    return 80 * Math.PI / 180;
  }

  function modeSensitivity(mode) {
    if (mode === NAV_MODE_LOCAL) return 0.55;
    if (mode === NAV_MODE_SURFACE) return 0.8;
    return 1.0;
  }

  function updateNavigationMode(now) {
    var altitude = altitudeFromDistance(distance);
    var nextMode = computeNavMode(altitude);
    if (nextMode !== navMode) {
      navPrevMode = navMode;
      navMode = nextMode;
      navTransitionStart = now;
      navBlend = 0;
    }

    if (navBlend < 1) {
      navBlend = clamp((now - navTransitionStart) / MODE_BLEND_MS, 0, 1);
    }
  }

  function blendedTiltLimit() {
    return lerp(modeTiltLimit(navPrevMode), modeTiltLimit(navMode), navBlend);
  }

  function blendedSensitivity() {
    return lerp(modeSensitivity(navPrevMode), modeSensitivity(navMode), navBlend);
  }

  function raycastSphereFromEvent(event) {
    if (!camera || !renderer || !renderer.domElement) return null;
    var canvas = renderer.domElement;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    var x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    var y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    var origin = camera.position.clone();
    var direction = new THREE.Vector3(x, y, 0.5);
    direction.unproject(camera);
    direction.sub(origin).normalize();

    var radius = 200;
    var a = direction.dot(direction);
    var b = 2 * origin.dot(direction);
    var c = origin.dot(origin) - radius * radius;
    var discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    var sqrt = Math.sqrt(discriminant);
    var t1 = (-b - sqrt) / (2 * a);
    var t2 = (-b + sqrt) / (2 * a);
    var t = t1 > 0 ? t1 : t2 > 0 ? t2 : -1;
    if (t <= 0) return null;

    return origin.add(direction.multiplyScalar(t));
  }

  function vectorToLatLon(vector) {
    var r = vector.length();
    if (!isFinite(r) || r <= 0) return null;
    var lat = Math.asin(vector.y / r) * 180 / Math.PI;
    var lon = 180 - Math.atan2(vector.z, vector.x) * 180 / Math.PI;
    return { lat: lat, lon: normalizeLon(lon) };
  }

  function init() {

    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;

    scene = new THREE.Scene();

    var geometry = new THREE.SphereGeometry(200, 128, 96);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir+'world.jpg');
    earthTexture = uniforms['texture'].value;
    earthTexture.minFilter = THREE.LinearMipMapLinearFilter;
    earthTexture.magFilter = THREE.LinearFilter;
    if (earthTexture.generateMipmaps !== undefined) {
      earthTexture.generateMipmaps = true;
    }

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader

        });

    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);
    earthMesh = mesh;

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.ShaderMaterial({

          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true

        });

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set( 1.1, 1.1, 1.1 );
    scene.add(mesh);
    atmosphere = mesh;

    geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));

    point = new THREE.Mesh(geometry);

    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setClearColor(0x000000, 0);
    updateRendererQuality();
    renderer.setSize(w, h);

    if (earthTexture) {
      var maxAnisotropy = 0;
      if (renderer.getMaxAnisotropy) {
        maxAnisotropy = renderer.getMaxAnisotropy() || 0;
      } else if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
        maxAnisotropy = renderer.capabilities.getMaxAnisotropy() || 0;
      }
      earthTexture.anisotropy = Math.max(2, Math.min(8, maxAnisotropy));
      earthTexture.needsUpdate = true;
    }

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);

    container.addEventListener('wheel', onMouseWheel, { passive: true });

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);
  }

  function addData(data, opts) {
    var lat, lng, size, color, i, step, colorFnWrapper;

    opts.animated = opts.animated || false;
    this.is_animated = opts.animated;
    opts.format = opts.format || 'magnitude'; // other option is 'legend'
    if (opts.format === 'magnitude') {
      step = 3;
      colorFnWrapper = function(data, i) { return colorFn(data[i+2]); }
    } else if (opts.format === 'legend') {
      step = 4;
      colorFnWrapper = function(data, i) { return colorFn(data[i+3]); }
    } else {
      throw('error: format not supported: '+opts.format);
    }

    if (opts.animated) {
      if (this._baseGeometry === undefined) {
        this._baseGeometry = new THREE.Geometry();
        for (i = 0; i < data.length; i += step) {
          lat = data[i];
          lng = data[i + 1];
//        size = data[i + 2];
          color = colorFnWrapper(data,i);
          size = 0;
          addPoint(lat, lng, size, color, this._baseGeometry);
        }
      }
      if(this._morphTargetId === undefined) {
        this._morphTargetId = 0;
      } else {
        this._morphTargetId += 1;
      }
      opts.name = opts.name || 'morphTarget'+this._morphTargetId;
    }
    var subgeo = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      lat = data[i];
      lng = data[i + 1];
      color = colorFnWrapper(data,i);
      size = data[i + 2];
      size = size*200;
      addPoint(lat, lng, size, color, subgeo);
    }
    if (opts.animated) {
      this._baseGeometry.morphTargets.push({'name': opts.name, vertices: subgeo.vertices});
    } else {
      this._baseGeometry = subgeo;
    }

  };

  function createPoints() {
    if (this._baseGeometry !== undefined) {
      if (this.is_animated === false) {
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: false
            }));
      } else {
        if (this._baseGeometry.morphTargets.length < 8) {
          console.log('t l',this._baseGeometry.morphTargets.length);
          var padding = 8-this._baseGeometry.morphTargets.length;
          console.log('padding', padding);
          for(var i=0; i<=padding; i++) {
            console.log('padding',i);
            this._baseGeometry.morphTargets.push({'name': 'morphPadding'+i, vertices: this._baseGeometry.vertices});
          }
        }
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: true
            }));
      }
      scene.add(this.points);
    }
  }

  function addPoint(lat, lng, size, color, subgeo) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(mesh.position);

    point.scale.z = Math.max( size, 0.01 ); // avoid non-invertible matrix
    point.updateMatrix();

    for (var i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }
    if(point.matrixAutoUpdate){
      point.updateMatrix();
    }
    subgeo.merge(point.geometry, point.matrix);
  }

  function onMouseDown(event) {
    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';
  }

  function onMouseMove(event) {
    mouse.x = - event.clientX;
    mouse.y = event.clientY;

    updateNavigationMode(Date.now());

    var distanceRange = Math.max(1, maxDistance - minDistance);
    var closeZoomFactor = clamp((maxDistance - distance) / distanceRange, 0, 1);
    var zoomScale = lerp(0.55, 1.15, closeZoomFactor);
    var altitude = altitudeFromDistance(distance);
    var altitudeScale = clamp(altitude / 360, 0.55, 1.2);
    var sensitivity = 0.0048 * zoomScale * altitudeScale * blendedSensitivity();

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * sensitivity;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * sensitivity;

    var tilt = blendedTiltLimit();
    target.y = target.y > tilt ? tilt : target.y;
    target.y = target.y < -tilt ? -tilt : target.y;
  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
  }

  function onMouseWheel(event) {
    if (overRenderer) {
      var delta = typeof event.deltaY === 'number' ? -event.deltaY : 0;
      var hit = raycastSphereFromEvent(event);
      if (hit) {
        var latLon = vectorToLatLon(hit);
        if (latLon) {
          focusLatLon(latLon.lat, latLon.lon);
        }
      }
      zoom(delta * 0.3);
    }
  }

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize( event ) {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    updateRendererQuality();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > maxDistance ? maxDistance : distanceTarget;
    distanceTarget = distanceTarget < minDistance ? minDistance : distanceTarget;
  }

  function focusLatLon(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    var latRad = lat * Math.PI / 180;
    var lonRad = lng * Math.PI / 180;
    var x = -Math.cos(latRad) * Math.cos(lonRad);
    var y = Math.sin(latRad);
    var z = Math.cos(latRad) * Math.sin(lonRad);
    var targetX = Math.atan2(x, z);
    while (targetX - rotation.x > Math.PI) targetX -= Math.PI * 2;
    while (targetX - rotation.x < -Math.PI) targetX += Math.PI * 2;
    target.x = targetX;
    target.y = Math.max(-PI_HALF, Math.min(PI_HALF, Math.asin(y)));
  }

  function setAutoRotateSpeed(value) {
    var next = Number(value);
    if (!isFinite(next)) next = 0;
    autoRotateSpeed = next;
  }

  function setZoomTarget(value) {
    var next = Number(value);
    if (!isFinite(next)) return;
    distanceTarget = next;
    distanceTarget = distanceTarget > maxDistance ? maxDistance : distanceTarget;
    distanceTarget = distanceTarget < minDistance ? minDistance : distanceTarget;
  }

  function getZoomDistance() {
    return distance;
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }

  function render() {
    zoom(curZoomSpeed);
    updateNavigationMode(Date.now());

    if (autoRotateSpeed !== 0) {
      target.x += autoRotateSpeed * 0.0015;
    }

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.18;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    camera.lookAt(mesh.position);

    renderer.render(scene, camera);
  }

  init();
  this.animate = animate;


  this.__defineGetter__('time', function() {
    return this._time || 0;
  });

  this.__defineSetter__('time', function(t) {
    var validMorphs = [];
    var morphDict = this.points.morphTargetDictionary;
    for(var k in morphDict) {
      if(k.indexOf('morphPadding') < 0) {
        validMorphs.push(morphDict[k]);
      }
    }
    validMorphs.sort();
    var l = validMorphs.length-1;
    var scaledt = t*l+1;
    var index = Math.floor(scaledt);
    for (i=0;i<validMorphs.length;i++) {
      this.points.morphTargetInfluences[validMorphs[i]] = 0;
    }
    var lastIndex = index - 1;
    var leftover = scaledt - index;
    if (lastIndex >= 0) {
      this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
    }
    this.points.morphTargetInfluences[index] = leftover;
    this._time = t;
  });

  this.addData = addData;
  this.createPoints = createPoints;
  this.renderer = renderer;
  this.scene = scene;
  this.camera = camera;
  this.earthMesh = earthMesh;
  this.atmosphereMesh = atmosphere;
  this.focusLatLon = focusLatLon;
  this.setAutoRotateSpeed = setAutoRotateSpeed;
  this.setZoomTarget = setZoomTarget;
  this.getZoomDistance = getZoomDistance;

  return this;

};

