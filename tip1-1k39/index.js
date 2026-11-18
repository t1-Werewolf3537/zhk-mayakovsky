'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var data = window.APP_DATA;

  // =========================================================================
  // ГЛАВНЫЕ НАСТРОЙКИ ПРОЕКТА
  // =========================================================================
  var ENABLE_REPAIR_SWITCH = true; // true = тумблер отделки включен, false = полностью скрыт
  var START_WITH_REPAIR = false;   // true = старт с ремонтом (_REPAIR), false = без ремонта
  // =========================================================================

  var isWhiteStyle = ENABLE_REPAIR_SWITCH ? START_WITH_REPAIR : false;

  // Элементы DOM
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');

  // Определение десктопа или мобильного устройства
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

  // Определение сенсорного экрана
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Инициализация вьюера
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  });
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
      125 * Math.PI / 180,
      140 * Math.PI / 180
    );

    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Создание стрелок перехода
    sceneData.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: sceneData,
      scene: scene,
      view: view
    };
  });

  // Меню списка квартир
  sceneListToggleElement.addEventListener('click', function() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  // Переключение сцен с учетом режима отделки
  function switchScene(scene) {
    if (!scene) return;

    var currentName = scene.data.name;
    var finalScene = scene;

    if (ENABLE_REPAIR_SWITCH) {
      if (isWhiteStyle) {
        if (!currentName.endsWith('_REPAIR')) {
          var targetNameRepair = currentName + '_REPAIR';
          for (var i = 0; i < scenes.length; i++) {
            if (scenes[i].data.name === targetNameRepair) {
              finalScene = scenes[i];
              break;
            }
          }
        }
      } else {
        if (currentName.endsWith('_REPAIR')) {
          var targetNameNormal = currentName.replace('_REPAIR', '');
          for (var i = 0; i < scenes.length; i++) {
            if (scenes[i].data.name === targetNameNormal) {
              finalScene = scenes[i];
              break;
            }
          }
        }
      }
    }

    var currentView = viewer.view();
    var savedYaw = currentView ? currentView.yaw() : null;
    var savedPitch = currentView ? currentView.pitch() : null;
    var savedFov = currentView ? currentView.fov() : null;

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

    sceneNameElement.innerHTML = "1-КОМНАТНАЯ | 39м²";

    // Перенос красной точки на мини-карте
    var mapDot = document.getElementById('mini-map-dot');
    if (mapDot && finalScene.data && finalScene.data.mapCoords) {
      mapDot.classList.add('switching');
      setTimeout(function() {
        mapDot.style.left = finalScene.data.mapCoords.left;
        mapDot.style.top = finalScene.data.mapCoords.top;
      }, 150);
      setTimeout(function() {
        mapDot.classList.remove('switching');
      }, 300);
    }
  }

  // Генерация синих точек комнат на мини-карте
  var pointsContainer = document.getElementById('mini-map-points');
  if (pointsContainer && data.scenes) {
    data.scenes.forEach(function(sceneData) {
      if (sceneData.mapCoords && sceneData.mapCoords.left && sceneData.mapCoords.top) {
        var pointEl = document.createElement('div');
        pointEl.classList.add('map-nav-point');
        pointEl.setAttribute('data-scene-id', sceneData.id);
        pointEl.style.left = sceneData.mapCoords.left;
        pointEl.style.top = sceneData.mapCoords.top;

        pointEl.addEventListener('click', function(event) {
          event.stopPropagation();
          var targetScene = findSceneById(sceneData.id);
          if (targetScene) {
            switchScene(targetScene);
          }
        });

        pointsContainer.appendChild(pointEl);
      }
    });
  }

  // Создание элемента стрелки перехода
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

  function stopTouchAndScrollEventPropagation(element) {
    var eventList = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel'];
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

  // Запуск стартовой сцены (нужный  ндекс -1)
  var startScene = scenes[2];
  if (ENABLE_REPAIR_SWITCH && isWhiteStyle && startScene.data && startScene.data.name) {
    var targetNameStart = startScene.data.name + '_REPAIR';
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.name === targetNameStart) {
        startScene = scenes[i];
        break;
      }
    }
  }

  startScene.scene.switchTo();
  sceneNameElement.innerHTML = "1-КОМНАТНАЯ | 39м²";

  var initialMapDot = document.getElementById('mini-map-dot');
  if (initialMapDot && startScene.data && startScene.data.mapCoords) {
    initialMapDot.style.left = startScene.data.mapCoords.left;
    initialMapDot.style.top = startScene.data.mapCoords.top;
  }
  hideSceneList();

  // Логика тумблера "Вариант отделки" и подсказки
  var switchWrapper = document.querySelector('.ios-switch-wrapper');
  var finishToggleInput = document.getElementById('finish-variant-toggle-btn');
  var mapImageEl = document.getElementById('mini-map-img');
  var hintBox = document.getElementById('finish-variant-hint');

  if (!ENABLE_REPAIR_SWITCH) {
    // Если тумблер отключен в настройках — скрываем его и ставим обычную карту
    if (switchWrapper) switchWrapper.style.setProperty('display', 'none', 'important');
    if (mapImageEl) mapImageEl.src = 'img/plan.jpg';
  } else {
    // Если тумблер включен — запускаем штатную логику
    var syncInterfaceStyle = function() {
      if (!finishToggleInput) return;
      finishToggleInput.checked = isWhiteStyle;
      if (mapImageEl) {
        mapImageEl.src = isWhiteStyle ? 'img/plan_REPAIR.jpg' : 'img/plan.jpg';
      }
    };

    syncInterfaceStyle();

    if (finishToggleInput) {
      var showTimer = null;

      if (hintBox) {
        showTimer = setTimeout(function() {
          if (!finishToggleInput.checked && !hintBox.classList.contains('is-dismissed')) {
            hintBox.classList.add('is-visible');
          }
        }, 6000);
      }

      finishToggleInput.addEventListener('change', function(event) {
        event.stopPropagation();

        if (this.checked && hintBox) {
          clearTimeout(showTimer);
          hintBox.classList.remove('is-visible');
          hintBox.classList.add('is-dismissed');
        }

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
  }

  // Вращение луча радара на мини-карте
  viewer.addEventListener('viewChange', function() {
    var currentScene = viewer.scene();
    var mapDot = document.getElementById('mini-map-dot');

    if (currentScene && mapDot) {
      var liveView = currentScene.view();
      if (!liveView) return;

      var degrees = liveView.yaw() * (180 / Math.PI);
      mapDot.style.transform = 'translate(-50%, -50%) rotate(' + (degrees + 180) + 'deg)';
    }
  });

  // Сворачивание и разворачивание мини-карты
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

})();
