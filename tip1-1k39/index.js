/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;
  var isWhiteStyle = false; // Глобальный флаг режима отделки


  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Для инициализации координат
  window.viewer = viewer;

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);


// Передаем ТРИ параметра: размер, отдаление (145), приближение (30)
var limiter = Marzipano.RectilinearView.limit.traditional(
  data.faceSize * 2, 
  125 * Math.PI / 180,  // Максимум отдаления (145 градусов)
  140 * Math.PI / 180    // Максимум приближения (30 градусов)
);

var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);


    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  /*
  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });
  */

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    if (!scene) return;

    // ГЛОБАЛЬНАЯ КОРРЕКЦИЯ: связываем пары сцен по их базовому имени (name)
    var currentName = scene.data.name; // Например: "1_HallWay" или "1_HallWay_REPAIR"
    var finalScene = scene;

    if (isWhiteStyle) {
      // Если включен режим отделки, нам нужна сцена, у которой name оканчивается на _REPAIR
      if (!currentName.endsWith('_REPAIR')) {
        var targetNameWb = currentName + '_REPAIR';
        // Ищем в массиве сцену, у которой data.name === targetNameWb
        for (var i = 0; i < scenes.length; i++) {
          if (scenes[i].data.name === targetNameWb) {
            finalScene = scenes[i];
            break;
          }
        }
      }
    } else {
      // Если режим отделки ВЫКЛЮЧЕН, нам нужна сцена БЕЗ _REPAIR
      if (currentName.endsWith('_REPAIR')) {
        var targetNameNormal = currentName.replace('_REPAIR', '');
        // Ищем в массиве сцену, у которой data.name === targetNameNormal
        for (var i = 0; i < scenes.length; i++) {
          if (scenes[i].data.name === targetNameNormal) {
            finalScene = scenes[i];
            break;
          }
        }
      }
    }

    var currentView = viewer.view();
    var savedYaw = currentView ? currentView.yaw() : null;
    var savedPitch = currentView ? currentView.pitch() : null;
    var savedFov = currentView ? currentView.fov() : null;

    stopAutorotate();
    
    // Переключаемся на правильную модификацию сцены
    finalScene.scene.switchTo();
    
    setTimeout(function() {
      var newView = viewer.view();
      if (newView && savedYaw !== null) {
        newView.setParameters({
          yaw: savedYaw,
          pitch: savedPitch,
          fov: savedFov
        });
      }
    }, 50);

    startAutorotate();
    updateSceneName(finalScene);
    
    // Переносим точку на мини-карте
    if (finalScene.data && finalScene.data.mapCoords) {
      var mapDot = document.getElementById('mini-map-dot');
      if (mapDot) {
        mapDot.classList.add('switching');
        
        setTimeout(function() {
          mapDot.style.left = finalScene.data.mapCoords.left;
          mapDot.style.top = finalScene.data.mapCoords.top;
        }, 150);
      }
    }
    
    setTimeout(function() {
      var mapDot = document.getElementById('mini-map-dot');
      if (mapDot) {
        mapDot.classList.remove('switching');
      }
    }, 300);
  }








  // =========================================================================
  // СЮДА ВСТАВЛЯЕМ КОД ГЕНЕРАЦИИ АЛЬТЕРНАТИВНЫХ ТОЧЕК НА КАРТЕ
  // =========================================================================
  var pointsContainer = document.getElementById('mini-map-points');
  if (pointsContainer && data.scenes) {
    data.scenes.forEach(function(sceneData) {
      // Проверяем, прописаны ли координаты для этой сцены в data.js
      if (sceneData.mapCoords && sceneData.mapCoords.left && sceneData.mapCoords.top) {
        
        // Создаем элемент точки
        var pointEl = document.createElement('div');
        pointEl.classList.add('map-nav-point');
        pointEl.setAttribute('data-scene-id', sceneData.id);
        
        // Выставляем координаты из data.js
        pointEl.style.left = sceneData.mapCoords.left;
        pointEl.style.top = sceneData.mapCoords.top;
        
        // Добавляем клик для переключения сцены
        pointEl.addEventListener('click', function(event) {
          event.stopPropagation(); // Защита от дерганья панорамы
          
          // Ищем нужную сцену по ID и переключаемся через вашу штатную функцию
          var targetScene = findSceneById(sceneData.id);
          if (targetScene) {
            switchScene(targetScene);
            
          }
        });
        
        // Складываем точку в контейнер на карте
        pointsContainer.appendChild(pointEl);
      }
    });
  }
  // =========================================================================










  function updateSceneName(scene) {
    sceneNameElement.innerHTML = "1-КОМНАТНАЯ | 39м²";
  }

  function updateSceneList(scene) {
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }










  // Умный запуск стартовой сцены с учетом выбранного режима отделки
  var startScene = scenes[8]; // Твоя дефолтная стартовая сцена (HallWay)
  if (isWhiteStyle && startScene.data && startScene.data.name) {
    var targetNameWb = startScene.data.name + '_REPAIR';
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.name === targetNameWb) {
        startScene = scenes[i];
        break;
      }
    }
  }

  // Запускаем тур сразу с правильной модификации панорамы
  stopAutorotate();
  startScene.scene.switchTo();
  updateSceneName(startScene);

  // Переносим точку на мини-карте на стартовую позицию
  if (startScene.data && startScene.data.mapCoords) {
    var mapDot = document.getElementById('mini-map-dot');
    if (mapDot) {
      mapDot.style.left = startScene.data.mapCoords.left;
      mapDot.style.top = startScene.data.mapCoords.top;
    }
  }
  startAutorotate();
  hideSceneList();






  // =========================================================================
  // ОБРАБОТЧИК ДЛЯ IOS-ТУМБЛЕРА "ВАРИАНТ ОТДЕЛКИ" И НАСТРОЙКА СТАРТА
  // =========================================================================
  
  // НАСТРОЙКА СТАРТА: true = без ремонта (ID 8/9, plan_REPAIR), false = с ремонтом
  isWhiteStyle = true; 

  var finishToggleInput = document.getElementById('finish-variant-toggle-btn');
  var mapImageEl = document.getElementById('mini-map-img');

  function syncInterfaceStyle() {
    if (!finishToggleInput) return;
    
    // Выставляем положение чекбокса в зависимости от значения флага
    // Если ищем _REPAIR (без ремонта), тумблер выключен, иначе включен
    finishToggleInput.checked = !isWhiteStyle;

    if (isWhiteStyle) {
      if (mapImageEl) mapImageEl.src = 'img/plan_REPAIR.jpg';
    } else {
      if (mapImageEl) mapImageEl.src = 'img/plan.jpg';
    }
  }

  // Применяем графику карт сразу при инициализации страницы
  syncInterfaceStyle();

  if (finishToggleInput) {
    // Используем событие 'change', так как это чекбокс тумблера
    finishToggleInput.addEventListener('change', function(event) {
      event.stopPropagation();
      
      // Инвертируем флаг режима
      isWhiteStyle = !isWhiteStyle;
      syncInterfaceStyle();

      var currentScene = viewer.scene();
      if (currentScene) {
        for (var i = 0; i < scenes.length; i++) {
          if (scenes[i].scene === currentScene) {
            switchScene(scenes[i]);
            break;
          }
        }
      }
    });
  }




  // НАШ ОБНОВЛЕННЫЙ БЛОК: Только вращение луча радара
  viewer.addEventListener('viewChange', function() {
    var currentScene = viewer.scene();
    var mapDot = document.getElementById('mini-map-dot');
    
    if (currentScene && mapDot) {
      var liveView = currentScene.view();
      if (!liveView) return;
      
      var yaw = liveView.yaw();
      var degrees = yaw * (180 / Math.PI);
      
      /* ИСПРАВЛЕНО: translate(-50%, -50%) обязателен, чтобы 
         точка оставалась центрированной в своих координатах процентов */
      mapDot.style.transform = 'translate(-50%, -50%) rotate(' + (degrees + 180) + 'deg)';
    }
  });


  // НАШ ФИНАЛЬНЫЙ БЛОК: Логика развёртывания и свёртывания мини-карты
  var mapOpenBtn = document.getElementById('mini-map-toggle-btn');
  var mapWrapper = document.getElementById('mini-map-wrapper');
  var mapCloseBtn = document.getElementById('mini-map-close-btn');

  if (mapOpenBtn && mapWrapper && mapCloseBtn) {
    // НАЖАЛИ «КАРТА»: скрываем кнопку, плавно проявляем планировку
    mapOpenBtn.addEventListener('click', function(event) {
      event.stopPropagation(); // Защита, чтобы панорама не дергалась при клике
      mapOpenBtn.classList.add('hidden-state');
      mapWrapper.classList.add('active-state');
    });

    // НАЖАЛИ НА КРЕСТИК: скрываем планировку, возвращаем кнопку обратно
    mapCloseBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      mapWrapper.classList.remove('active-state');
      mapOpenBtn.classList.remove('hidden-state');
    });
  }



})();
