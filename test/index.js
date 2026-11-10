/*
 * Copyright 2016 Google Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0...
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;
  var isWhiteStyle = true; // НАСТРОЙКА СТАРТА: true = без ремонта (_REPAIR), false = с ремонтом

  // DOM элементы
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');
  var finishToggleInput = document.getElementById('finish-variant-toggle-btn');
  var mapImageEl = document.getElementById('mini-map-img');
  var mapDot = document.getElementById('mini-map-dot');

  // Адаптив под мобильные устройства
  if (window.matchMedia) {
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    var setMode = function() {
      document.body.classList.toggle('mobile', mql.matches);
      document.body.classList.toggle('desktop', !mql.matches);
    };
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Определение тач-скрина
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Инициализация плеера Marzipano
  var viewer = new Marzipano.Viewer(panoElement, { controls: { mouseViewMode: data.settings.mouseViewMode } });
  window.viewer = viewer;

  // Создание сцен
  var scenes = data.scenes.map(function(sceneData) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + sceneData.id + "/preview.jpg" }
    );
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(
      sceneData.faceSize * 2, 
      125 * Math.PI / 180, // Максимум отдаления (145 градусов)
      140 * Math.PI / 180  // Максимум приближения (30 градусов)
    );
    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);
    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });

    // Хотспоты переходов
    sceneData.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Инфо-хотспоты
    sceneData.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: sceneData, scene: scene, view: view };
  });

  // Автоповорот
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (autorotateToggleElement) {
    if (data.settings.autorotateEnabled) {
      autorotateToggleElement.classList.add('enabled');
    }
    autorotateToggleElement.addEventListener('click', toggleAutorotate);
  }


  // Полноэкранный режим
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() { screenfull.toggle(); });
    screenfull.on('change', function() {
      fullscreenToggleElement.classList.toggle('enabled', screenfull.isFullscreen);
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Переключение списка сцен
  sceneListToggleElement.addEventListener('click', toggleSceneList);
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Оставляем только базовые настройки контроллеров (стрелки удалены из HTML)
  var controls = viewer.controls();


  // Генерация навигационных точек на мини-карте
  var pointsContainer = document.getElementById('mini-map-points');
  if (pointsContainer && data.scenes) {
    data.scenes.forEach(function(sceneData) {
      if (sceneData.mapCoords && sceneData.mapCoords.left && sceneData.mapCoords.top) {
        var pointEl = document.createElement('div');
        pointEl.classList.add('map-nav-point');
        pointEl.style.left = sceneData.mapCoords.left;
        pointEl.style.top = sceneData.mapCoords.top;
        
        pointEl.addEventListener('click', function(event) {
          event.stopPropagation();
          var targetScene = findSceneById(sceneData.id);
          if (targetScene) switchScene(targetScene);
        });
        pointsContainer.appendChild(pointEl);
      }
    });
  }

  // Функция умного переключения сцены
  function switchScene(scene) {
    if (!scene) return;

    var currentName = scene.data.name;
    var finalScene = scene;

    // Коррекция под тип отделки (_REPAIR или без него)
    if (isWhiteStyle) {
      if (!currentName.endsWith('_REPAIR')) {
        finalScene = scenes.find(function(s) { return s.data.name === currentName + '_REPAIR'; }) || scene;
      }
    } else {
      if (currentName.endsWith('_REPAIR')) {
        finalScene = scenes.find(function(s) { return s.data.name === currentName.replace('_REPAIR', ''); }) || scene;
      }
    }

    var currentView = viewer.view();
    var savedYaw = currentView ? currentView.yaw() : null;
    var savedPitch = currentView ? currentView.pitch() : null;
    var savedFov = currentView ? currentView.fov() : null;

    stopAutorotate();
    finalScene.scene.switchTo();
    
    setTimeout(function() {
      var newView = viewer.view();
      if (newView && savedYaw !== null) {
        newView.setParameters({ yaw: savedYaw, pitch: savedPitch, fov: savedFov });
      }
    }, 50);

    startAutorotate();
    sceneNameElement.innerHTML = "1-КОМНАТНАЯ | 39м²";
    
    // Синхронизация маркера мини-карты
    if (finalScene.data && finalScene.data.mapCoords && mapDot) {
      mapDot.classList.add('switching');
      setTimeout(function() {
        mapDot.style.left = finalScene.data.mapCoords.left;
        mapDot.style.top = finalScene.data.mapCoords.top;
      }, 150);
    }
    
    setTimeout(function() {
      if (mapDot) mapDot.classList.remove('switching');
    }, 300);
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
    // Полностью блокируем автоматическое вращение, но гасим старые движения плеера
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function stopAutorotate() {
    // Безопасная остановка движений камеры в момент переключения комнат
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }


  function toggleAutorotate() {
    if (!autorotateToggleElement) return;
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }


  function createLinkHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');

    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    icon.style.transform = 'rotate(' + hotspot.rotation + 'rad)';

    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    stopTouchAndScrollEventPropagation(wrapper);
    wrapper.appendChild(icon);
    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'info-hotspot');

    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    wrapper.appendChild(header);
    wrapper.appendChild(text);

    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  function stopTouchAndScrollEventPropagation(element) {
    var eventList = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel'];
    eventList.forEach(function(ev) {
      element.addEventListener(ev, function(e) { e.stopPropagation(); });
    });
  }

  function findSceneById(id) {
    return scenes.find(function(s) { return s.data.id === id; }) || null;
  }

  // Синхронизация тумблера и карты
  function syncInterfaceStyle() {
    if (!finishToggleInput) return;
    finishToggleInput.checked = !isWhiteStyle;
    if (mapImageEl) {
      mapImageEl.src = isWhiteStyle ? 'img/plan_REPAIR.jpg' : 'img/plan.jpg';
    }
  }

  if (finishToggleInput) {
    finishToggleInput.addEventListener('change', function(event) {
      event.stopPropagation();
      isWhiteStyle = !isWhiteStyle;
      syncInterfaceStyle();

      var currentScene = viewer.scene();
      var activeScene = scenes.find(function(s) { return s.scene === currentScene; });
      if (activeScene) switchScene(activeScene);
    });
  }

  // Вращение радара мини-карты
  viewer.addEventListener('viewChange', function() {
    var currentScene = viewer.scene();
    if (currentScene && mapDot) {
      var liveView = currentScene.view();
      if (liveView) {
        var degrees = liveView.yaw() * (180 / Math.PI);
        mapDot.style.transform = 'translate(-50%, -50%) rotate(' + (degrees + 180) + 'deg)';
      }
    }
  });

  // Открытие/закрытие мини-карты
  var mapOpenBtn = document.getElementById('mini-map-toggle-btn');
  var mapWrapper = document.getElementById('mini-map-wrapper');
  var mapCloseBtn = document.getElementById('mini-map-close-btn');

  if (mapOpenBtn && mapWrapper && mapCloseBtn) {
    mapOpenBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      mapOpenBtn.classList.add('hidden-state');
      mapWrapper.classList.add('active-state');
    });

    mapCloseBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      mapWrapper.classList.remove('active-state');
      mapOpenBtn.classList.remove('hidden-state');
    });
  }

  // СТАРТ ТУРА: Запускаем тур через switchScene для инициализации всех параметров
  var startScene = scenes[8] || scenes[0]; // Индекс дефолтной сцены (например, 8 для HallWay)
  syncInterfaceStyle();
  switchScene(startScene);

  hideSceneList();



})();
